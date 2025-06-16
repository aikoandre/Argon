# backend/schemas/session_note.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SessionNoteBase(BaseModel):
    """Base schema for SessionNote"""
    note_content: str = Field(default="", description="Narrative content of the session note")
    last_updated_turn: int = Field(default=0, description="Turn number when last updated")
    entity_name: Optional[str] = Field(None, description="Name of entity for orphaned notes")


class SessionNoteCreate(SessionNoteBase):
    """Schema for creating a new SessionNote"""
    session_id: str = Field(..., description="ID of the chat session")
    lore_entry_id: Optional[str] = Field(None, description="ID of associated LoreEntry (null for orphaned notes)")


class SessionNoteUpdate(BaseModel):
    """Schema for updating an existing SessionNote"""
    note_content: Optional[str] = Field(None, description="Updated narrative content")
    last_updated_turn: Optional[int] = Field(None, description="Updated turn number")
    entity_name: Optional[str] = Field(None, description="Updated entity name")


class SessionNoteInDB(SessionNoteBase):
    """Schema for SessionNote as stored in database"""
    id: str
    session_id: str
    lore_entry_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SessionNoteResponse(SessionNoteInDB):
    """Schema for SessionNote API responses"""
    display_name: str = Field(..., description="Display name of the entity")
    is_orphaned: bool = Field(..., description="Whether this note lacks an associated LoreEntry")
    has_content: bool = Field(..., description="Whether this note has meaningful content")


# Schemas for bulk operations
class SessionNoteAnalysisUpdate(BaseModel):
    """Schema for updates identified by analysis LLM"""
    entity_description: str = Field(..., description="Description of entity to update")
    update_summary: str = Field(..., description="Summary of changes to apply")


class SessionNoteCreationRequest(BaseModel):
    """Schema for new entity creation from analysis"""
    entity_type: str = Field(..., description="Type of entity to create")
    creation_summary: str = Field(..., description="Summary for entity creation")


class SessionNoteOperationResult(BaseModel):
    """Schema for operation results"""
    success: bool = Field(..., description="Whether the operation succeeded")
    session_note_id: Optional[str] = Field(None, description="ID of created/updated SessionNote")
    error_message: Optional[str] = Field(None, description="Error message if operation failed")


class SessionNoteFailedOperation(BaseModel):
    """Schema for failed operations to return to Analysis LLM"""
    operation: str = Field(..., description="Type of operation (update/create)")
    entity_description: Optional[str] = Field(None, description="Entity description that failed to match")
    entity_type: Optional[str] = Field(None, description="Entity type for failed creation")
    failure_reason: str = Field(..., description="Specific reason for failure")
    original_content: str = Field(..., description="Original content to be reprocessed")
