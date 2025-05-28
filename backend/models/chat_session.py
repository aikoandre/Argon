# backend/models/chat_session.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=True)  # Can be generated or user-defined
    
    # Unified card reference
    card_type = Column(String(20))  # 'character' or 'scenario'
    card_id = Column(String, nullable=False)
    user_persona_id = Column(String, ForeignKey("user_personas.id", ondelete="SET NULL", name="fk_chat_sessions_user_persona_id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships with conditional foreign keys
    scenario = relationship("ScenarioCard",
        primaryjoin="and_(ChatSession.card_type=='scenario', foreign(ChatSession.card_id)==ScenarioCard.id)",
        viewonly=True
    )
    character = relationship("CharacterCard",
        primaryjoin="and_(ChatSession.card_type=='character', foreign(ChatSession.card_id)==CharacterCard.id)",
        back_populates="chat_sessions",
        viewonly=True
    )
    user_persona = relationship("UserPersona") # Nome da classe SQLAlchemy
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    extracted_knowledge = relationship("ExtractedKnowledge", back_populates="chat_session", cascade="all, delete-orphan")
    session_cache_facts = relationship("SessionCacheFact", back_populates="chat_session", cascade="all, delete-orphan")
    session_relationships = relationship("SessionRelationship", back_populates="chat_session", cascade="all, delete-orphan")
    session_lore_modifications = relationship("SessionLoreModification", back_populates="chat_session", cascade="all, delete-orphan")
    active_events = relationship("ActiveSessionEvent", back_populates="session", cascade="all, delete-orphan")

    # Campos para funcionalidades futuras (podem ser adicionados depois via migrações)
    # current_event_id = Column(String, nullable=True)
    # current_event_phase = Column(String, nullable=True)
    # session_cache_summary = Column(Text, nullable=True)
