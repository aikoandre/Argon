# backend/schemas/user_prompt_instructions.py
from pydantic import BaseModel
from typing import Optional

class UserPromptInstructionsBase(BaseModel):
    primary_instructions: Optional[str] = ""
    extraction_instructions: Optional[str] = ""
    analysis_instructions: Optional[str] = ""

class UserPromptInstructionsCreate(UserPromptInstructionsBase):
    pass

class UserPromptInstructionsUpdate(UserPromptInstructionsBase):
    pass

class UserPromptInstructionsInDB(UserPromptInstructionsBase):
    id: int
    
    class Config:
        from_attributes = True

# Alias for API responses
UserPromptInstructionsResponse = UserPromptInstructionsInDB
