# backend/models/scenario_card.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class ScenarioCard(Base):
    __tablename__ = "scenario_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True) # Visão geral do cenário
    beginning_message = Column(JSON, nullable=True) # Lista de mensagens de abertura
    # Referências a WorldCards relevantes para o cenário (ex: locais chave, facções envolvidas)
    # Poderia ser uma lista de UUIDs de WorldCards, ou uma busca por tags no futuro.
    world_card_references = Column(JSON, nullable=True)
    
    master_world_id = Column(String, ForeignKey("master_worlds.id", ondelete="SET NULL"), nullable=True, index=True)
    master_world = relationship("MasterWorld", back_populates="scenario_cards")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

