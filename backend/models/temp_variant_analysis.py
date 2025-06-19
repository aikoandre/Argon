# backend/models/temp_variant_analysis.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.database import Base

class TempVariantAnalysis(Base):
    """
    Temporary storage for Full Analysis results associated with message variants.
    Automatically cleaned up when variants are cleaned up.
    """
    __tablename__ = "temp_variant_analysis"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Reference to the variant this analysis belongs to
    variant_id = Column(String, ForeignKey("temp_message_variants.id", ondelete="CASCADE"), nullable=False)
    chat_session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    
    # Analysis data
    analysis_data = Column(JSON, nullable=False)  # Full Analysis JSON result
    user_message_content = Column(Text, nullable=False)
    ai_response_content = Column(Text, nullable=False)
    rag_results = Column(JSON, nullable=True)  # RAG context used
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    variant = relationship("TempMessageVariant", backref="analysis")
    session = relationship("ChatSession")
