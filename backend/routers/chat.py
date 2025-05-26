# backend/routers/chat.py
import logging # New import
from fastapi import APIRouter, Depends, HTTPException, status, Body, Path
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid # Para gerar IDs de sessão se necessário (embora o modelo já faça isso)
from datetime import datetime # For updating last_active_at
from pydantic import BaseModel, Field
from fastapi.concurrency import run_in_threadpool
import json # New import for JSON handling
from jinja2 import Environment, FileSystemLoader # New import for Jinja2

logger = logging.getLogger(__name__) # New logger instance

# Importe modelos SQLAlchemy
from backend.models.chat_session import ChatSession
from backend.models.chat_message import ChatMessage
from backend.models.user_settings import UserSettings
from backend.schemas.ai_plan import AIPlan, PanelData
from backend.schemas.ai_analysis_result import InteractionAnalysisResult, NewFact, RelationshipChange, SessionLoreUpdate, UserPersonaSessionUpdate, DynamicallyGeneratedNPC # New imports
from backend.models.session_cache_fact import SessionCacheFact # New import
from backend.models.session_relationship import SessionRelationship # New import
from backend.models.session_lore_modification import SessionLoreModification # New import
from backend.models.user_persona import UserPersona
from backend.models.character_card import CharacterCard
from backend.models.scenario_card import ScenarioCard
from backend.models.master_world import MasterWorld

# Import LLM Clients
from backend.services.mistral_client import MistralClient
from backend.services.openrouter_client import OpenRouterClient # New import
from backend.services.faiss_service import get_faiss_index # New import
from backend.services.rerank_service import get_principal_rerank_service, get_auxiliary_rerank_service # Updated import for two rerankers
# from backend.services.query_transform_llm import QueryTransformLLM # Future: for query optimization

# Import Models for ExtractedKnowledge
from backend.models.extracted_knowledge import ExtractedKnowledge # New import
from backend.models.lore_entry import LoreEntry as LoreEntryModel # New import for LoreEntry model

# Import Schemas for ExtractedKnowledge
from backend.schemas.extracted_knowledge import ExtractedKnowledgeCreate, ExtractedKnowledgeInDB # New import

# Initialize LLM Clients and Services
mistral_client = MistralClient()
openrouter_client = OpenRouterClient() # Initialize OpenRouterClient
faiss_index = get_faiss_index()
principal_rerank_service = get_principal_rerank_service()
auxiliary_rerank_service = get_auxiliary_rerank_service()
# query_transform_llm = QueryTransformLLM() # Future: Initialize Query Transformation LLM

# Initialize Jinja2 Environment for prompt templating
# Assuming templates might be in a 'templates' directory relative to backend, or defined inline
# For now, we'll use Environment(loader=FileSystemLoader('.')) and define templates inline for simplicity
# If templates become files, adjust FileSystemLoader path.
jinja_env = Environment(loader=FileSystemLoader('./backend/templates'), trim_blocks=True, lstrip_blocks=True)


# Importe schemas Pydantic
from backend.schemas.chat_session import ChatSessionCreate, ChatSessionInDB, ChatSessionUpdate, ChatSessionListed
from backend.schemas.chat_message import ChatMessageCreate, ChatMessageInDB, ChatTurnResponse # New import

from backend.database import get_db
from backend.db.crud import create_chat_session as crud_create_chat_session

# Helper function for RAG
def get_text_to_embed_from_lore_entry(lore_entry: LoreEntryModel) -> str:
    """Prioritizes summary for embedding, falls back to content."""
    return lore_entry.summary or lore_entry.content or ""

# For UserMessageCreate, using a Pydantic model for the body is cleaner
class UserMessageInput(BaseModel):
    content: str = Field(..., min_length=1)
    user_persona_id: Optional[str] = None
    current_beginning_message_index: Optional[int] = None # New field


router = APIRouter(
    tags=["Chat"],
    responses={404: {"description": "Not found"}},
)

USER_SETTINGS_ID = 1 # Global ID for the single settings row

