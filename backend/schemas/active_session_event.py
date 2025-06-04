from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class ActiveSessionEventBase(BaseModel):
    session_id: str
    event_id: str = Field(..., description="ID of the LoreEntry (for fixed events) or a unique ID (for dynamic)")
    current_phase_id: Optional[str] = Field(None, description="Current phase of the event")
    status: str = Field("active", description="Status of the event (e.g., 'triggered', 'active', 'completed', 'failed')")
    event_type: str = Field(..., description="Type of event ('FIXED' or 'DYNAMIC')")
    dynamic_event_data: Optional[Dict[str, Any]] = Field(None, description="JSON for dynamic event details if not a LoreEntry")

class ActiveSessionEventCreate(ActiveSessionEventBase):
    pass

class ActiveSessionEventUpdate(BaseModel):
    current_phase_id: Optional[str] = None
    status: Optional[str] = None
    dynamic_event_data: Optional[Dict[str, Any]] = None

class ActiveSessionEventInDB(ActiveSessionEventBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True