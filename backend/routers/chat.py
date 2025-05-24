# backend/routers/chat.py
from fastapi import APIRouter, Depends, HTTPException, status, Body, Path
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid # Para gerar IDs de sessão se necessário (embora o modelo já faça isso)
from datetime import datetime # For updating last_active_at
from pydantic import BaseModel, Field
from fastapi.concurrency import run_in_threadpool

# Importe modelos SQLAlchemy
from backend.models.chat_session import ChatSession
from backend.models.chat_message import ChatMessage
from backend.models.user_settings import UserSettings
from backend.models.user_persona import UserPersona
from backend.models.character_card import CharacterCard
from backend.models.scenario_card import ScenarioCard
from backend.models.master_world import MasterWorld

# Importe schemas Pydantic
from backend.schemas.chat_session import ChatSessionCreate, ChatSessionInDB, ChatSessionUpdate, ChatSessionListed
from backend.schemas.chat_message import ChatMessageCreate, ChatMessageInDB

from backend.database import get_db
from backend.db.crud import create_chat_session as crud_create_chat_session

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
    print(f"[DEBUG] create_or_get_chat_session called with card_type={card_type}, card_id={card_id}, user_persona_id={user_persona_id}")
    # Get card details
    if card_type == "character":
        card = db.query(CharacterCard).filter(CharacterCard.id == str(card_id)).first()
        print(f"[DEBUG] CharacterCard query result: {card}")
        print(f"[DEBUG] CharacterCard beginning_messages: {card.beginning_messages if card else 'Card not found'}") # New debug line
    else:
        card = db.query(ScenarioCard).filter(ScenarioCard.id == str(card_id)).first()
        print(f"[DEBUG] ScenarioCard query result: {card}")
        print(f"[DEBUG] ScenarioCard beginning_message: {card.beginning_message if card else 'Card not found'}") # New debug line
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{card_type.capitalize()} with id {card_id} not found"
        )
    
    # Find existing session based on card and user persona
    query = db.query(ChatSession).filter(
        ChatSession.card_type == card_type,
        ChatSession.card_id == str(card_id)
    )
    
    if user_persona_id is not None:
        query = query.filter(ChatSession.user_persona_id == user_persona_id)
    else:
        query = query.filter(ChatSession.user_persona_id.is_(None))

    existing = query.order_by(ChatSession.created_at.desc()).first()
    
    if existing:
        print(f"[DEBUG] Found existing chat session: {existing.id}, user_persona_id: {existing.user_persona_id}. Returning existing session.")
        return existing
    
    # Create new session
    # Use .name for scenario, .name for character
    title = f"Chat with {card.name if card_type == 'character' else card.name}"
    new_chat = ChatSession(
        card_type=card_type,
        card_id=str(card_id),
        title=title,
        user_persona_id=user_persona_id # Pass the user_persona_id
    )
    
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    print(f"[DEBUG] Created new chat session: {new_chat.id}, user_persona_id: {new_chat.user_persona_id}")

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
        print(f"[DEBUG] Added initial AI message for chat {new_chat.id}.")

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
                print(f"Error processing session {session.id}: {str(session_error)}")
                continue

        return result
        
    except Exception as e:
        print(f"Error in list_chat_sessions: {str(e)}")
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

    # Check if the first message is the expected beginning message. If not, add it.
    if expected_beginning_messages and not messages:
        # If no messages exist, and there are beginning messages, add the first one
        initial_ai_message_content = expected_beginning_messages[0]
        all_ai_responses = [
            {"content": msg, "timestamp": datetime.utcnow().isoformat()}
            for msg in expected_beginning_messages
        ]
        
        initial_ai_message = ChatMessage(
            chat_session_id=db_chat_session.id,
            sender_type="AI",
            content=initial_ai_message_content,
            is_beginning_message=True,
            message_metadata={"ai_responses": all_ai_responses, "current_response_index": 0},
            active_persona_name=card.name if card else "Assistant",
            active_persona_image_url=card.image_url if card else None
        )
        db.add(initial_ai_message)
        db.commit()
        db.refresh(initial_ai_message)
        messages.insert(0, initial_ai_message) # Prepend to the list for immediate return

    elif expected_beginning_messages and messages and not (
        messages[0].sender_type == "AI" and
        messages[0].is_beginning_message and
        messages[0].content == expected_beginning_messages[0]
    ):
        # If messages exist, but the first one is not the expected beginning message, prepend it
        initial_ai_message_content = expected_beginning_messages[0]
        all_ai_responses = [
            {"content": msg, "timestamp": datetime.utcnow().isoformat()}
            for msg in expected_beginning_messages
        ]

        initial_ai_message = ChatMessage(
            chat_session_id=db_chat_session.id,
            sender_type="AI",
            content=initial_ai_message_content,
            is_beginning_message=True,
            message_metadata={"ai_responses": all_ai_responses, "current_response_index": 0},
            active_persona_name=card.name if card else "Assistant",
            active_persona_image_url=card.image_url if card else None
        )
        db.add(initial_ai_message)
        db.commit()
        db.refresh(initial_ai_message)
        messages.insert(0, initial_ai_message) # Prepend to the list for immediate return

    return messages

