# backend/schemas/character_card.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class CharacterCardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    instructions: Optional[str] = None
    example_dialogues: Optional[List[Dict[str, str]]] = None # Ex: [{"speaker": "npc", "line": "Olá!"}] ou List[str]
    beginning_message: Optional[str] = None

class CharacterCardCreate(CharacterCardBase):
    pass

class CharacterCardUpdate(BaseModel): # Permite atualização parcial mais flexível
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    instructions: Optional[str] = None
    example_dialogues: Optional[List[Dict[str, str]]] = None
    beginning_message: Optional[str] = None

class CharacterCardInDB(CharacterCardBase):
    id: str # Ou uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True