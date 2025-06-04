# backend/models/session_cache_fact.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Float
from sqlalchemy import JSON # Use generic JSON for broader compatibility
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class SessionCacheFact(Base):
    __tablename__ = "session_cache_facts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    
    # The extracted fact text
    text = Column(Text, nullable=False)
    
    # Key-value fields for panel data and structured facts
    key = Column(String, nullable=True)  # For panel data like "current_time", "current_location"
    value = Column(Text, nullable=True)  # The corresponding value
    
    # Optional fields from the NewFact schema
    relevance_score = Column(Float, nullable=True)
    tags = Column(JSON, nullable=True) # Storing list of strings as JSON

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    chat_session = relationship("ChatSession", back_populates="session_cache_facts")