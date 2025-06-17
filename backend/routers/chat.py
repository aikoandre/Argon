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
# MistralClient removed - now using LiteLLM service for embeddings
from backend.services.rerank_service import get_auxiliary_rerank_service, get_principal_rerank_service
from backend.schemas.event import FixedEventData
from backend.background_tasks import run_full_interaction_analysis
from backend.services.synchronous_memory_service import SynchronousMemoryService
from backend.services.composite_document_service import CompositeDocumentService

from backend.services.query_transformation_service import QueryTransformationService
from backend.services.litellm_service import litellm_service # Import LiteLLM service

logger = logging.getLogger(__name__)

# Safe JSON encoding function to handle Jinja2 Undefined objects
def safe_json_dumps(obj, **kwargs):
    """Safe JSON encoder that handles Jinja2 Undefined objects"""
    class SafeJSONEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, Undefined):
                return None
            return super().default(obj)
    
    return SafeJSONEncoder(**kwargs).encode(obj)

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
# Removed SessionCacheFact and SessionLoreModification - replaced by SessionNote system
from backend.services.event_manager_service import EventManagerService
from backend.models.session_relationship import SessionRelationship
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
# mistral_client removed - now using LiteLLM service for embeddings
auxiliary_rerank_service = get_auxiliary_rerank_service()
principal_rerank_service = get_principal_rerank_service()
composite_document_service = CompositeDocumentService()

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
    sender_type: Optional[str] = None
    user_persona_id: Optional[str] = None
    current_beginning_message_index: Optional[int] = None
    reasoning_mode: Optional[str] = None
    reasoning_effort: Optional[str] = None
    message_metadata: Optional[dict] = None
    active_persona_name: Optional[str] = None
    active_persona_image_url: Optional[str] = None

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
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
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
        # Legacy configuration
        "llm_provider": db_user_settings_obj.llm_provider,
        "primary_llm_api_key": db_user_settings_obj.primary_llm_api_key,
        "analysis_llm_api_key": db_user_settings_obj.analysis_llm_api_key,
        "selected_llm_model": db_user_settings_obj.selected_llm_model,
        "mistral_api_key": db_user_settings_obj.mistral_api_key,
        "max_messages_for_context": db_user_settings_obj.max_messages_for_context,
        "analysis_llm_model": getattr(db_user_settings_obj, "analysis_llm_model", None),
        
        # New LiteLLM configuration
        "primary_llm_provider": getattr(db_user_settings_obj, "primary_llm_provider", None),
        "primary_llm_model": getattr(db_user_settings_obj, "primary_llm_model", None),
        "primary_llm_api_key_new": getattr(db_user_settings_obj, "primary_llm_api_key_new", None),
        "analysis_llm_provider": getattr(db_user_settings_obj, "analysis_llm_provider", None),
        "analysis_llm_model_new": getattr(db_user_settings_obj, "analysis_llm_model_new", None),
        "analysis_llm_api_key_new": getattr(db_user_settings_obj, "analysis_llm_api_key_new", None),
        "maintenance_llm_provider": getattr(db_user_settings_obj, "maintenance_llm_provider", None),
        "maintenance_llm_model": getattr(db_user_settings_obj, "maintenance_llm_model", None),
        "maintenance_llm_api_key": getattr(db_user_settings_obj, "maintenance_llm_api_key", None),
        "embedding_llm_provider": getattr(db_user_settings_obj, "embedding_llm_provider", None),
        "embedding_llm_model": getattr(db_user_settings_obj, "embedding_llm_model", None),
        "embedding_llm_api_key": getattr(db_user_settings_obj, "embedding_llm_api_key", None),
        
        # Other settings
        "top_p": getattr(db_user_settings_obj, "top_p", 1.0),
        "max_response_tokens": getattr(db_user_settings_obj, "max_response_tokens", 512),
    }
    # LiteLLM service will handle provider routing internally
    # Validate that primary LLM settings are configured
    if not db_user_settings.get("primary_llm_api_key") and not db_user_settings.get("primary_llm_api_key_new"):
        raise HTTPException(status_code=500, detail="Primary LLM API key is missing. Please configure it in settings.")
    
    if not db_user_settings.get("selected_llm_model") and not db_user_settings.get("primary_llm_model"):
        raise HTTPException(status_code=500, detail="Primary LLM model is missing. Please configure it in settings.")
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
    
    # TODO: Replace with SessionNote system - temporary placeholder
    current_panel_data = {}  # Empty panel data until SessionNote system implemented
    
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
    # --- Query Transformation Step (Analysis LLM) ---
    query_transform_service = QueryTransformationService()
    optimized_query_text = user_message_input.content # Default in case of failure
    try:
        if db_user_settings.get("analysis_llm_model") and (db_user_settings.get("analysis_llm_api_key") or db_user_settings.get("analysis_llm_api_key_new")):
            # Determine provider and API key for analysis LLM
            analysis_provider = db_user_settings.get("analysis_llm_provider", "openrouter").lower()
            analysis_api_key = db_user_settings.get("analysis_llm_api_key_new") or db_user_settings.get("analysis_llm_api_key")
            analysis_model = db_user_settings.get("analysis_llm_model_new") or db_user_settings.get("analysis_llm_model")
            
            optimized_query_text = await query_transform_service.transform_query(
                user_message_input.content,
                model=analysis_model,
                api_key=analysis_api_key,
                provider=analysis_provider
            )
            logger.info(f"Optimized query text: {optimized_query_text}")
        else:
            logger.warning("Analysis LLM model or API key not configured. Skipping query transformation.")
    except Exception as e:
        logger.error(f"Query transformation failed, using raw message: {e}")
        optimized_query_text = user_message_input.content
    # Prepare query for reranking, including last 4 messages
    reranker_query_parts = []
    reranker_query_parts.append(optimized_query_text)
    query_text_for_reranker = " ".join(reranker_query_parts)
    logger.info(f"Reranker query text (user only): {query_text_for_reranker}")
    # --- RAG Pipeline with Composite Documents (Phase 4) ---
    retrieved_lore_entries_context = ""
    reranked_lore_entries = []
    try:
        # Use LiteLLM service for embeddings instead of direct Mistral client
        try:
            # Get embedding using LiteLLM service
            embedding_response = await litellm_service.get_service_completion(
                service_type="embedding",
                messages=[],  # Not used for embedding
                user_settings=db_user_settings,
                input_text=query_text_for_reranker
            )
            if embedding_response and len(embedding_response) > 0:
                query_embedding_vector = embedding_response[0]
                top_n_faiss_candidates = 100
                similar_lore_entry_ids_with_distances = faiss_index.search_similar(query_embedding_vector, k=top_n_faiss_candidates)
                if similar_lore_entry_ids_with_distances:
                    lore_entry_ids = [id for id, _ in similar_lore_entry_ids_with_distances]
                    
                    # Phase 4: Create composite documents with SessionNote priority
                    logger.info(f"Creating composite documents for {len(lore_entry_ids)} entities with SessionNote integration")
                    composite_docs = []
                    
                    for le_id, _ in similar_lore_entry_ids_with_distances:
                        composite_doc = await composite_document_service.create_composite_document(
                            db=db,
                            lore_entry_id=str(le_id),
                            session_id=chat_id
                        )
                        if composite_doc:
                            composite_docs.append(composite_doc)
                    
                    if composite_docs:
                        # Extract texts from composite documents for reranking
                        composite_texts_for_reranking = [doc.composite_text for doc in composite_docs]
                        
                        logger.info(f"Calling Auxiliary Reranker with {len(composite_texts_for_reranking)} composite documents for chat_id: {chat_id}")
                        auxiliary_reranked_results = auxiliary_rerank_service.rerank(
                            query_text_for_reranker, composite_texts_for_reranking, top_n=20
                        )
                        
                        # Map reranked texts back to composite documents
                        auxiliary_reranked_composite_docs = []
                        text_to_composite_doc_map = {doc.composite_text: doc for doc in composite_docs}
                        for text, score in auxiliary_reranked_results:
                            if text in text_to_composite_doc_map:
                                auxiliary_reranked_composite_docs.append(text_to_composite_doc_map[text])
                        
                        # Second stage reranking with principal reranker
                        texts_for_principal_reranker = [doc.composite_text for doc in auxiliary_reranked_composite_docs]
                        if texts_for_principal_reranker:
                            logger.info(f"Calling Principal Reranker with {len(texts_for_principal_reranker)} composite documents for chat_id: {chat_id}")
                            principal_reranked_results = principal_rerank_service.rerank(
                                query_text_for_reranker, texts_for_principal_reranker
                            )
                            
                            # Get final ranked composite documents
                            final_reranked_composite_docs = []
                            subset_text_to_composite_doc_map = {doc.composite_text: doc for doc in auxiliary_reranked_composite_docs}
                            for text, score in principal_reranked_results:
                                if text in subset_text_to_composite_doc_map:
                                    final_reranked_composite_docs.append(subset_text_to_composite_doc_map[text])
                            
                            # Limit to max entries and generate context
                            max_entries = db_user_settings.get("max_lore_entries_for_rag", 5)
                            final_composite_docs = final_reranked_composite_docs[:max_entries]
                            
                            if final_composite_docs:
                                # Use CompositeDocumentService to generate optimized RAG context
                                retrieved_lore_entries_context = composite_document_service.get_rag_context_from_composite_docs(
                                    final_composite_docs, 
                                    max_context_length=8000
                                )
                                
                                # Extract LoreEntries for legacy compatibility
                                reranked_lore_entries = [doc.lore_entry for doc in final_composite_docs]
                                
                                logger.info(f"Successfully retrieved {len(final_composite_docs)} composite documents with SessionNote integration.")
                                logger.info(f"Context generated: {len(retrieved_lore_entries_context)} characters")
                            else:
                                logger.info("No composite documents selected after principal reranking.")
                        else:
                            logger.info("No composite documents passed to principal reranker after auxiliary reranking.")
                    else:
                        logger.info("No composite documents created from FAISS search results.")
                else:
                    logger.info("No similar lore entries found in FAISS for the query.")
            else:
                logger.warning("Failed to generate embedding for the user query using LiteLLM service.")
        except Exception as embedding_error:
            logger.error(f"Error during embedding generation: {embedding_error}")
            logger.warning("Failed to generate embedding for the user query using LiteLLM service.")
    except Exception as e:
        logger.error(f"Error during RAG process: {e}")
        retrieved_lore_entries_context = "\n\nNote: An error occurred while retrieving relevant lore entries."
    
    # --- TEMPLATE RENDERING AND MESSAGE CONSTRUCTION ---
    # Prepare context for the main generation template
    from backend.services.event_manager_service import EventManagerService
    from backend.models.user_prompt_instructions import UserPromptInstructions
    from backend.services.message_preprocessing_service import MessagePreprocessingService
    
    # Get user prompt instructions
    user_prompt_instructions = db.query(UserPromptInstructions).first()
    if not user_prompt_instructions:
        # Create default empty instructions
        class DefaultInstructions:
            primary_instructions = None
            analysis_instructions = None 
            extraction_instructions = None
        user_prompt_instructions = DefaultInstructions()
    
    # Get active events for this session
    active_events = db.query(ActiveSessionEvent).filter(
        ActiveSessionEvent.chat_session_id == chat_id
    ).all()
    
    # Process user message for placeholder replacement and OOC detection
    preprocessing_service = MessagePreprocessingService()
    ai_character_name = preprocessing_service.get_ai_character_name(ai_persona_card)
    user_persona_name = preprocessing_service.get_user_persona_name(user_persona)
    preprocessed_message = preprocessing_service.preprocess_user_message(
        user_message_input.content, ai_character_name, user_persona_name
    )
    
    # Build context for main generation template
    main_llm_context = {
        "ai_persona_card": ai_persona_card_info,
        "user_persona": {
            "name": user_persona_name,
            "description": user_persona_description
        },
        "user_input": preprocessed_message.content,
        "chat_history_formatted": chat_history_formatted.strip(),
        "reranked_lore_entries": [
            {
                "id": getattr(entry, 'id', ''),
                "name": getattr(entry, 'name', ''),
                "description": getattr(entry, 'description', ''),
                "entry_type": getattr(entry, 'entry_type', ''),
                "text": get_text_to_embed_from_lore_entry(entry)
            } for entry in reranked_lore_entries
        ],
        "current_panel_data": current_panel_data,
        "active_events": active_events,
        "user_prompt_instructions": user_prompt_instructions,
        "reasoning_model_available": False,  # Add this to prevent template errors
    }
    
    main_llm_context = replace_jinja_undefined(main_llm_context)
    
    # Load and render the generation template
    try:
        main_llm_prompt_template = jinja_env.get_template('main_generation_enhanced.jinja2')
        final_full_prompt = main_llm_prompt_template.render(main_llm_context)
        logger.info(f"[Template] Successfully rendered template for chat_id: {chat_id}")
    except Exception as template_error:
        logger.error(f"[Template] Error rendering template: {template_error}")
        # Fallback to simple prompt
        final_full_prompt = f"""You are {ai_persona_card_info.name}.
Personality: {ai_persona_card_info.description}
Instructions: {ai_persona_card_info.instructions}

User ({user_persona_name}): {preprocessed_message.content}
{ai_persona_card_info.name}:"""
    
    # Construct final messages for LLM
    if preprocessed_message.is_ooc:
        ooc_system_prompt = f"""You are an AI assistant helping with roleplay management. The user has sent an out-of-character (OOC) message.

Original character context: {ai_persona_card_info.name} - {ai_persona_card_info.description}

Respond helpfully to their OOC request without staying in character."""
        final_llm_messages = [
            {"role": "system", "content": ooc_system_prompt},
            {"role": "user", "content": f"[OOC] {preprocessed_message.ooc_content}"}
        ]
    else:
        final_llm_messages = [
            {"role": "system", "content": final_full_prompt},
            {"role": "user", "content": preprocessed_message.content}
        ]
    
    # --- MAIN LLM CALL (non-streaming) ---
    try:
        logger.info(f"[LLM] Starting LLM call for chat_id: {chat_id}")
        
        # Use LiteLLM service for primary LLM generation
        response = await litellm_service.get_service_completion(
            service_type="primary",
            messages=final_llm_messages,
            user_settings=db_user_settings,
            temperature=0.7,
            max_tokens=db_user_settings["max_response_tokens"],
            top_p=db_user_settings["top_p"]
        )
        
        # Extract content from LiteLLM response
        if isinstance(response, dict) and "choices" in response:
            ai_response_content = response["choices"][0]["message"]["content"]
        else:
            ai_response_content = str(response)
        logger.info(f"[LLM] Successfully generated response for chat_id: {chat_id}")
    except ImportError as ie:
        logger.error(f"[LLM] Missing LiteLLM service dependency: {ie}")
        ai_response_content = "I'm sorry, but the language model service is not available. Please check the system configuration."
    except AttributeError as ae:
        logger.error(f"[LLM] LiteLLM service method missing: {ae}")
        ai_response_content = "I'm sorry, but there was a configuration issue with the language model service."
    except Exception as e:
        logger.error(f"[LLM] Main LLM call failed: {e}")
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

    # Trigger synchronous memory processing (blocks response until complete)
    # Wrap in try-catch to prevent 500 errors if memory processing fails
    try:
        logger.info(f"[SynchronousMemory] Starting memory processing for chat_id: {chat_id}")
        
        # Initialize synchronous memory service
        memory_service = SynchronousMemoryService()
        
        # Get turn number (count of messages in session)
        turn_number = db.query(ChatMessage).filter(ChatMessage.chat_session_id == chat_id).count()
        
        # Prepare turn context for analysis
        turn_context = {
            "user_message": user_message_input.content,
            "ai_response": ai_response_content,
            "rag_context": "\n".join([get_text_to_embed_from_lore_entry(entry) for entry in reranked_lore_entries]),
            "chat_history": [
                {"sender": msg.sender_type, "content": msg.content}
                for msg in messages_for_llm_context[-5:]  # Last 5 messages for context
            ]
        }
        
        # Get master_world_id from the associated card
        master_world_id = None
        if hasattr(db_chat_session, 'master_world_id') and db_chat_session.master_world_id:
            master_world_id = str(db_chat_session.master_world_id)
        elif ai_persona_card and hasattr(ai_persona_card, 'master_world_id') and ai_persona_card.master_world_id:
            master_world_id = str(ai_persona_card.master_world_id)
        
        # Process memory updates synchronously (with fallback to continue on failure)
        memory_result = await memory_service.process_turn_memory_updates(
            db=db,
            session_id=str(chat_id),
            turn_number=turn_number,
            turn_context=turn_context,
            user_settings=db_user_settings,
            master_world_id=master_world_id,
            reasoning_mode=user_message_input.reasoning_mode or "default",
            reasoning_effort=user_message_input.reasoning_effort or "standard"
        )
        
        if memory_result.success:
            logger.info(f"[SynchronousMemory] Completed {memory_result.successful_operations}/{memory_result.total_operations} operations for chat_id: {chat_id}")
        else:
            logger.error(f"[SynchronousMemory] Failed: {memory_result.error_message}")
        
    except ImportError as ie:
        logger.warning(f"[SynchronousMemory][IMPORT_ERROR] Memory service dependencies missing: {str(ie)}")
        logger.info(f"[SynchronousMemory] Continuing without memory processing for chat_id: {chat_id}")
    except AttributeError as ae:
        logger.warning(f"[SynchronousMemory][ATTR_ERROR] Memory service method missing: {str(ae)}")
        logger.info(f"[SynchronousMemory] Continuing without memory processing for chat_id: {chat_id}")
    except Exception as e:
        logger.error(f"[SynchronousMemory][ERROR] Failed to complete memory processing: {str(e)}")
        logger.info(f"[SynchronousMemory] Continuing with response generation for chat_id: {chat_id}")
        # Continue with response even if memory processing fails
    
    # Return a ChatTurnResponse object with only the fields that exist in the schema
    try:
        return ChatTurnResponse(
            user_message=ChatMessageInDB.model_validate(db_user_message),
            ai_message=ChatMessageInDB.model_validate(db_ai_message),
            ai_persona_card=ai_persona_card_info
        )
    except Exception as response_error:
        logger.error(f"[Response] Error creating ChatTurnResponse: {response_error}")
        # Return a minimal response if validation fails
        return {
            "user_message": {
                "id": str(db_user_message.id),
                "chat_session_id": str(db_user_message.chat_session_id),
                "sender_type": db_user_message.sender_type,
                "content": db_user_message.content,
                "timestamp": db_user_message.timestamp.isoformat()
            },
            "ai_message": {
                "id": str(db_ai_message.id),
                "chat_session_id": str(db_ai_message.chat_session_id),
                "sender_type": db_ai_message.sender_type,
                "content": ai_response_content,
                "timestamp": db_ai_message.timestamp.isoformat()
            },
            "ai_persona_card": {
                "id": ai_persona_card_info.id,
                "name": ai_persona_card_info.name,
                "image_url": ai_persona_card_info.image_url,
                "description": ai_persona_card_info.description,
                "instructions": ai_persona_card_info.instructions
            }
        }
