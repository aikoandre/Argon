# backend/models/temp_variant_memory.py
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.database import Base

class TempVariantMemory(Base):
    """
    Temporary storage for FAISS memory vectors associated with message variants.
    These are used for RAG during variant generation and are cleaned up automatically.
    """
    __tablename__ = "temp_variant_memory"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Reference to the variant this memory belongs to
    variant_id = Column(String, ForeignKey("temp_message_variants.id", ondelete="CASCADE"), nullable=False)
    chat_session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    
    # FAISS vector data
    faiss_vector_id = Column(String, nullable=False)  # ID in FAISS index
    vector_content = Column(Text, nullable=False)  # Original content that was embedded
    vector_metadata = Column(JSON, nullable=True)  # Metadata for FAISS
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    variant = relationship("TempMessageVariant", backref="memory_vectors")
    session = relationship("ChatSession")
