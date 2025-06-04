# backend/schemas/extracted_knowledge.py
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime
from uuid import UUID

class ExtractedKnowledgeBase(BaseModel):
    chat_session_id: UUID
    source_message_id: UUID
    extracted_content: Dict[str, Any] = Field(..., description="JSON content extracted by the LLM")
    embedding_vector: Optional[List[float]] = Field(None, description="Vector embedding of the extracted content")

class ExtractedKnowledgeCreate(ExtractedKnowledgeBase):
    pass

class ExtractedKnowledgeInDB(ExtractedKnowledgeBase):
    id: UUID
    timestamp: datetime

    class Config:
        from_attributes = True # Pydantic V2 (formerly orm_mode = True)