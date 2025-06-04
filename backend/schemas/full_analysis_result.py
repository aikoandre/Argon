from pydantic import BaseModel, Field
from typing import Any, Dict
from datetime import datetime
from uuid import UUID

class FullAnalysisResultBase(BaseModel):
    chat_session_id: UUID
    source_message_id: UUID
    analysis_data: Dict[str, Any]

class FullAnalysisResultCreate(FullAnalysisResultBase):
    pass

class FullAnalysisResultInDB(FullAnalysisResultBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True