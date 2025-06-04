# backend/routers/chat.py
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body, Path
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi.concurrency import run_in_threadpool
import json
from jinja2 import Environment, FileSystemLoader, select_autoescape, Undefined, StrictUndefined
from sqlalchemy.orm import joinedload
from fastapi.responses import StreamingResponse

from backend.services.faiss_service import get_faiss_index
from backend.services.mistral_client import MistralClient
from backend.services.rerank_service import get_auxiliary_rerank_service, get_principal_rerank_service
from backend.schemas.event import FixedEventData
from backend.background_tasks import run_full_interaction_analysis

from backend.services.query_transformation_service import QueryTransformationService
from backend.services.openrouter_client import OpenRouterClient # Import OpenRouterClient

logger = logging.getLogger(__name__)

# Patch json module globally to handle Jinja2 Undefined everywhere
class PatchedJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Undefined):
            return None
        return super().default(obj)

json._default_encoder = PatchedJSONEncoder()
json.dumps = lambda *args, **kwargs: PatchedJSONEncoder().encode(args[0]) if len(args) == 1 else PatchedJSONEncoder().encode(args[0])

# Jinja2 environment for all templates
jinja_env = Environment(
    loader=FileSystemLoader("backend/templates"),
    autoescape=select_autoescape(["html", "xml", "jinja2"]),
    undefined=Undefined  # Temporarily changed for debugging NameError
)

# Import SQLAlchemy models
from backend.models.chat_session import ChatSession
from backend.models.chat_message import ChatMessage
from backend.models.user_settings import UserSettings
from backend.models.session_cache_fact import SessionCacheFact
from backend.services.event_manager_service import EventManagerService
from backend.models.session_relationship import SessionRelationship
from backend.models.session_lore_modification import SessionLoreModification
from backend.models.user_persona import UserPersona
from backend.models.character_card import CharacterCard
from backend.models.scenario_card import ScenarioCard
from backend.models.master_world import MasterWorld
from backend.models.active_session_event import ActiveSessionEvent
from backend.models.lore_entry import LoreEntry as LoreEntryModel


# Import Pydantic schemas
from backend.schemas.chat_session import ChatSessionCreate, ChatSessionInDB, ChatSessionUpdate, ChatSessionListed
from backend.schemas.chat_message import ChatMessageCreate, ChatMessageInDB, ChatTurnResponse, AIPersonaCardInfo, UserPersonaInfo

from backend.database import get_db
from backend.db.crud import create_chat_session as crud_create_chat_session

# Global service instances
faiss_index = get_faiss_index()
mistral_client = MistralClient()
auxiliary_rerank_service = get_auxiliary_rerank_service()
principal_rerank_service = get_principal_rerank_service()

# Helper function for RAG
def get_text_to_embed_from_lore_entry(lore_entry: LoreEntryModel) -> str:
    """Constructs text for embedding based on lore entry type."""
    if lore_entry.entry_type == "NARRATIVE_EVENT":
        # For Narrative Events, combine name, description, tags, and aliases
        return (
            f"Narrative Event: {lore_entry.name}. "
            f"Description: {lore_entry.description}. "
            f"Tags: {', '.join(lore_entry.tags or [])}. "
            f"Aliases: {', '.join(lore_entry.aliases or [])}"
        )
    # For other entry types, prioritize description, fall back to content
    return lore_entry.description or lore_entry.content or ""

# For UserMessageCreate, using a Pydantic model for the body is cleaner
class UserMessageInput(BaseModel):
    content: str = Field(..., min_length=1)
    user_persona_id: Optional[str] = None
    current_beginning_message_index: Optional[int] = None

router = APIRouter(
    tags=["Chat"],
    responses={404: {"description": "Not found"}},
)

USER_SETTINGS_ID = 1 # Global ID for the single settings row

