# backend/models/extracted_knowledge.py
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON # Import JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from db.database import Base

class ExtractedKnowledge(Base):
    __tablename__ = "extracted_knowledge"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)

    source_message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False)
    extracted_content = Column(JSON, nullable=False) # Changed to JSON for SQLite compatibility
    embedding_vector = Column(JSON, nullable=True) # Changed to JSON for SQLite compatibility
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    chat_session = relationship("ChatSession", back_populates="extracted_knowledge")
    source_message = relationship("ChatMessage")

    def __repr__(self):
        return f"<ExtractedKnowledge(id={self.id}, chat_session_id={self.chat_session_id}, source_message_id={self.source_message_id})>"