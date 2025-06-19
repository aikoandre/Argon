# backend/models/session_note.py
import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from db.database import Base


class SessionNote(Base):
    """
    Session-specific narrative notes for entities.
    
    Provides flexible, narrative-based memory updates for LoreEntries within
    specific chat sessions. Can also exist as orphaned notes for temporary
    entities that don't warrant full LoreEntry creation.
    """
    __tablename__ = "session_notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False, index=True)
    lore_entry_id = Column(String, ForeignKey('lore_entries.id', ondelete='CASCADE'), nullable=True, index=True)
    
    # Content fields
    note_content = Column(Text, default='', nullable=False)
    last_updated_turn = Column(Integer, default=0, nullable=False)
    entity_name = Column(String(255), nullable=True, index=True)  # For orphaned notes without LoreEntry
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    chat_session = relationship("ChatSession", back_populates="session_notes")
    lore_entry = relationship("LoreEntry", back_populates="session_notes")

    def __repr__(self):
        entity_ref = f"lore_entry_id={self.lore_entry_id}" if self.lore_entry_id else f"entity_name='{self.entity_name}'"
        return f"<SessionNote(id={self.id}, session_id={self.session_id}, {entity_ref})>"

    @property
    def display_name(self):
        """Get the display name for this entity, preferring LoreEntry name over entity_name"""
        if self.lore_entry:
            return self.lore_entry.name
        return self.entity_name or "Unknown Entity"

    @property
    def is_orphaned(self):
        """Check if this is an orphaned note (no associated LoreEntry)"""
        return self.lore_entry_id is None

    def has_content(self):
        """Check if this note has meaningful content"""
        return bool(self.note_content and self.note_content.strip())