@router.post("/sessions/{card_type}/{card_id}", response_model=ChatSessionInDB, status_code=status.HTTP_201_CREATED)
def create_or_get_chat_session(
    card_type: str,
    card_id: str,
    user_persona_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Create or get existing chat session for a card"""
    if card_type not in {"character", "scenario"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid card type. Must be 'character' or 'scenario'"
        )
    
    if card_type == "character":
        card = db.query(CharacterCard).filter(CharacterCard.id == str(card_id)).first()
    else:
        card = db.query(ScenarioCard).filter(ScenarioCard.id == str(card_id)).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{card_type.capitalize()} with id {card_id} not found"
        )
    
    existing_session = db.query(ChatSession).filter(
        ChatSession.card_type == card_type,
        ChatSession.card_id == str(card_id)
    ).order_by(ChatSession.last_active_at.desc()).first()

    if existing_session:
        logger.info(f"Found existing chat session {existing_session.id} for card {card_id}. Last active: {existing_session.last_active_at}")
        if user_persona_id is not None and existing_session.user_persona_id != user_persona_id:
            logger.info(f"Updating user_persona_id for existing session {existing_session.id} from {existing_session.user_persona_id} to {user_persona_id}")
            existing_session.user_persona_id = user_persona_id
            db.add(existing_session)
            db.commit()
            db.refresh(existing_session)
        return existing_session

    final_user_persona_id = user_persona_id
    if final_user_persona_id is None:
        default_user_persona = db.query(UserPersona).filter(UserPersona.name == "User").first()
        if default_user_persona:
            final_user_persona_id = str(default_user_persona.id)
        else:
            logger.warning("No user persona ID provided and default 'User' persona not found. Creating session with no linked persona.")
            final_user_persona_id = None

    title = f"Chat with {card.name if card_type == "character" else card.name}"
    new_chat = ChatSession(
        card_type=card_type,
        card_id=str(card_id),
        title=title,
        user_persona_id=final_user_persona_id
    )
    
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)

    beginning_messages = []
    if card_type == "character" and hasattr(card, 'beginning_messages') and card.beginning_messages:
        beginning_messages = card.beginning_messages
    elif card_type == "scenario" and hasattr(card, 'beginning_message') and card.beginning_message:
        beginning_messages = card.beginning_message

    if beginning_messages:
        initial_ai_message_content = beginning_messages[0]
        all_ai_responses = [
            {"content": msg, "timestamp": datetime.utcnow().isoformat()}
            for msg in beginning_messages
        ]
        initial_ai_message = ChatMessage(
            chat_session_id=new_chat.id,
            sender_type="AI",
            content=initial_ai_message_content,
            is_beginning_message=True,
            message_metadata={"ai_responses": all_ai_responses, "current_response_index": 0},
            active_persona_name=card.name,
            active_persona_image_url=card.image_url
        )
        db.add(initial_ai_message)
        db.commit()
        db.refresh(initial_ai_message)

    if final_user_persona_id and card_id:
        initial_relationship = SessionRelationship(
            chat_session_id=new_chat.id,
            entity1_id=final_user_persona_id,
            entity1_type="user_persona",
            entity2_id=str(card_id),
            entity2_type=card_type,
            trust_score=0,
            affection_score=0,
            rivalry_score=0,
            status_tags=["conhecidos_recentes"]
        )
        db.add(initial_relationship)
        db.commit()
        db.refresh(initial_relationship)
        logger.info(f"Initialized SessionRelationship for session {new_chat.id} between UserPersona {final_user_persona_id} and AI Card {card_id}.")

    return new_chat

@router.post("/", response_model=ChatSessionInDB, status_code=status.HTTP_201_CREATED, deprecated=True)
async def create_chat_session_legacy(
    session_create: ChatSessionCreate,
    db: Session = Depends(get_db)
):
    """Legacy endpoint - prefer /sessions/{card_type}/{card_id}"""
    card_type = "character" if session_create.gm_character_id else "scenario"
    card_id = session_create.gm_character_id or session_create.scenario_id
    
    return create_or_get_chat_session(
        card_type=card_type,
        card_id=card_id,
        user_persona_id=session_create.user_persona_id,
        db=db
    )

@router.get("/check", response_model=Optional[ChatSessionInDB])
async def check_existing_session(
    scenario_id: Optional[str] = None,
    gm_character_id: Optional[str] = None,
    user_persona_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Checks for an existing chat session based on the provided parameters.
    Returns the session if found, otherwise returns None.
    """
    if not gm_character_id and not scenario_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either gm_character_id or scenario_id must be provided"
        )

    query = db.query(ChatSession)

    if scenario_id:
        query = query.filter(ChatSession.scenario_id == scenario_id)
    elif gm_character_id:
        query = query.filter(ChatSession.gm_character_id == gm_character_id)

    if user_persona_id is not None:
        query = query.filter(ChatSession.user_persona_id == user_persona_id)
    else:
        query = query.filter(ChatSession.user_persona_id.is_(None))

    session = query.order_by(ChatSession.last_active_at.desc()).first()

    return session

