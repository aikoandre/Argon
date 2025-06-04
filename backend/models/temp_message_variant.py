# backend/models/temp_message_variant.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Integer, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base

class TempMessageVariant(Base):
    """
    Temporary storage for message variants during the editing/navigation phase.
    These records are automatically cleaned up when the user sends a new message.
    """
    __tablename__ = "temp_message_variants"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Reference to the original message being varied
    original_message_id = Column(String, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False)
    chat_session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    
    # Variant-specific data
    variant_index = Column(Integer, nullable=False)  # 0, 1, 2, etc.
    content = Column(Text, nullable=False)
    sender_type = Column(String, nullable=False)  # "USER", "AI", "SYSTEM"
    
    # Persona information for this variant
    active_persona_name = Column(String, nullable=True)
    active_persona_image_url = Column(String, nullable=True)
    
    # Metadata for this variant (usage, etc.)
    message_metadata = Column(JSON, nullable=True)
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    original_message = relationship("ChatMessage", backref="temp_variants")
    session = relationship("ChatSession")
