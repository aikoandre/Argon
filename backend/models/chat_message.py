# backend/models/chat_message.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.database import Base

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False)
    
    sender_type = Column(String, nullable=False) # "USER", "AI", "SYSTEM"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    message_metadata = Column(JSON, nullable=True) # Para "pensamentos da IA", dados de RAG, etc.

    # New fields for storing persona details at the time of message creation
    active_persona_name = Column(String, nullable=True)
    active_persona_image_url = Column(String, nullable=True)
    is_beginning_message = Column(Boolean, default=False, nullable=True)

    # Relacionamento de volta para a sessão
    session = relationship("ChatSession", back_populates="messages")
