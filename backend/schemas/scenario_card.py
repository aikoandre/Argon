# backend/schemas/scenario_card.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class ScenarioCardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    instructions: Optional[str] = None
    image_url: Optional[str] = None
    beginning_message: Optional[List[str]] = None
    example_dialogues: Optional[List[str]] = None
    world_card_references: Optional[List[str]] = None
    master_world_id: Optional[str] = None

class ScenarioCardCreate(ScenarioCardBase):
    pass

class ScenarioCardUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    instructions: Optional[str] = None
    beginning_message: Optional[List[str]] = None
    example_dialogues: Optional[List[str]] = None
    world_card_references: Optional[List[str]] = None
    master_world_id: Optional[str] = None

class ScenarioCardInDB(ScenarioCardBase):
    id: str
    user_persona_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

