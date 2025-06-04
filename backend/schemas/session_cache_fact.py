# backend/schemas/session_cache_fact.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SessionCacheFactBase(BaseModel):
    text: str = Field(..., description="The extracted fact text")
    key: Optional[str] = Field(None, description="Optional key for structured data")
    value: Optional[str] = Field(None, description="Optional value for structured data")
    relevance_score: Optional[float] = Field(None, description="Relevance score between 0 and 1")
    tags: Optional[List[str]] = Field(None, description="List of tags for categorization")

class SessionCacheFactCreate(SessionCacheFactBase):
    chat_session_id: str = Field(..., description="ID of the associated chat session")

class SessionCacheFactUpdate(SessionCacheFactBase):
    text: Optional[str] = Field(None, description="The extracted fact text")

class SessionCacheFactInDB(SessionCacheFactBase):
    id: str
    chat_session_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class SessionCacheFact(SessionCacheFactInDB):
    pass
