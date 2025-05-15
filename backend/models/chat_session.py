# backend/models/chat_session.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=True) # Pode ser gerado ou definido pelo usuário

    # Chaves estrangeiras - Assumindo que os IDs nas tabelas referenciadas são String(UUID)
    scenario_id = Column(String, ForeignKey("scenario_cards.id"), nullable=True)
    gm_character_id = Column(String, ForeignKey("character_cards.id"), nullable=True)
    user_persona_id = Column(String, ForeignKey("user_personas.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relacionamentos (para fácil acesso via ORM)
    scenario = relationship("ScenarioCard") # Nome da classe SQLAlchemy
    gm_character = relationship("CharacterCard") # Nome da classe SQLAlchemy
    user_persona = relationship("UserPersona") # Nome da classe SQLAlchemy
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

    # Campos para funcionalidades futuras (podem ser adicionados depois via migrações)
    # current_event_id = Column(String, nullable=True)
    # current_event_phase = Column(String, nullable=True)
    # session_cache_summary = Column(Text, nullable=True)
