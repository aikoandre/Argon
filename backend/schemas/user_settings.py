from pydantic import BaseModel, Field
from typing import Optional, Text # Text was used in model, can be str here

class UserSettingsBase(BaseModel):
    llm_provider: Optional[str] = Field(None, description="E.g., OpenRouter, OpenAI, MistralDirect")
    selected_llm_model: Optional[str] = Field(None, description="E.g., gpt-4o, mistralai/Mixtral-8x7B-Instruct-v0.1")
    llm_api_key: Optional[str] = Field(None, description="LLM API Key (stored as plaintext)") # API key can be read/written
    generation_prompt_template: Optional[Text] = Field(None, description="Prompt template for response generation.")
    language: Optional[str] = Field(default="Português", description="Language for AI responses.")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Temperature for LLM generation.")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top_p for LLM generation.")
    max_response_tokens: Optional[int] = Field(None, gt=0, description="Maximum tokens for AI response.")
    context_size: Optional[int] = Field(None, gt=0, description="Number of history messages or context token limit.")
    active_persona_id: Optional[str] = Field(None, description="ID of the active UserPersona.")

class UserSettingsUpdate(UserSettingsBase):
    # All fields are optional for update, inheriting from UserSettingsBase
    pass

class UserSettingsInDB(UserSettingsBase):
    id: int # The fixed ID (default 1)

    class Config:
        from_attributes = True # Pydantic V2 (formerly orm_mode = True)
