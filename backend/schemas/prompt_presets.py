# backend/schemas/prompt_presets.py
from pydantic import BaseModel, field_validator
from typing import Optional, List, Union
from datetime import datetime
import json

# PromptModule schemas
class PromptModuleBase(BaseModel):
    identifier: str
    name: str
    category: str
    content: str
    enabled: bool = True
    injection_position: int = 0
    injection_depth: int = 4
    injection_order: int = 0
    forbid_overrides: bool = False
    role: str = "system"
    # Service-specific fields
    applicable_services: Optional[List[str]] = None
    is_core_module: bool = False
    service_priority: int = 0

class PromptModuleCreate(PromptModuleBase):
    preset_id: str

class PromptModuleUpdate(BaseModel):
    identifier: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    enabled: Optional[bool] = None
    injection_position: Optional[int] = None
    injection_depth: Optional[int] = None
    injection_order: Optional[int] = None
    forbid_overrides: Optional[bool] = None
    role: Optional[str] = None
    # Service-specific fields
    applicable_services: Optional[List[str]] = None
    is_core_module: Optional[bool] = None
    service_priority: Optional[int] = None

class PromptModuleResponse(PromptModuleBase):
    id: str
    preset_id: str
    created_at: datetime
    updated_at: datetime
    
    @field_validator('applicable_services', mode='before')
    @classmethod
    def parse_applicable_services(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return v
    
    @field_validator('is_core_module', mode='before')
    @classmethod
    def parse_is_core_module(cls, v):
        if v is None:
            return False
        return v
    
    @field_validator('service_priority', mode='before')
    @classmethod
    def parse_service_priority(cls, v):
        if v is None:
            return 0
        return v
    
    class Config:
        from_attributes = True

# PromptPreset schemas
class PromptPresetBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_sillytavern_compatible: bool = False
    is_default: bool = False

class PromptPresetCreate(PromptPresetBase):
    pass

class PromptPresetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_sillytavern_compatible: Optional[bool] = None
    is_default: Optional[bool] = None

class PromptPresetResponse(PromptPresetBase):
    id: str
    created_at: datetime
    updated_at: datetime
    modules: List[PromptModuleResponse] = []
    
    class Config:
        from_attributes = True

# UserPromptConfiguration schemas
class UserPromptConfigurationBase(BaseModel):
    active_preset_id: Optional[str] = None
    temperature: float = 1.0
    top_p: float = 1.0
    max_tokens: Optional[int] = None
    reasoning_effort: str = "Medium"

class UserPromptConfigurationCreate(UserPromptConfigurationBase):
    user_id: int = 1

class UserPromptConfigurationUpdate(BaseModel):
    active_preset_id: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    max_tokens: Optional[int] = None
    reasoning_effort: Optional[str] = None

class UserPromptConfigurationResponse(UserPromptConfigurationBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
