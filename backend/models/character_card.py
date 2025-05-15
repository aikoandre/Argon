# backend/models/character_card.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class CharacterCard(Base):
    __tablename__ = "character_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True) # Descrição geral, história
    instructions = Column(Text, nullable=True) # Como a IA deve se comportar/formatar
    example_dialogues = Column(JSON, nullable=True, default=lambda: []) # Lista de strings ou objetos de diálogo
    beginning_messages = Column(JSON, nullable=True, default=lambda: []) # Mensagem inicial específica se este GM iniciar o chat
    master_world_id = Column(String, ForeignKey("master_worlds.id", ondelete="SET NULL"), nullable=True, index=True)
    master_world = relationship("MasterWorld", back_populates="character_cards")
    
    linked_lore_ids = Column(JSON, nullable=True, default=lambda: [])

    # Add relationship to ChatSession with cascade delete
    chat_sessions = relationship(
        "ChatSession",
        back_populates="gm_character",
        cascade="all, delete-orphan"
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

