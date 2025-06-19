# backend/models/user_persona.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID # Se usar PostgreSQL no futuro
from sqlalchemy.orm import relationship
# Para SQLite, UUID pode ser armazenado como String
from sqlalchemy.sql import func
from db.database import Base

class UserPersona(Base):
    __tablename__ = "user_personas"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    # Adicione mais campos se necessário, ex: persona_goals, style_notes
    master_world_id = Column(String, ForeignKey("master_worlds.id", ondelete="SET NULL"), nullable=True, index=True)
    # Optionally, add relationship if you want to access the world from persona
    master_world = relationship("MasterWorld")
    image_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Remove the relationship that's causing the error
    # scenario_cards = relationship("ScenarioCard", back_populates="user_persona")