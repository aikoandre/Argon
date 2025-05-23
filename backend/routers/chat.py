# backend/routers/chat.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid # Para gerar IDs de sessão se necessário (embora o modelo já faça isso)

# Importe modelos SQLAlchemy
from backend.models.chat_session import ChatSession
from backend.models.chat_message import ChatMessage
from backend.models.scenario_card import ScenarioCard # Para buscar o nome/descrição do cenário
from backend.models.character_card import CharacterCard # Para buscar nome do GM
from backend.models.user_persona import UserPersona # Para buscar nome da persona

# Importe schemas Pydantic
from backend.schemas.chat_session import ChatSessionCreate, ChatSessionInDB, ChatSessionUpdate, ChatSessionListed
from backend.schemas.chat_message import ChatMessageCreate, ChatMessageInDB
from typing import Optional

from backend.database import get_db
from backend.db.crud import create_chat_session as crud_create_chat_session

router = APIRouter(
    tags=["chat_sessions"],
)

# Change card_id type from UUID to str for compatibility with string IDs in the database
@router.post("/sessions/{card_type}/{card_id}", response_model=ChatSessionInDB, status_code=status.HTTP_201_CREATED)
def create_or_get_chat_session(
    card_type: str,
    card_id: str,  # Changed from UUID to str
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
    print(f"[DEBUG] create_or_get_chat_session called with card_type={card_type}, card_id={card_id}")
    # Get card details
    if card_type == "character":
        card = db.query(CharacterCard).filter(CharacterCard.id == str(card_id)).first()
        print(f"[DEBUG] CharacterCard query result: {card}")
    else:
        card = db.query(ScenarioCard).filter(ScenarioCard.id == str(card_id)).first()
        print(f"[DEBUG] ScenarioCard query result: {card}")
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{card_type.capitalize()} with id {card_id} not found"
        )
    
    # Find existing session
    existing = db.query(ChatSession).filter(
        ChatSession.card_type == card_type,
        ChatSession.card_id == str(card_id)
    ).order_by(ChatSession.created_at.desc()).first()
    
    if existing:
        return existing
    
    # Create new session
    # Use .name for scenario, .name for character
    title = f"Chat with {card.name if card_type == 'character' else card.name}"
    new_chat = ChatSession(
        card_type=card_type,
        card_id=str(card_id),
        title=title
    )
    
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
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
    
    return await create_or_get_chat_session(
        card_type=card_type,
        card_id=card_id,
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
        # Subquery para contar mensagens por sessão
        message_count_subquery = (
            select(
                ChatMessage.chat_session_id,
                func.count(ChatMessage.id).label("message_count")
            )
            .group_by(ChatMessage.chat_session_id)
            .subquery()
        )

        # Query principal para sessões de chat, incluindo a contagem de mensagens
        query = (
            db.query(
                ChatSession,
                message_count_subquery.c.message_count
            )
            .outerjoin(
                message_count_subquery,
                ChatSession.id == message_count_subquery.c.chat_session_id
            )
            .order_by(ChatSession.last_active_at.desc())
        )
        
        sessions_with_counts = query.offset(skip).limit(limit).all()

        result = []
        for session, message_count in sessions_with_counts:
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
                    "message_count": message_count if message_count is not None else 0 # Adiciona a contagem de mensagens
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
    chat_id: str, skip: int = 0, limit: int = 1000, db: Session = Depends(get_db) # Limite maior para mensagens
):
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if db_chat_session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_session_id == chat_id)
        .order_by(ChatMessage.timestamp.asc()) # Ou .desc() se quiser as mais recentes primeiro
        .offset(skip)
        .limit(limit)
        .all()
    )
    return messages

@router.post("/{chat_id}/messages", response_model=ChatMessageInDB, status_code=status.HTTP_201_CREATED)
def add_message_to_session(
    chat_id: str, message_create: ChatMessageCreate, db: Session = Depends(get_db)
):
    db_chat_session = db.query(ChatSession).filter(ChatSession.id == chat_id).first()
    if db_chat_session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Se houver active_persona_id no metadata, busca o nome e garante que fique salvo
    message_metadata = message_create.message_metadata or {}
    if 'active_persona_id' in message_metadata and not message_metadata.get('active_persona_name'):
        # Busca o nome da persona se não foi fornecido
        active_persona = db.query(UserPersona).filter(UserPersona.id == message_metadata['active_persona_id']).first()
        if active_persona:
            message_metadata['active_persona_name'] = active_persona.name

    db_message = ChatMessage(
        chat_session_id=chat_id,
        sender_type=message_create.sender_type,
        content=message_create.content,
        message_metadata=message_metadata,
        active_persona_name=message_create.active_persona_name, # Pass the name
        active_persona_image_url=message_create.active_persona_image_url # Pass the image URL
    )
    db.add(db_message)
    
    # Atualiza last_active_at da sessão
    db_chat_session.last_active_at = func.now() # type: ignore
    db.add(db_chat_session)

    db.commit()
    db.refresh(db_message)
    return db_message

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
