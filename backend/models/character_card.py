# backend/models/character_card.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, JSON # JSON para campos flexíveis
from sqlalchemy.sql import func
from ..database import Base

class CharacterCard(Base):
    __tablename__ = "character_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True) # Descrição geral, história
    instructions = Column(Text, nullable=True) # Como a IA deve se comportar/formatar
    example_dialogues = Column(JSON, nullable=True) # Lista de strings ou objetos de diálogo
    beginning_message = Column(Text, nullable=True) # Mensagem inicial específica se este GM iniciar o chat
    # personality_traits = Column(JSON, nullable=True) # Outra forma de armazenar traços

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())