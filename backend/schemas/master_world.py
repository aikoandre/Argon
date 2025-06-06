# backend/schemas/master_world.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class MasterWorldBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)

class MasterWorldCreate(MasterWorldBase):
    pass

class MasterWorldUpdate(BaseModel): # Para atualização parcial
    name: Optional[str] = Field(None, min_length=1, max_length=150)

class MasterWorldInDB(MasterWorldBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    # lore_entries_count: Optional[int] = None # Pode adicionar para contagem

    class Config:
        from_attributes = True
