# backend/schemas/character_card.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class CharacterCardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    instructions: Optional[str] = None
    image_url: Optional[str] = None
    example_dialogues: Optional[List[str]] = Field(default_factory=list)
    beginning_messages: Optional[List[str]] = Field(default_factory=list)
    linked_lore_ids: Optional[List[str]] = Field(default_factory=list)
    master_world_id: Optional[str] = None

class CharacterCardCreate(CharacterCardBase):
    pass  # Inherits master_world_id from CharacterCardBase

class CharacterCardUpdate(BaseModel): # Permite atualização parcial mais flexível
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    instructions: Optional[str] = None
    image_url: Optional[str] = None
    example_dialogues: Optional[List[str]] = None
    beginning_messages: Optional[List[str]] = None
    linked_lore_ids: Optional[List[str]] = None
    master_world_id: Optional[str] = None

class CharacterCardInDB(CharacterCardBase):
    id: str # Ou uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

