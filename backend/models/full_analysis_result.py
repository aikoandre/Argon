import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from backend.database import Base

class FullAnalysisResult(Base):
    __tablename__ = "full_analysis_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    source_message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=False)
    analysis_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=func.now())

    def __repr__(self):
        return f"<FullAnalysisResult(id={self.id}, chat_session_id={self.chat_session_id}, source_message_id={self.source_message_id})>"
