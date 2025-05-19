# backend/models/master_world.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class MasterWorld(Base):
    __tablename__ = "master_worlds"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, index=True, unique=True) # Nome do mundo deve ser único
    description = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True, default=lambda: []) # Lista de strings
    image_url = Column(String, nullable=True)  # Add this line for image support
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    lore_entries = relationship("LoreEntry", back_populates="master_world", cascade="all, delete-orphan")
    character_cards = relationship("CharacterCard", back_populates="master_world", cascade="all, delete-orphan")
    scenario_cards = relationship("ScenarioCard", back_populates="master_world", cascade="all, delete-orphan")
    
    # Relacionamento com CharacterCard
    character_cards = relationship("CharacterCard", back_populates="master_world", cascade="all, delete-orphan")
    
    # Relacionamento com ScenarioCard
    scenario_cards = relationship("ScenarioCard", back_populates="master_world", cascade="all, delete-orphan")
