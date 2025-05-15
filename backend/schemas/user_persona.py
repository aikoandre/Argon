# backend/schemas/user_persona.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid # Para o tipo UUID e default_factory

class UserPersonaBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    master_world_id: Optional[str] = None

class UserPersonaCreate(UserPersonaBase):
    pass

class UserPersonaUpdate(UserPersonaBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    # Permite atualização parcial
    master_world_id: Optional[str] = None

class UserPersonaInDB(UserPersonaBase):
    id: str # Ou uuid.UUID se preferir tipar como UUID aqui
    created_at: datetime
    updated_at: Optional[datetime] = None
    master_world_id: Optional[str] = None

    class Config:
        from_attributes = True # Para Pydantic V2 (era orm_mode = True)
