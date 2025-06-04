import uuid
from sqlalchemy import Column, String, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.sql.sqltypes import TIMESTAMP
from ..database import Base

class ActiveSessionEvent(Base):
    __tablename__ = "active_session_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    event_id = Column(String, nullable=False, index=True) # ID of the LoreEntry (for fixed events) or a unique ID (for dynamic)
    current_phase_id = Column(String, nullable=True) # Current phase of the event
    status = Column(String, nullable=False, default="active") # e.g., "triggered", "active", "completed", "failed"
    event_type = Column(String, nullable=False) # "FIXED" or "DYNAMIC"
    dynamic_event_data = Column(JSON, nullable=True) # JSON for dynamic event details if not a LoreEntry
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    session = relationship("ChatSession", back_populates="active_events")