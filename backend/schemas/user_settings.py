# backend/schemas/user_settings.py
from pydantic import BaseModel
from typing import Optional

class UserSettingsBase(BaseModel):
    selected_llm_model: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    # Adicione mais campos aqui

class UserSettingsCreate(UserSettingsBase):
    pass

class UserSettingsUpdate(UserSettingsBase):
    pass

class UserSettingsInDB(UserSettingsBase):
    id: int = 1 # Sempre 1 para a configuração global

    class Config:
        orm_mode = True # Mudança para Pydantic V2: from_attributes = True
