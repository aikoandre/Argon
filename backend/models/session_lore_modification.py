# backend/models/session_lore_modification.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base

class SessionLoreModification(Base):
    __tablename__ = "session_lore_modifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    base_lore_entry_id = Column(String, ForeignKey("lore_entries.id", ondelete="CASCADE"), nullable=False)
    
    # The field of the LoreEntry that is being modified (e.g., 'description', 'summary')
    field_to_update = Column(String, nullable=False)
    
    # The new content segment for the specified field. This is a partial update.
    new_content_segment = Column(Text, nullable=False)
    
    # Reason for the modification
    change_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    chat_session = relationship("ChatSession", back_populates="session_lore_modifications")
    base_lore_entry = relationship("LoreEntry") # Relationship to the original LoreEntry