# backend/schemas/session_lore_modification.py
from pydantic import BaseModel, Field
from typing import Optional
import datetime

class SessionLoreModificationBase(BaseModel):
    chat_session_id: str = Field(..., description="The ID of the chat session this modification belongs to.")
    base_lore_entry_id: str = Field(..., description="The ID of the canonical LoreEntry being modified.")
    field_to_update: str = Field(..., description="The specific field of the LoreEntry that is being modified (e.g., 'description', 'summary').")
    new_content_segment: str = Field(..., description="The new content segment for the specified field. This is a partial update.")
    change_reason: Optional[str] = Field(None, description="The reason for this lore modification, as determined by the AI.")

class SessionLoreModificationCreate(SessionLoreModificationBase):
    pass

class SessionLoreModification(SessionLoreModificationBase):
    id: str = Field(..., description="The unique ID of the session lore modification.")
    created_at: datetime.datetime = Field(..., description="Timestamp when the modification was created.")
    updated_at: datetime.datetime = Field(..., description="Timestamp when the modification was last updated.")

    class Config:
        from_attributes = True