@router.get("", response_model=List[ChatSessionListed])
async def list_chat_sessions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    try:
        user_message_count_subquery = (
            select(
                ChatMessage.chat_session_id,
                func.count(ChatMessage.id).label("user_message_count")
            )
            .filter(ChatMessage.sender_type == "USER")
            .group_by(ChatMessage.chat_session_id)
            .subquery()
        )

        query = (
            db.query(
                ChatSession,
                user_message_count_subquery.c.user_message_count
            )
            .outerjoin(
                user_message_count_subquery,
                ChatSession.id == user_message_count_subquery.c.chat_session_id
            )
            .order_by(ChatSession.last_active_at.desc())
        )
        
        sessions_with_counts = query.offset(skip).limit(limit).all()

        result = []
        for session, user_message_count in sessions_with_counts:
            try:
                session_data = {
                    "id": str(session.id),
                    "title": session.title,
                    "last_active_at": session.last_active_at,
                    "card_type": session.card_type,
                    "card_id": str(session.card_id) if session.card_id else None,
                    "card_name": None,
                    "card_image_url": None,
                    "user_message_count": user_message_count if user_message_count is not None else 0
                }

                if session.card_type == "character":
                    card = db.query(CharacterCard).filter(CharacterCard.id == session.card_id).first()
                    if card:
                        session_data["card_name"] = card.name
                        session_data["card_image_url"] = card.image_url
                elif session.card_type == "scenario":
                    card = db.query(ScenarioCard).filter(ScenarioCard.id == session.card_id).first()
                    if card:
                        session_data["card_name"] = card.name
                        session_data["card_image_url"] = card.image_url

                result.append(session_data)
            except Exception as session_error:
                continue

        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/{chat_id}", response_model=ChatSessionInDB)
def get_chat_session_details(chat_id: str, db: Session = Depends(get_db)):
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if db_chat_session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return db_chat_session