# Change card_id type from UUID to str for compatibility with string IDs in the database
@router.post("/sessions/{card_type}/{card_id}", response_model=ChatSessionInDB, status_code=status.HTTP_201_CREATED)
def create_or_get_chat_session(
    card_type: str,
    card_id: str,  # Changed from UUID to str
    user_persona_id: Optional[str] = None, # Add this parameter
    db: Session = Depends(get_db)
):
    """Create or get existing chat session for a card"""
    # Validate card type
    if card_type not in {"character", "scenario"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid card type. Must be 'character' or 'scenario'"
        )
    
    # Debug logging for troubleshooting
    # Debug logging for troubleshooting
    if card_type == "character":
        card = db.query(CharacterCard).filter(CharacterCard.id == str(card_id)).first()
    else:
        card = db.query(ScenarioCard).filter(ScenarioCard.id == str(card_id)).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{card_type.capitalize()} with id {card_id} not found"
        )
    
    # Find existing session based on card_type and card_id, ordered by last_active_at (most recent)
    existing_session = db.query(ChatSession).filter(
        ChatSession.card_type == card_type,
        ChatSession.card_id == str(card_id)
    ).order_by(ChatSession.last_active_at.desc()).first() # Use last_active_at for "last chat"

    if existing_session:
        logger.info(f"Found existing chat session {existing_session.id} for card {card_id}. Last active: {existing_session.last_active_at}")
        # If a user_persona_id is provided and it's different from the existing session's, update it.
        if user_persona_id is not None and existing_session.user_persona_id != user_persona_id:
            logger.info(f"Updating user_persona_id for existing session {existing_session.id} from {existing_session.user_persona_id} to {user_persona_id}")
            existing_session.user_persona_id = user_persona_id
            db.add(existing_session)
            db.commit()
            db.refresh(existing_session)
        return existing_session

    # If no existing session found, proceed to create a new one.
    final_user_persona_id = user_persona_id
    if final_user_persona_id is None:
        default_user_persona = db.query(UserPersona).filter(UserPersona.name == "User").first()
        if default_user_persona:
            final_user_persona_id = str(default_user_persona.id)
        else:
            logger.warning("No user persona ID provided and default 'User' persona not found. Creating session with no linked persona.")
            final_user_persona_id = None

    # Create new session
    # Use .name for scenario, .name for character
    title = f"Chat with {card.name if card_type == 'character' else card.name}"
    new_chat = ChatSession(
        card_type=card_type,
        card_id=str(card_id),
        title=title,
        user_persona_id=final_user_persona_id # Pass the resolved user_persona_id
    )
    
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)

    # Add initial AI message if beginning_messages exist
    beginning_messages = []
    if card_type == "character" and hasattr(card, 'beginning_messages') and card.beginning_messages:
        beginning_messages = card.beginning_messages
    elif card_type == "scenario" and hasattr(card, 'beginning_message') and card.beginning_message:
        beginning_messages = card.beginning_message

    if beginning_messages:
        # Create the first AI message from the beginning_messages
        initial_ai_message_content = beginning_messages[0]
        
        # Prepare all beginning messages for ai_responses
        all_ai_responses = [
            {"content": msg, "timestamp": datetime.utcnow().isoformat()}
            for msg in beginning_messages
        ]

        initial_ai_message = ChatMessage(
            chat_session_id=new_chat.id,
            sender_type="AI",
            content=initial_ai_message_content,
            is_beginning_message=True,
            # Store all beginning messages in message_metadata for frontend navigation
            message_metadata={"ai_responses": all_ai_responses, "current_response_index": 0},
            active_persona_name=card.name, # Use card's name as AI persona name
            active_persona_image_url=card.image_url # Use card's image as AI persona image
        )
        db.add(initial_ai_message)
        db.commit()
        db.refresh(initial_ai_message)

    return new_chat

# Keep old endpoint for compatibility during transition
@router.post("/", response_model=ChatSessionInDB, status_code=status.HTTP_201_CREATED, deprecated=True)
async def create_chat_session_legacy(
    session_create: ChatSessionCreate,
    db: Session = Depends(get_db)
):
    """Legacy endpoint - prefer /sessions/{card_type}/{card_id}"""
    # Convert legacy request to new format
    card_type = "character" if session_create.gm_character_id else "scenario"
    card_id = session_create.gm_character_id or session_create.scenario_id
    
    return create_or_get_chat_session( # Changed to direct call, not await
        card_type=card_type,
        card_id=card_id,
        user_persona_id=session_create.user_persona_id, # Pass user_persona_id from legacy schema
        db=db
    )

    # Use the CRUD function to create the session
    # Ensure your crud_create_chat_session function accepts the ChatSessionCreate schema
    # and handles the optional fields correctly.
    # The crud.py file you provided has a create_chat_session function that uses model_dump(exclude_unset=True),
    # which is correct for handling optional fields.
    db_chat_session = crud_create_chat_session(db=db, chat_session=session_create)

    # Update the title if it was generated
    if not session_create.title and title:
         db_chat_session.title = title
         db.add(db_chat_session) # Mark as dirty
         db.commit() # Commit the title change
         db.refresh(db_chat_session) # Refresh to get the updated title

    return db_chat_session

@router.get("/check", response_model=Optional[ChatSessionInDB])
async def check_existing_session(
    scenario_id: Optional[str] = None,
    gm_character_id: Optional[str] = None,
    user_persona_id: Optional[str] = None, # Keep optional
    db: Session = Depends(get_db)
):
    """
    Checks for an existing chat session based on the provided parameters.
    Returns the session if found, otherwise returns None.
    """
    # Ensure at least one of gm_character_id or scenario_id is provided
    if not gm_character_id and not scenario_id:
         # This case shouldn't happen if frontend logic is correct, but good validation
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either gm_character_id or scenario_id must be provided"
        )

    query = db.query(ChatSession)

    # Filter by scenario_id or gm_character_id (exactly one should be provided by frontend)
    if scenario_id:
        query = query.filter(ChatSession.scenario_id == scenario_id)
    elif gm_character_id: # Use elif to ensure only one filter is applied
        query = query.filter(ChatSession.gm_character_id == gm_character_id)

    # Filter by user_persona_id, handling None explicitly
    if user_persona_id is not None:
        query = query.filter(ChatSession.user_persona_id == user_persona_id)
    else:
        # Explicitly filter for sessions where user_persona_id is NULL
        query = query.filter(ChatSession.user_persona_id.is_(None))

    # Order by last_active_at descending and get the first one
    session = query.order_by(ChatSession.last_active_at.desc()).first()

    # Return the session or None. FastAPI will return 200 with null body if session is None.
    return session

