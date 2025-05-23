# backend/schemas/user_persona.py
from pydantic import BaseModel, Field, validator # Import validator
from typing import Optional
from datetime import datetime
import uuid # Para o tipo UUID e default_factory
from fastapi import Form # Import Form for form data handling

class UserPersonaBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    master_world_id: Optional[str] = None
    image_url: Optional[str] = None

class UserPersonaCreate(UserPersonaBase):
    @classmethod
    def as_form(
        cls,
        name: str = Form(..., min_length=1, max_length=100),
        description: Optional[str] = Form(None),
        master_world_id: Optional[str] = Form(None),
    ):
        return cls(name=name, description=description, master_world_id=master_world_id)

class UserPersonaUpdate(UserPersonaBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    # Permite atualização parcial
    master_world_id: Optional[str] = None
    image_url: Optional[str] = None

    @classmethod
    def as_form(
        cls,
        name: Optional[str] = Form(None, min_length=1, max_length=100),
        description: Optional[str] = Form(None),
        master_world_id: Optional[str] = Form(None),
    ):
        # Return only fields that are provided to allow partial updates
        return cls(name=name, description=description, master_world_id=master_world_id)

class UserPersonaInDB(UserPersonaBase):
    id: str # Ou uuid.UUID se preferir tipar como UUID aqui
    created_at: datetime
    updated_at: Optional[datetime] = None
    master_world_id: Optional[str] = None
    image_url: Optional[str] = None

    @validator('name', pre=True, always=True)
    def ensure_name_not_empty(cls, value):
        # If the value is None or an empty string after stripping whitespace,
        # return a default placeholder. Otherwise, return the original value.
        if not value or len(str(value).strip()) == 0:
            return "Unnamed Persona" # You can choose any suitable placeholder
        return value

    class Config:
        from_attributes = True # Para Pydantic V2 (era orm_mode = True)