@router.get("/{chat_id}/messages", response_model=List[ChatMessageInDB])
def get_chat_session_messages(
    chat_id: str, skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)
):
    db_chat_session = db.query(ChatSession).filter(ChatMessage.chat_session_id == chat_id).first()
    if db_chat_session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")

    card = None
    if db_chat_session.card_type == "character":
        card = db.query(CharacterCard).filter(CharacterCard.id == db_chat_session.card_id).first()
    elif db_chat_session.card_type == "scenario":
        card = db.query(ScenarioCard).filter(ScenarioCard.id == db_chat_session.card_id).first()

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_session_id == chat_id)
        .order_by(ChatMessage.timestamp.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return messages

@router.delete("/{chat_id}", status_code=204)
def delete_chat_session(chat_id: str, db: Session = Depends(get_db)):
    """Delete a chat session and its messages by ID."""
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if not db_chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.query(ChatMessage).filter(ChatMessage.chat_session_id == chat_id).delete()
    db.delete(db_chat_session)
    db.commit()

def replace_jinja_undefined(obj):
    """Recursively replace Jinja2 Undefined values with None for JSON serialization."""
    if isinstance(obj, dict):
        return {k: replace_jinja_undefined(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_jinja_undefined(v) for v in obj]
    elif isinstance(obj, tuple):
        return tuple(replace_jinja_undefined(v) for v in obj)
    elif isinstance(obj, Undefined):
        return None
    else:
        return obj

@router.post("/{chat_id}/messages")
async def chat_message(
    chat_id: str = Path(..., title="The ID of the chat session"),
    user_message_input: UserMessageInput = Body(...),
    db: Session = Depends(get_db)
):
    """
    Generate a full LLM response for a chat message, incorporating RAG, planning, and analysis.
    Returns the full AI message as a JSON response (not streamed).
    """
    # --- LLM CLIENT/MODEL/KEY/CONTEXT SETUP (must be before any LLM call) ---
    db_user_settings_obj = db.query(UserSettings).filter(UserSettings.id == USER_SETTINGS_ID).first()
    if not db_user_settings_obj:
        raise HTTPException(status_code=500, detail="User settings not configured. Please configure settings first.")
    db_user_settings = {
        "llm_provider": db_user_settings_obj.llm_provider,
        "primary_llm_api_key": db_user_settings_obj.primary_llm_api_key,
        "planning_llm_api_key": db_user_settings_obj.planning_llm_api_key,
        "extraction_llm_api_key": db_user_settings_obj.extraction_llm_api_key,
        "analysis_llm_api_key": db_user_settings_obj.analysis_llm_api_key,
        "selected_llm_model": db_user_settings_obj.selected_llm_model,
        "mistral_api_key": db_user_settings_obj.mistral_api_key,
        "max_messages_for_context": db_user_settings_obj.max_messages_for_context,
        "planning_llm_model": db_user_settings_obj.planning_llm_model,
        "top_p": getattr(db_user_settings_obj, "top_p", 1.0),
        "max_response_tokens": getattr(db_user_settings_obj, "max_response_tokens", 512),
        "extraction_llm_model": getattr(db_user_settings_obj, "extraction_llm_model", None),
        "analysis_llm_model": getattr(db_user_settings_obj, "analysis_llm_model", None),
    }
    openrouter_client = OpenRouterClient()
    mistral_client = MistralClient()
    llm_client = None
    selected_llm_model = None
    api_key = None
    if db_user_settings["llm_provider"] == "OpenRouter":
        if not db_user_settings["primary_llm_api_key"]:
            raise HTTPException(status_code=500, detail="OpenRouter API key is missing. Please configure it in settings.")
        llm_client = openrouter_client
        selected_llm_model = db_user_settings["selected_llm_model"]
        api_key = db_user_settings["primary_llm_api_key"]
    elif db_user_settings["llm_provider"] == "MistralDirect":
        if not db_user_settings["mistral_api_key"]:
            raise HTTPException(status_code=500, detail="Mistral API key is missing. Please configure it in settings.")
        llm_client = mistral_client
        selected_llm_model = db_user_settings["selected_llm_model"]
        api_key = db_user_settings["mistral_api_key"]
    else:
        raise HTTPException(status_code=400, detail="Unsupported LLM provider configured.")
    main_llm_context = {}
    main_llm_prompt_template = jinja_env.from_string("""
System: You are {{ai_persona_card.name}}. Your personality is {{ai_persona_card.description}} and your instructions are: {{ai_persona_card.instructions}}.

{% if world_context_name_and_description %}
World Context: {{world_context_name_and_description}}
{% endif %}

{% if reranked_lore_entries %}
Relevant Lore (from RAG):
{% for lore in reranked_lore_entries %}
- {{lore.text}}
{% endfor %}
{% endif %}

Recent Chat History (last {{ chat_history_formatted | length }} messages):
{{chat_history_formatted}}

User ({{user_persona_details.name}}): {{user_input}}
{{ai_persona_card.name}}:
""")
    # --- 1. Fetch ChatSession, UserSettings, Card, and SessionCacheFacts ---
    db_chat_session = db.query(ChatSession).options(joinedload(ChatSession.user_persona)).filter(ChatSession.id == chat_id).first()
    if not db_chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    user_settings = db.query(UserSettings).filter(UserSettings.id == USER_SETTINGS_ID).first()
    if not user_settings:
        raise HTTPException(status_code=500, detail="User settings not found.")
    ai_persona_card = None
    if db_chat_session.card_type == "character":
        ai_persona_card = db.query(CharacterCard).filter(CharacterCard.id == db_chat_session.card_id).first()
    elif db_chat_session.card_type == "scenario":
        ai_persona_card = db.query(ScenarioCard).filter(ScenarioCard.id == db_chat_session.card_id).first()
    if not ai_persona_card:
        raise HTTPException(status_code=404, detail=f"{db_chat_session.card_type.capitalize()} card not found for session.")
    ai_persona_card_info = AIPersonaCardInfo.model_validate(ai_persona_card)
    main_llm_context["ai_persona_card"] = ai_persona_card_info
    user_persona = db_chat_session.user_persona
    if not user_persona:
        user_persona = db.query(UserPersona).filter(UserPersona.name == "User").first()
        if not user_persona:
            logger.warning("Default 'User' persona not found. Creating a placeholder for LLM context.")
            class PlaceholderUserPersona:
                name = "User"
                description = "A generic user."
                image_url = None
            user_persona = PlaceholderUserPersona()
    main_llm_context["user_persona_details"] = user_persona
    user_persona_name = user_persona.name if user_persona else "User"
    user_persona_description = user_persona.description if user_persona else "A generic user."
    session_cache_facts = db.query(SessionCacheFact).filter(SessionCacheFact.chat_session_id == chat_id).all()
    current_panel_data = {fact.key: fact.value for fact in session_cache_facts}
    db_user_message = ChatMessage(
        chat_session_id=chat_id,
        sender_type="USER",
        content=user_message_input.content
    )
    if db_chat_session.user_persona:
        db_user_message.active_persona_name = db_chat_session.user_persona.name
        db_user_message.active_persona_image_url = db_chat_session.user_persona.image_url
    db.add(db_user_message)
    db_chat_session.last_active_at = datetime.utcnow()
    db.commit()
    db.refresh(db_user_message)
    # Fetch chat history for LLM context
    messages_for_llm_context = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_session_id == chat_id)
        .order_by(ChatMessage.timestamp.asc())
        .limit(db_user_settings["max_messages_for_context"])
        .all()
    )
    chat_history_formatted = ""
    card_name_for_prompt = ai_persona_card.name if ai_persona_card else "AI"
    for msg in messages_for_llm_context[:-1]: # Exclude the current user message
        if msg.sender_type == "USER":
            sender_name = "User"
        else:
            sender_name = getattr(msg, "active_persona_name", None) or card_name_for_prompt
        chat_history_formatted += f"{sender_name}: {msg.content}\n"
    # --- Query Transformation Step (Extraction LLM) ---
    query_transform_service = QueryTransformationService(openrouter_client)
    optimized_query_text = user_message_input.content # Default in case of failure
    try:
        if db_user_settings["extraction_llm_model"] and db_user_settings["primary_llm_api_key"]:
            optimized_query_text = await query_transform_service.transform_query(
                user_message_input.content,
                model=db_user_settings["extraction_llm_model"],
                api_key=db_user_settings["primary_llm_api_key"]
            )
            logger.info(f"Optimized query text: {optimized_query_text}")
        else:
            logger.warning("Extraction LLM model or API key not configured. Skipping query transformation.")
    except Exception as e:
        logger.error(f"Query transformation failed, using raw message: {e}")
        optimized_query_text = user_message_input.content
    # Prepare query for reranking, including last 4 messages
    reranker_query_parts = []
    reranker_query_parts.append(optimized_query_text)
    query_text_for_reranker = " ".join(reranker_query_parts)
    logger.info(f"Reranker query text (user only): {query_text_for_reranker}")
    # --- RAG Pipeline ---
    retrieved_lore_entries_context = ""
    reranked_lore_entries = []
    try:
        mistral_api_key = db_user_settings["mistral_api_key"]
        if not mistral_api_key:
            logger.warning("Mistral API key is not configured. Skipping LoreEntry embedding search.")
        else:
            query_embedding = mistral_client.create_embeddings([query_text_for_reranker], api_key=mistral_api_key)
            if query_embedding and len(query_embedding) > 0:
                query_embedding_vector = query_embedding[0]
                top_n_faiss_candidates = 100
                similar_lore_entry_ids_with_distances = faiss_index.search_similar(query_embedding_vector, k=top_n_faiss_candidates)
                if similar_lore_entry_ids_with_distances:
                    lore_entry_ids = [id for id, _ in similar_lore_entry_ids_with_distances]
                    candidate_lore_entries = db.query(LoreEntryModel).filter(LoreEntryModel.id.in_(lore_entry_ids)).all()
                    candidate_lore_entries_map = {str(le.id): le for le in candidate_lore_entries}
                    session_mods = db.query(SessionLoreModification).filter(SessionLoreModification.chat_session_id == chat_id).all()
                    mod_map = {}
                    for mod in session_mods:
                        if mod.base_lore_entry_id not in mod_map:
                            mod_map[mod.base_lore_entry_id] = {}
                        mod_map[mod.base_lore_entry_id][mod.field_to_update] = mod.new_content_segment
                    ordered_candidate_texts_for_reranking = []
                    ordered_lore_entries_for_reranking = []
                    for le_id, _ in similar_lore_entry_ids_with_distances:
                        if str(le_id) in candidate_lore_entries_map:
                            lore_entry = candidate_lore_entries_map[str(le_id)]
                            if str(le_id) in mod_map:
                                for field, new_val in mod_map[str(le_id)].items():
                                    setattr(lore_entry, field, new_val)
                            ordered_lore_entries_for_reranking.append(lore_entry)
                            ordered_candidate_texts_for_reranking.append(get_text_to_embed_from_lore_entry(lore_entry))
                    if ordered_candidate_texts_for_reranking:
                        logger.info(f"Calling Auxiliary Reranker with {len(ordered_candidate_texts_for_reranking)} documents for chat_id: {chat_id}")
                        auxiliary_reranked_results = auxiliary_rerank_service.rerank(
                            query_text_for_reranker, ordered_candidate_texts_for_reranking, top_n=20
                        )
                        auxiliary_reranked_lore_entries = []
                        text_to_lore_entry_map = {get_text_to_embed_from_lore_entry(le): le for le in ordered_lore_entries_for_reranking}
                        for text, score in auxiliary_reranked_results:
                            if text in text_to_lore_entry_map:
                                auxiliary_reranked_lore_entries.append(text_to_lore_entry_map[text])
                        texts_for_principal_reranker = [
                            get_text_to_embed_from_lore_entry(le) for le in auxiliary_reranked_lore_entries
                        ]
                        if texts_for_principal_reranker:
                            logger.info(f"Calling Principal Reranker with {len(texts_for_principal_reranker)} documents for chat_id: {chat_id}")
                            principal_reranked_results = principal_rerank_service.rerank(
                                query_text_for_reranker, texts_for_principal_reranker
                            )
                            final_reranked_lore_entries = []
                            subset_text_to_lore_entry_map = {
                                get_text_to_embed_from_lore_entry(le): le
                                for le in auxiliary_reranked_lore_entries
                            }
                            for text, score in principal_reranked_results:
                                if text in subset_text_to_lore_entry_map:
                                    final_reranked_lore_entries.append(subset_text_to_lore_entry_map[text])
                            reranked_lore_entries = final_reranked_lore_entries[:db_user_settings.get("max_lore_entries_for_rag", 5)]
                            if reranked_lore_entries:
                                retrieved_lore_entries_context = "\n\nRelevant Lore Entries:\n"
                                for i, le in enumerate(reranked_lore_entries):
                                    retrieved_lore_entries_context += f"- Name: {le.name}\n  Description: {le.description or 'N/A'}\n"
                                    if le.tags:
                                        retrieved_lore_entries_context += f"  Tags: {', '.join(le.tags)}\n"
                                    if le.aliases:
                                        retrieved_lore_entries_context += f"  Aliases: {', '.join(le.aliases)}\n"
                                    if i < len(reranked_lore_entries) - 1:
                                        retrieved_lore_entries_context += "---\n"
                                logger.info(f"Successfully retrieved and reranked {len(reranked_lore_entries)} lore entries using two-stage rereranking.")
                            else:
                                logger.info("No lore entries selected after principal reranking.")
                        else:
                            logger.info("No candidate lore entries passed to principal reranker after auxiliary reranking.")
                    else:
                        logger.info("No candidate lore entries found after FAISS search for auxiliary reranking.")
                else:
                    logger.info("No similar lore entries found in FAISS for the query.")
            else:
                logger.warning("Failed to generate embedding for the user query using Mistral Embed.")
    except Exception as e:
        logger.error(f"Error during RAG process: {e}")
        retrieved_lore_entries_context = "\n\nNote: An error occurred while retrieving relevant lore entries."
    # --- MAIN LLM CALL (non-streaming) ---
    try:
        ai_response_content = await llm_client.get_chat_completion(
            model=selected_llm_model,
            messages=final_llm_messages,
            api_key=api_key,
            temperature=0.7, # Or your desired temperature
            max_tokens=db_user_settings["max_response_tokens"],
            top_p=db_user_settings["top_p"]
        )
        logger.info(f"[LLM-DEBUG] Main LLM RAW RESPONSE for chat_id {chat_id}: {ai_response_content[:200]}...")
    except Exception as e:
        logger.error(f"Main LLM call failed: {e}")
        ai_response_content = "I'm sorry, but I encountered an error while generating my response."

    # Ensure persona name/image always set (fallback to card/scenario or hardcoded default)
    persona_name = ai_persona_card_info.name or getattr(ai_persona_card, 'name', None) or "AI"
    persona_image_url = ai_persona_card_info.image_url or getattr(ai_persona_card, 'image_url', None) or "/static/images/default_ai.png"
    db_ai_message = ChatMessage(
        chat_session_id=chat_id,
        sender_type="AI",
        content=ai_response_content,
        active_persona_name=persona_name,
        active_persona_image_url=persona_image_url
    )
    db.add(db_ai_message)
    db.commit()
    db.refresh(db_ai_message)

    # Trigger full analysis synchronously (blocking response until analysis is complete)
    try:
        logger.info(f"[LLM-DEBUG] Triggering full interaction analysis for chat_id: {chat_id} with user_message: {user_message_input.content[:100]}... ai_response: {ai_response_content[:100]}...")
        if hasattr(user_persona, "name") and hasattr(user_persona, "description"):
            user_persona_data = {
                "name": user_persona.name,
                "description": user_persona.description,
                "image_url": getattr(user_persona, "image_url", None)
            }
        else:
            user_persona_data = {
                "name": "User",
                "description": "A generic user",
                "image_url": None
            }
        last_9_messages = []
        if len(messages_for_llm_context) > 0:
            for msg in messages_for_llm_context[-9:-1]:
                last_9_messages.append({
                    "sender_type": msg.sender_type,
                    "content": msg.content,
                    "active_persona_name": getattr(msg, "active_persona_name", None)
                })
            user_msg = messages_for_llm_context[-1]
            last_9_messages.append({
                "sender_type": user_msg.sender_type,
                "content": user_msg.content,
                "active_persona_name": getattr(user_msg, "active_persona_name", None)
            })
        
        # Call the synchronous full analysis function
        await run_full_interaction_analysis(
            db=db, # Pass the current DB session
            chat_id=str(chat_id),
            user_message=user_message_input.content,
            ai_response=ai_response_content,
            rag_results=[{"text": get_text_to_embed_from_lore_entry(entry)} for entry in reranked_lore_entries], # Pass processed lore entries
            ai_plan=None, # Removed ai_plan
            ai_persona_card_data={
                "id": str(ai_persona_card.id),
                "name": ai_persona_card.name,
                "description": ai_persona_card.description,
                "instructions": getattr(ai_persona_card, 'instructions', None)
            },
            user_persona_data=user_persona_data,
            analysis_llm_api_key=db_user_settings.get("analysis_llm_api_key", None), # Use analysis_llm_api_key
            analysis_llm_model=db_user_settings.get("analysis_llm_model", "") # Use analysis_llm_model
        )
        logger.info(f"Full interaction analysis completed synchronously for chat_id: {chat_id}")
    except Exception as e:
        logger.error(f"Failed to complete synchronous interaction analysis: {str(e)}")
    
    persona_info = {
        "active_persona_name": persona_name,
        "active_persona_image_url": persona_image_url,
        "message_id": str(db_ai_message.id),
        "timestamp": db_ai_message.timestamp.isoformat() if hasattr(db_ai_message, 'timestamp') else None,
        "panel_data_update": None, # Removed panel_data_update
        "rendered_panel_string": None, # Removed rendered_panel_string
        "display_panel_in_response": False, # Removed display_panel_in_response
    }
    persona_info = replace_jinja_undefined(persona_info)
    # Return a ChatTurnResponse object
    return ChatTurnResponse(
        user_message=ChatMessageInDB.model_validate(db_user_message),
        ai_message=ChatMessageInDB.model_validate(db_ai_message),
        ai_plan=None, # Removed ai_plan
        panel_data_update=persona_info["panel_data_update"],
        rendered_panel_string=persona_info["rendered_panel_string"],
        display_panel_in_response=persona_info["display_panel_in_response"],
        ai_persona_card=ai_persona_card_info
    )
