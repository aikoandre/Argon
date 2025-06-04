from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SessionRelationshipBase(BaseModel):
    entity1_id: str
    entity1_type: str  # e.g., 'user_persona', 'character_card', etc.
    entity2_id: str
    entity2_type: str  # e.g., 'user_persona', 'character_card', etc.
    trust_score: int = Field(default=0, ge=-100, le=100)
    affection_score: int = Field(default=0, ge=-100, le=100)
    rivalry_score: int = Field(default=0, ge=0, le=100)
    status_tags: List[str] = Field(default_factory=list)

class SessionRelationshipCreate(SessionRelationshipBase):
    chat_session_id: str

class SessionRelationshipUpdate(BaseModel):
    trust_score: Optional[int] = Field(None, ge=-100, le=100)
    affection_score: Optional[int] = Field(None, ge=-100, le=100)
    rivalry_score: Optional[int] = Field(None, ge=0, le=100)
    status_tags: Optional[List[str]] = None

class SessionRelationshipInDB(SessionRelationshipBase):
    id: str
    chat_session_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True