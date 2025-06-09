from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum


class TaskType(str, Enum):
    """Enumeration of supported maintenance task types"""
    UPDATE_NOTE = "UPDATE_NOTE"
    CREATE_ENTITY = "CREATE_ENTITY"
    SIMULATE_WORLD = "SIMULATE_WORLD"


class TaskStatus(str, Enum):
    """Enumeration of task status values"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class MaintenanceQueueBase(BaseModel):
    """Base schema for maintenance queue items"""
    task_type: TaskType = Field(..., description="Type of maintenance task")
    task_data: Dict[str, Any] = Field(..., description="Task-specific data payload")
    priority: int = Field(default=0, description="Task priority (higher = more urgent)")


class MaintenanceQueueCreate(MaintenanceQueueBase):
    """Schema for creating new maintenance queue items"""
    pass


class MaintenanceQueueUpdate(BaseModel):
    """Schema for updating maintenance queue items"""
    status: Optional[TaskStatus] = Field(None, description="Task status")
    processed_at: Optional[datetime] = Field(None, description="When task was processed")
    error_message: Optional[str] = Field(None, description="Error message if task failed")


class MaintenanceQueueResponse(MaintenanceQueueBase):
    """Schema for maintenance queue item responses"""
    id: int = Field(..., description="Queue item ID")
    status: TaskStatus = Field(..., description="Current task status")
    created_at: datetime = Field(..., description="When task was created")
    processed_at: Optional[datetime] = Field(None, description="When task was processed")
    error_message: Optional[str] = Field(None, description="Error message if task failed")

    class Config:
        from_attributes = True


# Task-specific data schemas for type safety

class UpdateNoteTaskData(BaseModel):
    """Data structure for UPDATE_NOTE tasks"""
    entity_id: str = Field(..., description="ID of entity to update")
    entity_name: str = Field(..., description="Name of entity to update")
    current_note: str = Field(..., description="Current note content")
    new_information: str = Field(..., description="New information to incorporate")
    reasoning: str = Field(..., description="Why this update is needed")


class CreateEntityTaskData(BaseModel):
    """Data structure for CREATE_ENTITY tasks"""
    entity_type: str = Field(..., description="Type of entity (character, location, item, concept)")
    name: str = Field(..., description="Name of new entity")
    initial_data: str = Field(..., description="Initial information about entity")
    reasoning: str = Field(..., description="Why this entity should be created")
    context: Optional[str] = Field(None, description="Additional context for creation")


class SimulateWorldTaskData(BaseModel):
    """Data structure for SIMULATE_WORLD tasks"""
    targets: list[str] = Field(..., description="List of entity IDs to simulate")
    world_state: Dict[str, Any] = Field(..., description="Current world state information")
    time_info: str = Field(..., description="Information about time elapsed")


# Analysis Service Output Schema (used by Analysis Service)

class IntentionUpdate(BaseModel):
    """Single update intention from analysis"""
    entity_id: str = Field(..., description="ID of entity to update")
    update_type: str = Field(..., description="Type of update (note_update, etc.)")
    new_information: str = Field(..., description="New information discovered")
    reasoning: str = Field(..., description="Why this update is needed")


class IntentionCreation(BaseModel):
    """Single creation intention from analysis"""
    entity_type: str = Field(..., description="Type of entity to create")
    name: str = Field(..., description="Name of new entity")
    initial_data: str = Field(..., description="Key information about entity")
    reasoning: str = Field(..., description="Why this entity should be created")


class AnalysisIntentions(BaseModel):
    """Output format from Analysis Service"""
    updates: list[IntentionUpdate] = Field(default_factory=list, description="Entities to update")
    creations: list[IntentionCreation] = Field(default_factory=list, description="Entities to create")
