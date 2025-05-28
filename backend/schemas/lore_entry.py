from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

VALID_ENTRY_TYPES = ["CHARACTER_LORE", "LOCATION", "FACTION", "ITEM", "CONCEPT", "OTHER", "NARRATIVE_EVENT"]

class LoreEntryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    entry_type: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    aliases: Optional[List[str]] = None
    faction_id: Optional[str] = None
    master_world_id: str
    event_data: Optional[Dict[str, Any]] = None # New field for fixed event data

    @validator('entry_type')
    def entry_type_must_be_valid(cls, value):
        if value not in VALID_ENTRY_TYPES:
            raise ValueError(f"entry_type must be one of {VALID_ENTRY_TYPES}")
        return value

class LoreEntryCreate(LoreEntryBase):
    pass

class LoreEntryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    entry_type: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    aliases: Optional[List[str]] = None
    faction_id: Optional[str] = None
    event_data: Optional[Dict[str, Any]] = None # New field for fixed event data

    @validator('entry_type')
    def entry_type_must_be_valid_on_update(cls, value):
        if value is not None and value not in VALID_ENTRY_TYPES:
            raise ValueError(f"entry_type must be one of {VALID_ENTRY_TYPES}")
        return value

class LoreEntryInDB(LoreEntryBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True
