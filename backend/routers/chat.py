# backend/routers/chat.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
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

from backend.database import get_db

router = APIRouter(
    prefix="/api/chats",
    tags=["chat_sessions"],
)

@router.post("", response_model=ChatSessionInDB, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    session_create: ChatSessionCreate, db: Session = Depends(get_db)
):
    # Validação básica: verificar se os IDs referenciados existem
    scenario = db.query(ScenarioCard).filter(ScenarioCard.id == session_create.scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario with id {session_create.scenario_id} not found")
    
    gm_character = db.query(CharacterCard).filter(CharacterCard.id == session_create.gm_character_id).first()
    if not gm_character:
        raise HTTPException(status_code=404, detail=f"GM Character with id {session_create.gm_character_id} not found")

    user_persona = db.query(UserPersona).filter(UserPersona.id == session_create.user_persona_id).first()
    if not user_persona:
        raise HTTPException(status_code=404, detail=f"User Persona with id {session_create.user_persona_id} not found")

    # Gerar um título inicial se não for fornecido
    title = session_create.title
    if not title:
        title = f"{user_persona.name} in {scenario.name} with {gm_character.name}"
        title = title[:150] # Limita o tamanho do título, se necessário

    db_chat_session = ChatSession(
        title=title,
        scenario_id=session_create.scenario_id,
        gm_character_id=session_create.gm_character_id,
        user_persona_id=session_create.user_persona_id
        # id, created_at, last_active_at são definidos pelo modelo/DB
    )
    db.add(db_chat_session)
    db.commit()
    db.refresh(db_chat_session)
    return db_chat_session

@router.get("", response_model=List[ChatSessionListed])
def list_chat_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).order_by(ChatSession.last_active_at.desc()).offset(skip).limit(limit).all()
    # Para ChatSessionListed, você pode querer fazer joins para pegar nomes, ou iterar e buscar
    # Por simplicidade agora, vamos retornar apenas o que está na tabela ChatSession
    return sessions

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

    # Por enquanto, apenas salva a mensagem do usuário. A resposta da IA virá depois.
    # TODO: No futuro, se sender_type for USER, acionar pipeline da IA aqui.
    
    db_message = ChatMessage(
        chat_session_id=chat_id,
        sender_type=message_create.sender_type,
        content=message_create.content,
        message_metadata=message_create.message_metadata
        # id e timestamp são definidos pelo modelo/DB
    )
    db.add(db_message)
    
    # Atualiza last_active_at da sessão
    db_chat_session.last_active_at = func.now() # type: ignore
    db.add(db_chat_session)

    db.commit()
    db.refresh(db_message)
    # db.refresh(db_chat_session) # Para garantir que last_active_at está atualizado na resposta
    return db_message

@router.put("/{chat_id}", response_model=ChatSessionInDB)
def update_chat_session_title(
    chat_id: str, session_update: ChatSessionUpdate, db: Session = Depends(get_db)
):
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
