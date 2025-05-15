# backend/schemas/scenario_card.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class ScenarioCardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    beginning_message: Optional[List[str]] = None
    user_persona_id: Optional[str] = None
    world_card_references: Optional[List[str]] = None
    master_world_id: Optional[str] = None
class ScenarioCardCreate(ScenarioCardBase):
    pass

class ScenarioCardUpdate(BaseModel): # Atualização parcial
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    beginning_message: Optional[List[str]] = None
    user_persona_id: Optional[str] = None
    # Alterado o tipo para List[str] para refletir que são IDs de World Cards
    world_card_references: Optional[List[str]] = None
    master_world_id: Optional[str] = None

class ScenarioCardInDB(ScenarioCardBase):
    id: str # Ou uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