@router.post("/{chat_id}/messages", response_model=ChatMessageInDB) # Simplified response for now
async def post_chat_message(
    chat_id: str = Path(..., title="The ID of the chat session"),
    user_message_input: UserMessageInput = Body(...), # Use the Pydantic model for the body
    db: Session = Depends(get_db)
):
    print(f"[DEBUG] post_chat_message called for chat_id: {chat_id}")
    # --- 1. Fetch ChatSession and save User's Message ---
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if not db_chat_session:
        print(f"[DEBUG] Chat session {chat_id} not found.")
        raise HTTPException(status_code=404, detail="Chat session not found")

    print(f"[DEBUG] Chat session {chat_id} found. User persona linked: {db_chat_session.user_persona_id is not None}")
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
    print(f"[DEBUG] User message saved for chat {chat_id}.")

    # --- 2. Fetch Context Data ---
    # UserSettings
    db_user_settings = db.query(UserSettings).filter(UserSettings.id == USER_SETTINGS_ID).first()
    if not db_user_settings:
        # This should ideally not happen if GET /api/settings/ creates it.
        # Or, create default settings here if they are absolutely mandatory for a chat to proceed.
        raise HTTPException(status_code=500, detail="User settings not configured. Please configure settings first.")

    # --- 2. Fetch Context Data ---
    # UserSettings
    db_user_settings = db.query(UserSettings).filter(UserSettings.id == USER_SETTINGS_ID).first()
    if not db_user_settings:
        raise HTTPException(status_code=500, detail="User settings not configured. Please configure settings first.")

    # Handle dynamic user persona update for the session
    if user_message_input.user_persona_id and db_chat_session.user_persona_id != user_message_input.user_persona_id:
        db_chat_session.user_persona_id = user_message_input.user_persona_id
        db.add(db_chat_session)
        db.commit()
        db.refresh(db_chat_session)
        print(f"[DEBUG] Chat session {chat_id} user persona updated to: {db_chat_session.user_persona_id}")

    # Fetch the user persona (either the existing one or the newly updated one)
    db_user_persona = db_chat_session.user_persona
    if not db_user_persona:
        # If after update, still no persona (e.g., user_persona_id was None and input was None)
        # This should ideally not happen if frontend enforces persona selection for new chats
        # and sends it with every message.
        print(f"[DEBUG] No user persona found for chat session {chat_id} after update attempt.")
        raise HTTPException(status_code=400, detail="No user persona linked to this chat session. Please select one.")


    # AI Persona Card (Character or Scenario)
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
                active_persona_image_url=ai_persona_card.image_url
            )
            messages_for_llm_context.append(temp_beginning_msg)
        else:
            print(f"[WARNING] Invalid current_beginning_message_index: {user_message_input.current_beginning_message_index}. Falling back to regular history.")
            # Fallback to regular history if index is invalid
            history_limit = db_user_settings.context_size if db_user_settings.context_size and db_user_settings.context_size > 0 else 10
            recent_messages_db = (
                db.query(ChatMessage)
                .filter(ChatMessage.chat_session_id == chat_id)
                .order_by(ChatMessage.timestamp.desc())
                .limit(history_limit)
                .all()
            )
            recent_messages_db.reverse()
            messages_for_llm_context.extend(recent_messages_db)
    else:
        # If no current_beginning_message_index, fetch regular chat history from DB
        history_limit = db_user_settings.context_size if db_user_settings.context_size and db_user_settings.context_size > 0 else 10
        recent_messages_db = (
            db.query(ChatMessage)
            .filter(ChatMessage.chat_session_id == chat_id)
            .order_by(ChatMessage.timestamp.desc())
            .limit(history_limit)
            .all()
        )
        recent_messages_db.reverse()
        messages_for_llm_context.extend(recent_messages_db)

    chat_history_for_prompt = "\n".join(
        [f"{msg.active_persona_name or msg.sender_type}: {msg.content}" for msg in messages_for_llm_context]
    )

    # --- 3. Assemble Prompt ---
    prompt_template = db_user_settings.generation_prompt_template or \
        "You are {{ai_instructions.name}}. User: {{user_input}}. {{ai_instructions.name}}:"

    # Prepare ai_instructions object/dict for the template
    # Note: The example template uses dot notation (ai_instructions.name), so a class or dict that supports it is good.
    # For simplicity here, we'll use direct f-string replacement or prepare a dict.
    
    ai_instructions_data = {
        "name": card_name_for_prompt,
        "description": card_description_for_prompt,
        "instructions": card_instructions_for_prompt,
        "example_dialogues": card_example_dialogues_for_prompt,
        "beginning_message": card_beginning_message_for_prompt
    }

    user_persona_details_data = {
        "name": db_user_persona.name,
        "description": db_user_persona.description or ""
    }

    # Simple replacement for now; a proper templating engine like Jinja2 could be used for more complex logic
    # This is a basic example. You might need to make your template simpler or use a templating engine.
    # The example template in UserSettings has nested access (e.g., ai_instructions.name)
    # For now, let's assume a flat structure or adjust the template string in UserSettings.
    # Or, build the specific parts of ai_instructions for the template.

    final_prompt = prompt_template \
        .replace("{{ai_instructions.name}}", card_name_for_prompt) \
        .replace("{{ai_instructions.description}}", card_description_for_prompt) \
        .replace("{{ai_instructions.instructions}}", card_instructions_for_prompt) \
        .replace("{{ai_instructions.example_dialogues}}", card_example_dialogues_for_prompt) \
        .replace("{{ai_instructions.beginning_message}}", card_beginning_message_for_prompt) \
        .replace("{{user_persona_details.name}}", db_user_persona.name) \
        .replace("{{user_persona_details.description}}", db_user_persona.description or "") \
        .replace("{{world_context_name_and_description}}", world_context_for_prompt) \
        .replace("{{chat_history}}", chat_history_for_prompt) \
        .replace("{{user_input}}", user_message_input.content) \
        .replace("{{language}}", db_user_settings.language or "English") # Use configured language

    # --- 4. Call LLM (Example with litellm) ---
    # Ensure litellm is installed: pip install litellm
    try:
        import litellm
        # Make sure API key, model, provider are correctly set in UserSettings
        # For litellm, model string can often include the provider, e.g., "ollama/mistral" or "openrouter/mistralai/mistral-7b-instruct"
        # If using OpenRouter, litellm needs OPENROUTER_API_KEY environment variable, or pass it directly.
        
        # This logic needs to be robust based on how you store provider/model and API keys.
        # For now, assuming a generic way and that API key for the provider is accessible by litellm.
        model_for_litellm = db_user_settings.selected_llm_model
        
        # Ensure model string is correctly formatted for OpenRouter
        if db_user_settings.llm_provider and db_user_settings.llm_provider.lower() == "openrouter":
            # OpenRouter models should be prefixed with "openrouter/"
            if not model_for_litellm.lower().startswith("openrouter/"):
                model_for_litellm = f"openrouter/{model_for_litellm}"
        elif db_user_settings.llm_provider and db_user_settings.llm_provider.lower() not in model_for_litellm.lower() and "/" not in model_for_litellm:
             # Generic case: prepend provider if not already part of model and no organization prefix
             model_for_litellm = f"{db_user_settings.llm_provider.lower()}/{model_for_litellm}"

        # Construct messages list for litellm
        # The 'system' message would be the main assembled prompt, excluding the history and user input if they are part of messages
        # Or, some models prefer the full context as one system/user prompt.
        # For simplicity, let's assume the prompt contains everything and we make a single message to the 'user' role for the LLM.
        # A more standard approach is:
        # messages_for_llm = [
        #    {"role": "system", "content": "System instructions extracted from your template..."},
        #    ... (chat history messages as {"role": "user/assistant", "content": ...})
        #    {"role": "user", "content": user_message_input.content}
        # ]
        # For now, using the fully assembled prompt as a single 'user' message after a system prompt
        
        # Simpler approach: Construct a system prompt and then add user message
        # The system prompt would be your template MINUS the {{user_input}} and the final {{ai_instructions.name}}:
        system_prompt_part = final_prompt.split(f"\n{db_user_persona.name}: {user_message_input.content}")[0]

        messages_for_llm = [
            {"role": "system", "content": system_prompt_part.strip()},
            {"role": "user", "content": user_message_input.content}
        ]
        
        litellm_params = {
            "model": model_for_litellm, # e.g., "openrouter/mistralai/mistral-7b-instruct"
            "messages": messages_for_llm,
            "api_key": db_user_settings.llm_api_key, # Pass the API key if needed for the provider
            "temperature": db_user_settings.temperature,
            "top_p": db_user_settings.top_p,
            "max_tokens": db_user_settings.max_response_tokens
        }

        # Add base_url for OpenRouter explicitly
        if db_user_settings.llm_provider and db_user_settings.llm_provider.lower() == "openrouter":
            litellm_params["base_url"] = "https://openrouter.ai/api/v1"
            print(f"[DEBUG] Using OpenRouter base_url: {litellm_params['base_url']}")
            print(f"[DEBUG] OpenRouter model: {litellm_params['model']}")

        response = await run_in_threadpool(litellm.completion, **litellm_params)
        ai_response_content = response.choices[0].message.content.strip()

    except litellm.exceptions.APIError as e:
        print(f"LiteLLM API Error: Status Code: {e.status_code}, Message: {e.message}, Response: {e.response}")
        raise HTTPException(status_code=e.status_code if e.status_code else 500, detail=f"LLM API Error: {e.message}")
    except litellm.exceptions.AuthenticationError as e:
        print(f"LiteLLM Authentication Error: Message: {e.message}")
        raise HTTPException(status_code=401, detail=f"LLM Authentication Error: {e.message}. Please check your API key.")
    except litellm.exceptions.RateLimitError as e:
        print(f"LiteLLM Rate Limit Error: Message: {e.message}")
        raise HTTPException(status_code=429, detail=f"LLM Rate Limit Exceeded: {e.message}. Please try again later.")
    except litellm.exceptions.BadRequestError as e:
        print(f"LiteLLM Bad Request Error: Message: {e.message}, Response: {e.response}")
        raise HTTPException(status_code=400, detail=f"LLM Bad Request: {e.message}. Check model name or request parameters.")
    except Exception as e:
        print(f"An unexpected error occurred calling LLM: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred with LLM: {str(e)}")

    # --- 5. Save AI Response ---
    db_ai_message = ChatMessage(
        chat_session_id=chat_id,
        sender_type="AI",
        content=ai_response_content,
        message_metadata={"model_used": model_for_litellm} # Example metadata
        # Populate active_persona_name and image_url for the AI's message using the ai_persona_card details
    )
    if ai_persona_card:
        db_ai_message.active_persona_name = card_name_for_prompt
        db_ai_message.active_persona_image_url = ai_persona_card.image_url

    db.add(db_ai_message)
    db_chat_session.last_active_at = datetime.utcnow() # Update last active time again
    db.commit()
    db.refresh(db_ai_message)

    # --- 6. Return AI's message (or a ChatTurnResponse) ---
    return db_ai_message # Returning only AI's message for now

@router.put("/{chat_id}", response_model=ChatSessionInDB)
def update_chat_session_title(
    chat_id: str, session_update: ChatSessionUpdate, db: Session = Depends(get_db)):
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if db_chat_session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    if session_update.title is not None:
        db_chat_session.title = session_update.title
        db_chat_session.last_active_at = func.now() # type: ignore
        db.commit()
        db.refresh(db_chat_session)
    return db_chat_session

@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_session(chat_id: str, db: Session = Depends(get_db)):
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if db_chat_session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # As mensagens serão deletadas em cascata devido a cascade="all, delete-orphan" no modelo ChatSession
    db.delete(db_chat_session)
    db.commit()
    return None # Ou Response(status_code=status.HTTP_204_NO_CONTENT)
