# backend/models/scenario_card.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.database import Base

class ScenarioCard(Base):
    __tablename__ = "scenario_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)  # <-- Added for scenario images
    beginning_message = Column(JSON, nullable=True)
    example_dialogues = Column(JSON, nullable=True)
    world_card_references = Column(JSON, nullable=True)
    
    master_world_id = Column(String, ForeignKey("master_worlds.id", ondelete="SET NULL"), nullable=True, index=True)
    user_persona_id = Column(String, ForeignKey("user_personas.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    master_world = relationship("MasterWorld", back_populates="scenario_cards")