@router.get("", response_model=List[ChatSessionListed])  # Now using proper response model
async def list_chat_sessions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    try:
        # Subquery para contar mensagens do usuário por sessão
        user_message_count_subquery = (
            select(
                ChatMessage.chat_session_id,
                func.count(ChatMessage.id).label("user_message_count")
            )
            .filter(ChatMessage.sender_type == "USER") # Only count user messages
            .group_by(ChatMessage.chat_session_id)
            .subquery()
        )

        # Query principal para sessões de chat, incluindo a contagem de mensagens do usuário
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
                # Start with basic session data
                session_data = {
                    "id": str(session.id),
                    "title": session.title,
                    "last_active_at": session.last_active_at,
                    "card_type": session.card_type,
                    "card_id": str(session.card_id) if session.card_id else None,
                    "card_name": None,
                    "card_image_url": None,
                    "user_message_count": user_message_count if user_message_count is not None else 0 # Adiciona a contagem de mensagens do usuário
                }

                # Get card details based on card_type
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

    # Fetch the associated card to get beginning messages
    card = None
    if db_chat_session.card_type == "character":
        card = db.query(CharacterCard).filter(CharacterCard.id == db_chat_session.card_id).first()
    elif db_chat_session.card_type == "scenario":
        card = db.query(ScenarioCard).filter(ScenarioCard.id == db_chat_session.card_id).first()

    expected_beginning_messages = []
    if card:
        if db_chat_session.card_type == "character" and hasattr(card, 'beginning_messages') and card.beginning_messages:
            expected_beginning_messages = card.beginning_messages
        elif db_chat_session.card_type == "scenario" and hasattr(card, 'beginning_message') and card.beginning_message:
            # Ensure beginning_message is treated as a list for consistency
            expected_beginning_messages = [card.beginning_message] if isinstance(card.beginning_message, str) else card.beginning_message

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_session_id == chat_id)
        .order_by(ChatMessage.timestamp.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


    return messages

@router.post("/{chat_id}/messages", response_model=ChatTurnResponse) # Changed response model
async def post_chat_message(
    chat_id: str = Path(..., title="The ID of the chat session"),
    user_message_input: UserMessageInput = Body(...), # Use the Pydantic model for the body
    db: Session = Depends(get_db)
):
    # Jinja2 template for the main AI response generation LLM
    main_llm_prompt_template = jinja_env.from_string("""
System: You are {{ai_persona_card.name}}. Your personality is {{ai_persona_card.description}} and your instructions are: {{ai_persona_card.instructions}}.
{% if ai_plan %}
Your current plan for this response is:
Goal: {{ai_plan.response_goal}}
Emotional Tone: {{ai_plan.emotional_tone}}
Suggested Action: {{ai_plan.suggested_action}}
Key information to consider from your knowledge: {{ ai_plan.key_info_from_rag_to_highlight | join(' ') }}
Internal thought focus: {{ai_plan.internal_thought_focus}}
{% endif %}

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

    # Jinja2 template for the Planning LLM
    planning_llm_prompt_template = jinja_env.from_string("""
You are an expert AI Roleplaying Game Master's assistant, responsible for planning the AI character's next turn.
Your goal is to create a strategic plan in JSON format based on the provided context.
The AI character you are planning for is:
Name: {{ai_persona_card.name}}
Description: {{ai_persona_card.description}}
Instructions: {{ai_persona_card.instructions}}

The user's persona is:
Name: {{user_persona.name}}
Description: {{user_persona.description}}

Current situation:
User's latest message: "{{user_query_transformed}}"
Relevant Lore (from RAG):
{% for lore in reranked_lore_entries %}
- {{lore.text}}
{% endfor %}

Recent Chat History (last N messages):
{{chat_history_formatted}}

Current Panel Data (if available, otherwise suggest initial/updated values):
Time: {{current_panel_data.current_time | default('Não definido')}}
Date: {{current_panel_data.current_date | default('Não definido')}}
Location: {{current_panel_data.current_location | default('Não definido')}}
{% if active_event_cards %}
Active Event Cards:
{% for event in active_event_cards %}
- Name: {{event.name}}
  Description: {{event.description}}
{% endfor %}
{% endif %}

Based on all this, generate a JSON plan for the AI's response according to the following schema:
{
  "response_goal": "string (e.g., 'Answer the user's question using info from RAG entry X, while maintaining a mysterious demeanor')",
  "emotional_tone": "string (e.g., 'mysterious', 'friendly', 'cautious')",
  "key_info_from_rag_to_highlight": ["string (specific phrase or fact from RAG to use)"],
  "suggested_action": "string (a non-verbal action like '*raises an eyebrow*')",
  "internal_thought_focus": "string (a brief theme for the AI's internal thoughts)",
  "panel_data_update": {
    "current_time": "string (suggested time for the panel)",
    "current_date": "string (suggested date for the panel)",
    "current_location": "string (suggested location for the panel)"
  }
}

Ensure your output is ONLY the valid JSON object.
""")
    # --- 1. Fetch ChatSession and save User's Message ---
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if not db_chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Save user's message
    db_user_message = ChatMessage(
        chat_session_id=chat_id,
        sender_type="USER",
        content=user_message_input.content
        # active_persona_name and active_persona_image_url could be populated from db_chat_session.user_persona
    )
    if db_chat_session.user_persona: # If a persona is linked to the session
        db_user_message.active_persona_name = db_chat_session.user_persona.name
        db_user_message.active_persona_image_url = db_chat_session.user_persona.image_url
        
    db.add(db_user_message)
    db_chat_session.last_active_at = datetime.utcnow() # Update last active time
    db.commit()
    db.refresh(db_user_message)

    # --- 2. Fetch Context Data ---
    # UserSettings
    db_user_settings = db.query(UserSettings).filter(UserSettings.id == USER_SETTINGS_ID).first()
    if not db_user_settings:
        # This should ideally not happen if GET /api/settings/ creates it.
        # Or, create default settings here if they are absolutely mandatory for a chat to proceed.
        raise HTTPException(status_code=500, detail="User settings not configured. Please configure settings first.")

    # UserSettings (already fetched above, removing duplicate)
    # db_user_settings = db.query(UserSettings).filter(UserSettings.id == USER_SETTINGS_ID).first()
    # if not db_user_settings:
    #     raise HTTPException(status_code=500, detail="User settings not configured. Please configure settings first.")

    # Handle dynamic user persona update for the session
    if user_message_input.user_persona_id and db_chat_session.user_persona_id != user_message_input.user_persona_id:
        db_chat_session.user_persona_id = user_message_input.user_persona_id
        db.add(db_chat_session)
        db.commit()
        db.refresh(db_chat_session)
    user_persona_name = "User"
    user_persona_description = ""
    if db_chat_session.user_persona:
        user_persona_name = db_chat_session.user_persona.name
        user_persona_description = db_chat_session.user_persona.description or ""

    ai_persona_card = None
    card_name_for_prompt = "AI" # Default name
    card_description_for_prompt = ""
    card_instructions_for_prompt = ""
    card_example_dialogues_for_prompt = ""
    card_beginning_message_for_prompt = ""

    if db_chat_session.card_type == 'character':
        ai_persona_card = db.query(CharacterCard).filter(CharacterCard.id == db_chat_session.card_id).first()
        if ai_persona_card:
            card_name_for_prompt = ai_persona_card.name
            card_description_for_prompt = ai_persona_card.description or ""
            card_instructions_for_prompt = ai_persona_card.instructions or ""
            card_example_dialogues_for_prompt = str(ai_persona_card.example_dialogues or []) # Convert list to string
            card_beginning_message_for_prompt = str(ai_persona_card.beginning_messages or []) # Convert list to string
    elif db_chat_session.card_type == 'scenario':
        ai_persona_card = db.query(ScenarioCard).filter(ScenarioCard.id == db_chat_session.card_id).first()
        if ai_persona_card:
            card_name_for_prompt = ai_persona_card.name
            card_description_for_prompt = ai_persona_card.description or ""
            card_instructions_for_prompt = ai_persona_card.instructions or ""
            card_example_dialogues_for_prompt = str(ai_persona_card.example_dialogues or []) # Convert list to string
            card_beginning_message_for_prompt = str(ai_persona_card.beginning_message or []) # Convert list to string
            
    if not ai_persona_card:
        raise HTTPException(status_code=404, detail=f"{db_chat_session.card_type.capitalize()} card not found for this session")

    # MasterWorld (if linked to ai_persona_card)
    db_master_world = None
    world_context_for_prompt = "No specific world context provided."
    if ai_persona_card.master_world_id:
        db_master_world = db.query(MasterWorld).filter(MasterWorld.id == ai_persona_card.master_world_id).first()
        if db_master_world:
            world_context_for_prompt = f"World Name: {db_master_world.name}. Description: {db_master_world.description or ''}"
    
    # Chat History for LLM Context
    messages_for_llm_context: List[ChatMessage] = []

    # If current_beginning_message_index is provided, it means this is the first user message
    # after a beginning message was displayed in the frontend.
    # In this case, we only include the *selected* beginning message in the context.
    if user_message_input.current_beginning_message_index is not None:
        all_beginning_messages_from_card = []
        if db_chat_session.card_type == 'character' and hasattr(ai_persona_card, 'beginning_messages') and ai_persona_card.beginning_messages:
            all_beginning_messages_from_card = ai_persona_card.beginning_messages
        elif db_chat_session.card_type == 'scenario' and hasattr(ai_persona_card, 'beginning_message') and ai_persona_card.beginning_message:
            all_beginning_messages_from_card = ai_persona_card.beginning_message

        if 0 <= user_message_input.current_beginning_message_index < len(all_beginning_messages_from_card):
            selected_beginning_message_content = all_beginning_messages_from_card[user_message_input.current_beginning_message_index]
            # Create a temporary ChatMessage object for the context
            temp_beginning_msg = ChatMessage(
                chat_session_id=chat_id,
                sender_type="AI", # Beginning messages are from AI
                content=selected_beginning_message_content,
                timestamp=datetime.utcnow(), # Use current time for context
                active_persona_name=card_name_for_prompt,
                active_persona_image_url=ai_persona_card.image_url if ai_persona_card else None
            )
            messages_for_llm_context.append(temp_beginning_msg)

    # Fetch recent chat messages for context, excluding the current user message
    # We fetch up to MAX_MESSAGES_FOR_CONTEXT messages
    # If a beginning message was just added, we fetch one less to account for it.
    num_messages_to_fetch = (db_user_settings.max_messages_for_context or 20) - len(messages_for_llm_context)
    if num_messages_to_fetch > 0:
        recent_messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.chat_session_id == chat_id)
            .filter(ChatMessage.id != db_user_message.id) # Exclude the current user message
            .order_by(ChatMessage.timestamp.desc())
            .limit(num_messages_to_fetch)
            .all()
        )
        # Reverse to maintain chronological order
        messages_for_llm_context.extend(reversed(recent_messages))

    # Add the current user message to the context
    messages_for_llm_context.append(db_user_message)

    # Optimized Query Text (Phase 3 Advanced - currently user's message)
    # In the future, this would be:
    # optimized_query_text = await query_transform_llm.transform_query(user_message_input.content)
    optimized_query_text = user_message_input.content

    retrieved_lore_entries_context = ""
    reranked_lore_entries = [] # Initialize empty list for reranked lore entries
    try:
        # 3.1 Query Embedding (Mistral Embed API)
        mistral_api_key = db_user_settings.mistral_api_key
        if not mistral_api_key:
            logger.warning("Mistral API key is not configured. Skipping LoreEntry embedding search.")
            # If no API key, proceed without RAG context
        else:
            query_embedding = mistral_client.create_embeddings([optimized_query_text], api_key=mistral_api_key)
            
            if query_embedding and len(query_embedding) > 0:
                query_embedding_vector = query_embedding[0]

                # 3.2 Initial Retrieval (FAISS)
                # Retrieve a larger set of candidates for the two-stage reranking
                top_n_faiss_candidates = 100 # Retrieve a larger set for the auxiliary reranker
                similar_lore_entry_ids_with_distances = faiss_index.search_similar(query_embedding_vector, k=top_n_faiss_candidates)
                
                if similar_lore_entry_ids_with_distances:
                    lore_entry_ids = [id for id, _ in similar_lore_entry_ids_with_distances]
                    
                    # 3.3 Fetch LoreEntry Texts from DB
                    candidate_lore_entries = db.query(LoreEntryModel).filter(LoreEntryModel.id.in_(lore_entry_ids)).all()
                    
                    # Create a dictionary for quick lookup by ID
                    candidate_lore_entries_map = {str(le.id): le for le in candidate_lore_entries}
                    
                    # Ensure order based on FAISS results and get texts for reranking
                    ordered_candidate_texts_for_reranking = []
                    ordered_lore_entries_for_reranking = []
                    for le_id, _ in similar_lore_entry_ids_with_distances:
                        if str(le_id) in candidate_lore_entries_map:
                            lore_entry = candidate_lore_entries_map[str(le_id)]
                            ordered_lore_entries_for_reranking.append(lore_entry)
                            # Use the same function for text prep for reranking
                            ordered_candidate_texts_for_reranking.append(get_text_to_embed_from_lore_entry(lore_entry))
                    
                    if ordered_candidate_texts_for_reranking:
                        # 3.4 Stage 1 Reranking (Auxiliary Reranker)
                        logger.info(f"Calling Auxiliary Reranker with {len(ordered_candidate_texts_for_reranking)} documents for chat_id: {chat_id}")
                        auxiliary_reranked_results = auxiliary_rerank_service.rerank(
                            optimized_query_text, ordered_candidate_texts_for_reranking, top_n=20
                        )
                        if auxiliary_reranked_results:
                            logger.info(f"Auxiliary Reranker top result for chat_id {chat_id}: {auxiliary_reranked_results[0][0]} (score: {auxiliary_reranked_results[0][1]:.4f})")
                        else:
                            logger.info(f"Auxiliary Reranker returned no results for chat_id: {chat_id}")
                        
                        # Map back to LoreEntry objects and select top M
                        auxiliary_reranked_lore_entries = []
                        text_to_lore_entry_map = {get_text_to_embed_from_lore_entry(le): le for le in ordered_lore_entries_for_reranking}
                        for text, score in auxiliary_reranked_results:
                            if text in text_to_lore_entry_map:
                                auxiliary_reranked_lore_entries.append(text_to_lore_entry_map[text])
                        
                        # Get texts for the principal reranker
                        # The auxiliary_reranked_results are already limited to top_n=20
                        texts_for_principal_reranker = [
                            get_text_to_embed_from_lore_entry(le) for le in auxiliary_reranked_lore_entries
                        ]
                        
                        if texts_for_principal_reranker:
                            # 3.5 Stage 2 Reranking (Principal Reranker)
                            logger.info(f"Calling Principal Reranker with {len(texts_for_principal_reranker)} documents for chat_id: {chat_id}")
                            principal_reranked_results = principal_rerank_service.rerank(
                                optimized_query_text, texts_for_principal_reranker
                            )
                            if principal_reranked_results:
                                logger.info(f"Principal Reranker top result for chat_id {chat_id}: {principal_reranked_results[0][0]} (score: {principal_reranked_results[0][1]:.4f})")
                            else:
                                logger.info(f"Principal Reranker returned no results for chat_id: {chat_id}")
                            
                            # Reorder LoreEntries based on principal reranker scores
                            final_reranked_lore_entries = []
                            # Rebuild map for the subset passed to principal reranker
                            subset_text_to_lore_entry_map = {
                                get_text_to_embed_from_lore_entry(le): le
                                for le in auxiliary_reranked_lore_entries
                            }

                            for text, score in principal_reranked_results:
                                if text in subset_text_to_lore_entry_map:
                                    final_reranked_lore_entries.append(subset_text_to_lore_entry_map[text])
                            
                            # 3.6 Select Top K for Prompt (Fixed to 5 as per user's request)
                            reranked_lore_entries = final_reranked_lore_entries[:5]
                            
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
                                logger.info(f"Successfully retrieved and reranked {len(reranked_lore_entries)} lore entries using two-stage reranking.")
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


    # Format chat history for LLM prompt
    chat_history_formatted = ""
    for msg in messages_for_llm_context[:-1]: # Exclude the current user message
        sender_name = "User" if msg.sender_type == "USER" else card_name_for_prompt
        chat_history_formatted += f"{sender_name}: {msg.content}\n"
    
    # --- 4. Call Planning LLM (if configured) ---
    ai_plan: Optional[AIPlan] = None
    panel_data_to_send: Optional[PanelData] = None

    if db_user_settings.planning_llm_model:
        planning_llm_model = db_user_settings.planning_llm_model
        planning_api_key = db_user_settings.llm_api_key # Assuming OpenRouter for planning LLM
        
        if not planning_api_key:
             logger.warning("Planning LLM model is set, but OpenRouter API key is missing. Skipping planning.")
        else:
            # Prepare context for Planning LLM
            planning_llm_context = {
                "ai_persona_card": {
                    "name": card_name_for_prompt,
                    "description": card_description_for_prompt,
                    "instructions": card_instructions_for_prompt
                },
                "user_persona": {
                    "name": user_persona_name,
                    "description": user_persona_description
                },
                "user_query_transformed": optimized_query_text,
                "reranked_lore_entries": [{"text": entry.content} for entry in reranked_lore_entries],
                "chat_history_formatted": chat_history_formatted,
                "current_panel_data": {
                    "current_time": "Não definido", # Default
                    "current_date": "Não definido", # Default
                    "current_location": "Não definido" # Default
                },
                "active_event_cards": [] # Placeholder for future event cards
            }

            # Fetch current panel data from SessionCacheFact if available
            current_time_fact = db.query(SessionCacheFact).filter(
                SessionCacheFact.chat_session_id == chat_id,
                SessionCacheFact.text.like('%current_time%') # Simple check for now
            ).order_by(SessionCacheFact.updated_at.desc()).first()
            if current_time_fact and current_time_fact.tags and "current_time" in current_time_fact.tags:
                planning_llm_context["current_panel_data"]["current_time"] = current_time_fact.text.split(': ')[1] # Extract value

            current_date_fact = db.query(SessionCacheFact).filter(
                SessionCacheFact.chat_session_id == chat_id,
                SessionCacheFact.text.like('%current_date%')
            ).order_by(SessionCacheFact.updated_at.desc()).first()
            if current_date_fact and current_date_fact.tags and "current_date" in current_date_fact.tags:
                planning_llm_context["current_panel_data"]["current_date"] = current_date_fact.text.split(': ')[1]

            current_location_fact = db.query(SessionCacheFact).filter(
                SessionCacheFact.chat_session_id == chat_id,
                SessionCacheFact.text.like('%current_location%')
            ).order_by(SessionCacheFact.updated_at.desc()).first()
            if current_location_fact and current_location_fact.tags and "current_location" in current_location_fact.tags:
                planning_llm_context["current_panel_data"]["current_location"] = current_location_fact.text.split(': ')[1]
            
            planning_prompt = planning_llm_prompt_template.render(planning_llm_context)
            
            planning_llm_messages = [
                {"role": "system", "content": planning_prompt}
            ]
            
            try:
                logger.info(f"Calling Planning LLM ({planning_llm_model}) for chat_id: {chat_id}")
                planning_response_str = await run_in_threadpool(
                    openrouter_client.generate_text,
                    model=planning_llm_model,
                    messages=planning_llm_messages,
                    api_key=planning_api_key,
                    temperature=0.7, # Moderate temperature for planning
                    max_tokens=1000 # Limit tokens for planning response
                )
                logger.info(f"Planning LLM raw response for chat_id {chat_id}: {planning_response_str}")
                logger.info(f"Planning LLM raw response for chat_id {chat_id}: {planning_response_str}")
                logger.info(f"Planning LLM response received for chat_id: {chat_id}")
                
                # Attempt to parse and validate JSON
                planning_data = json.loads(planning_response_str)
                ai_plan = AIPlan(**planning_data)
                
                if ai_plan.panel_data_update:
                    panel_data_to_send = ai_plan.panel_data_update
                
            except json.JSONDecodeError:
                logger.error(f"Planning LLM response was not valid JSON: {planning_response_str}")
                ai_plan = AIPlan(response_goal="Continue the conversation naturally.") # Fallback
            except Exception as e:
                logger.error(f"Error calling Planning LLM or parsing plan: {e}")
                ai_plan = AIPlan(response_goal="Continue the conversation naturally.") # Fallback
    else:
        ai_plan = AIPlan(response_goal="Continue the conversation naturally.") # Default plan if LLM not configured

    # --- 5. Call Main LLM for AI Response ---
    # Determine which LLM client to use based on user settings
    llm_client = None
    if db_user_settings.llm_provider == "OpenRouter":
        llm_client = openrouter_client
    elif db_user_settings.llm_provider == "MistralDirect":
        llm_client = mistral_client
    else:
        raise HTTPException(status_code=400, detail="Unsupported LLM provider configured.")

    # Get API key based on provider
    api_key = None
    if db_user_settings.llm_provider == "OpenRouter":
        api_key = db_user_settings.llm_api_key
    elif db_user_settings.llm_provider == "MistralDirect":
        api_key = db_user_settings.mistral_api_key
    
    if not api_key:
        raise HTTPException(status_code=400, detail=f"API key for {db_user_settings.llm_provider} is not configured.")

    # Main LLM Model
    selected_llm_model = db_user_settings.selected_llm_model
    if not selected_llm_model:
        raise HTTPException(status_code=400, detail="Main LLM model is not selected in settings.")

    # Prepare context for the main LLM prompt
    main_llm_context = {
        "ai_persona_card": {
            "name": card_name_for_prompt,
            "description": card_description_for_prompt,
            "instructions": card_instructions_for_prompt,
            "example_dialogues": card_example_dialogues_for_prompt,
            "beginning_message": card_beginning_message_for_prompt
        },
        "user_persona_details": {
            "name": user_persona_name,
            "description": user_persona_description
        },
        "world_context_name_and_description": world_context_for_prompt,
        "reranked_lore_entries": [{"text": entry.content} for entry in reranked_lore_entries],
        "chat_history_formatted": chat_history_formatted,
        "user_input": user_message_input.content,
        "ai_plan": ai_plan # Pass the AI plan object
    }

    # Construct the full prompt for the main LLM using Jinja2
    full_prompt = main_llm_prompt_template.render(main_llm_context)
    
    # Prepare messages for LLM API call
    llm_messages = [
        {"role": "system", "content": full_prompt} # System message for context
    ]
    # Add the user's latest message as a user role message
    llm_messages.append({"role": "user", "content": user_message_input.content})

    # Call the LLM
    try:
        logger.info(f"Calling main LLM ({selected_llm_model}) for chat_id: {chat_id}")
        ai_response_content = await run_in_threadpool(
            llm_client.generate_text,
            model=selected_llm_model,
            messages=llm_messages,
            api_key=api_key,
            temperature=db_user_settings.temperature,
            top_p=db_user_settings.top_p,
            max_tokens=db_user_settings.max_response_tokens
        )
        logger.info(f"Main LLM response received for chat_id: {chat_id}")
    except Exception as e:
        logger.error(f"Error calling main LLM: {e}")
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {e}")

    # --- 6. Process LLM Response and Save AI Message ---
    db_ai_message = ChatMessage(
        chat_session_id=chat_id,
        sender_type="AI",
        content=ai_response_content,
        active_persona_name=card_name_for_prompt,
        active_persona_image_url=ai_persona_card.image_url if ai_persona_card else None
    )
    db.add(db_ai_message)
    db.commit()
    db.refresh(db_ai_message)

    # --- 7. Call Interaction Analysis LLM (if configured) ---
    if db_user_settings.interaction_analysis_prompt_template:
        analysis_llm_model = db_user_settings.planning_llm_model # Assuming DeepSeek Coder V2 for analysis as well
        analysis_api_key = db_user_settings.llm_api_key # Assuming OpenRouter for analysis LLM

        if not analysis_api_key:
            logger.warning("Interaction Analysis LLM model is set, but OpenRouter API key is missing. Skipping analysis.")
        else:
            # Prepare context for Interaction Analysis LLM
            analysis_llm_context = {
                "user_message": user_message_input.content,
                "ai_response": ai_response_content,
                "reranked_lore_entries": [{"text": entry.content} for entry in reranked_lore_entries],
                "ai_plan": ai_plan.model_dump() if ai_plan else {}, # Pass the AI plan, convert to dict if not None
                "ai_persona_card": {
                    "name": card_name_for_prompt,
                    "description": card_description_for_prompt,
                    "instructions": card_instructions_for_prompt
                },
                "user_persona": {
                    "name": user_persona_name,
                    "description": user_persona_description
                },
                "active_event_cards": [] # Placeholder for future active event cards
            }

            analysis_prompt_template = jinja_env.from_string(db_user_settings.interaction_analysis_prompt_template)
            analysis_prompt = analysis_prompt_template.render(analysis_llm_context)

            analysis_llm_messages = [
                {"role": "system", "content": analysis_prompt}
            ]

            try:
                logger.info(f"Calling Interaction Analysis LLM ({analysis_llm_model}) for chat_id: {chat_id}")
                analysis_response_str = await run_in_threadpool(
                    openrouter_client.generate_text,
                    model=analysis_llm_model,
                    messages=analysis_llm_messages,
                    api_key=analysis_api_key,
                    temperature=0.1, # Low temperature for factual extraction
                    max_tokens=1500 # Sufficient tokens for structured output
                )
                logger.info(f"Interaction Analysis LLM raw response for chat_id {chat_id}: {analysis_response_str}")
                logger.info(f"Interaction Analysis LLM raw response for chat_id {chat_id}: {analysis_response_str}")
                logger.info(f"Interaction Analysis LLM response received for chat_id: {chat_id}")

                # Attempt to parse and validate JSON
                analysis_data = json.loads(analysis_response_str)
                analysis_result = InteractionAnalysisResult(**analysis_data)

                # --- Save extracted data to database ---
                # Save New Facts
                for fact in analysis_result.new_facts_established:
                    db_fact = SessionCacheFact(
                        chat_session_id=chat_id,
                        text=fact.text,
                        relevance_score=fact.relevance_score,
                        tags=fact.tags
                    )
                    db.add(db_fact)

                # Save Relationship Changes
                for rel_change in analysis_result.relationship_changes:
                    db_rel = SessionRelationship(
                        chat_session_id=chat_id,
                        character_id_1=rel_change.character_pair[0],
                        character_id_2=rel_change.character_pair[1],
                        relationship_type=rel_change.change_type,
                        value=rel_change.new_value,
                        reason=rel_change.reason
                    )
                    db.add(db_rel)

                # Save Session Lore Updates
                for lore_update in analysis_result.session_lore_updates:
                    db_lore_mod = SessionLoreModification(
                        chat_session_id=chat_id,
                        base_lore_entry_id=lore_update.base_lore_entry_id,
                        field_to_update=lore_update.field_to_update,
                        new_content_segment=lore_update.new_content_segment,
                        change_reason=lore_update.change_reason
                    )
                    db.add(db_lore_mod)

                # User Persona Session Updates (placeholder for now, might need specific model/table)
                for user_update in analysis_result.user_persona_session_updates:
                    # User Persona Session Updates: For now, we log these.
                    # Full implementation would involve updating a JSONB field on UserPersona or a new UserPersonaSessionState table.
                    logger.info(f"User Persona Session Update: {user_update.attribute} = {user_update.new_value} ({user_update.reason})")

                # Triggered Event IDs: For now, we log these.
                # Full implementation would involve communicating with an Event Manager.
                if analysis_result.triggered_event_ids:
                    logger.info(f"Triggered Event IDs: {analysis_result.triggered_event_ids}")

                # Dynamically Generated NPCs: Create LoreEntry if suggested
                for npc in analysis_result.dynamically_generated_npcs:
                    logger.info(f"Dynamically Generated NPC: {npc.npc_name} (Create Lore Entry: {npc.should_create_lore_entry})")
                    if npc.should_create_lore_entry:
                        # Ensure ai_persona_card and its master_world_id are available
                        if ai_persona_card and ai_persona_card.master_world_id:
                            new_lore_entry = LoreEntryModel(
                                entry_type=npc.suggested_entry_type or "CHARACTER_LORE", # Default to CHARACTER_LORE
                                name=npc.npc_name,
                                description=npc.description_notes,
                                master_world_id=ai_persona_card.master_world_id
                            )
                            db.add(new_lore_entry)
                            logger.info(f"Created new LoreEntry for dynamically generated NPC: {npc.npc_name}")
                        else:
                            logger.warning(f"Cannot create LoreEntry for NPC '{npc.npc_name}': AI persona card or master_world_id not found.")

                db.commit()
                logger.info("Successfully saved extracted analysis data.")

                # Update panel_data_to_send if the analysis LLM suggests an update
                if analysis_result.panel_data_update:
                    panel_data_to_send = analysis_result.panel_data_update

            except json.JSONDecodeError:
                logger.error(f"Interaction Analysis LLM response was not valid JSON: {analysis_response_str}")
            except Exception as e:
                logger.error(f"Error calling Interaction Analysis LLM or processing result: {e}")

    # --- 8. Call Extraction LLM (if configured) ---
    # This is the original extraction LLM, now re-numbered to 8.
    if db_user_settings.extraction_llm_model:
        extraction_llm_model = db_user_settings.extraction_llm_model
        extraction_api_key = db_user_settings.llm_api_key # Assuming OpenRouter for extraction LLM
        
        if not extraction_api_key:
             logger.warning("Extraction LLM model is set, but OpenRouter API key is missing. Skipping extraction.")
        else:
            # Original extraction LLM prompt (can be converted to Jinja2 later if needed)
            extraction_prompt_template = jinja_env.from_string("""
You are an expert knowledge extractor. Your task is to identify key facts, entities, and relationships from the provided conversation turn.
Output a JSON object with a list of 'facts' if any are found.
Each fact should have a 'text' field (the extracted fact) and optionally a 'relevance_score' (float from 0.0 to 1.0, higher is more relevant to the overall narrative/world), and 'tags' (list of strings).
Example: {'facts': [{'text': 'Alice went to the market.', 'relevance_score': 0.8, 'tags': ['Alice', 'market']}]}
If no facts are found, return an empty JSON object: {}

USER: {{user_message_content}}
AI: {{ai_response_content}}
""")
            extraction_llm_context = {
                "user_message_content": user_message_input.content,
                "ai_response_content": ai_response_content
            }
            extraction_prompt = extraction_prompt_template.render(extraction_llm_context)

            extraction_llm_messages = [
                {"role": "system", "content": extraction_prompt}
            ]
            
            try:
                logger.info(f"Calling Extraction LLM ({extraction_llm_model}) for chat_id: {chat_id}")
                extraction_response_str = await run_in_threadpool(
                    openrouter_client.generate_text,
                    model=extraction_llm_model,
                    messages=extraction_llm_messages,
                    api_key=extraction_api_key,
                    temperature=0.1, # Lower temperature for factual extraction
                    max_tokens=500 # Limit tokens for extraction response
                )
                logger.info(f"Extraction LLM raw response for chat_id {chat_id}: {extraction_response_str}")
                logger.info(f"Extraction LLM response received for chat_id: {chat_id}")
                
                # Attempt to parse JSON
                extracted_data = json.loads(extraction_response_str)
                
                if extracted_data and "facts" in extracted_data and isinstance(extracted_data["facts"], list):
                    for fact_data in extracted_data["facts"]:
                        if "text" in fact_data:
                            # Create and save ExtractedKnowledge entry
                            extracted_knowledge_create = ExtractedKnowledgeCreate(
                                chat_session_id=chat_id,
                                text=fact_data["text"],
                                relevance_score=fact_data.get("relevance_score"),
                                tags=fact_data.get("tags")
                            )
                            db_extracted_knowledge = ExtractedKnowledge(**extracted_knowledge_create.model_dump())
                            db.add(db_extracted_knowledge)
                    db.commit()
                    logger.info(f"Saved {len(extracted_data['facts'])} extracted knowledge entries.")
                else:
                    logger.warning(f"Extraction LLM returned invalid or empty JSON: {extraction_response_str}")
                    
            except json.JSONDecodeError:
                logger.error(f"Extraction LLM response was not valid JSON: {extraction_response_str}")
            except Exception as e:
                logger.error(f"Error calling Extraction LLM or saving extracted knowledge: {e}")

    # Return both messages, the AI plan, and panel data
    return ChatTurnResponse(
        user_message=db_user_message,
        ai_message=db_ai_message,
        ai_plan=ai_plan,
        panel_data_update=panel_data_to_send
    )

@router.put("/{chat_id}", response_model=ChatSessionInDB)
def update_chat_session_title(
    chat_id: str,
    chat_session_update: ChatSessionUpdate,
    db: Session = Depends(get_db)
):
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if db_chat_session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Update fields from the Pydantic model
    update_data = chat_session_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_chat_session, key, value)
    
    db.add(db_chat_session)
    db.commit()
    db.refresh(db_chat_session)
    return db_chat_session

@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_session(chat_id: str, db: Session = Depends(get_db)):
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if db_chat_session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    db.delete(db_chat_session)
    db.commit()
    return {"message": "Chat session deleted successfully"}
