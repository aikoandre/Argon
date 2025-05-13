# backend/models/world_card.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, JSON, Table, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

# Tabela de associação para tags (se quiser tags como entidades separadas no futuro)
# Por enquanto, um campo JSON ou uma lista de strings no WorldCard é mais simples.
# world_card_tags_association = Table(
#     'world_card_tags', Base.metadata,
#     Column('world_card_id', String, ForeignKey('world_cards.id')),
#     Column('tag_id', String, ForeignKey('tags.id')) # Supondo uma tabela Tag
# )

class WorldCard(Base):
    __tablename__ = "world_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    card_type = Column(String, nullable=False, index=True) # "CHARACTER_LORE", "LOCATION", "FACTION", "ITEM", "CONCEPT"
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True) # Descrição principal
    tags = Column(JSON, nullable=True) # Lista de strings: ["floresta", "antigo", "perigoso"]
    aliases = Column(JSON, nullable=True) # Lista de strings
    attributes = Column(JSON, nullable=True) # Campos específicos do tipo, ex: {"status": "Vivo", "species": "Elfo"} para CHARACTER_LORE

    # ID da Facção/Grupo à qual este card (se for CHARACTER_LORE) pertence.
    # É uma ForeignKey para a própria tabela world_cards, filtrada por card_type="FACTION" na lógica da API/UI.
    faction_id = Column(String, ForeignKey("world_cards.id"), nullable=True)

    # Para relacionamentos estáticos dentro do lore (opcional, pode ser gerenciado via attributes ou RAG)
    # static_relationships = Column(JSON, nullable=True) # Ex: {"related_to": "uuid_outro_card", "type": "irmão"}

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())