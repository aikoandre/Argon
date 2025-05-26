import uuid
from sqlalchemy import Column, String, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.sql.sqltypes import TIMESTAMP
from ..database import Base

class LoreEntry(Base):
    __tablename__ = "lore_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    entry_type = Column(String, nullable=False, index=True)  # "CHARACTER_LORE", "LOCATION", "FACTION", "ITEM", "CONCEPT"
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)
    aliases = Column(JSON, nullable=True)
    faction_id = Column(String, ForeignKey("lore_entries.id"), nullable=True)
    master_world_id = Column(String, ForeignKey("master_worlds.id"), nullable=False, index=True)
    master_world = relationship("MasterWorld", back_populates="lore_entries")
    image_url = Column(String, nullable=True)
    embedding_vector = Column(JSON, nullable=True) # New column for Mistral embeddings
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
