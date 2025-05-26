from pydantic import BaseModel, Field
from typing import Optional, Text # Text was used in model, can be str here

class UserSettingsBase(BaseModel):
    llm_provider: Optional[str] = Field(None, description="E.g., OpenRouter, OpenAI, MistralDirect")
    selected_llm_model: Optional[str] = Field(None, description="E.g., gpt-4o, mistralai/Mixtral-8x7B-Instruct-v0.1")
    primary_llm_api_key: Optional[str] = Field(None, description="API Key for the primary LLM (stored as plaintext)")
    planning_llm_api_key: Optional[str] = Field(None, description="API Key for the planning LLM (stored as plaintext)")
    extraction_llm_api_key: Optional[str] = Field(None, description="API Key for the extraction LLM (stored as plaintext)")
    analysis_llm_api_key: Optional[str] = Field(None, description="API Key for the analysis LLM (stored as plaintext)")
    mistral_api_key: Optional[str] = Field(None, description="Mistral AI API Key (stored as plaintext)")
    extraction_llm_model: Optional[str] = Field(None, description="Model for information extraction LLM (e.g., OpenRouter)")
    planning_llm_model: Optional[str] = Field(None, description="Model for response planning LLM (e.g., DeepSeek Coder V2)")
    analysis_llm_model: Optional[str] = Field(None, description="Model for analysis LLM (e.g., OpenRouter)")
    generation_prompt_template: Optional[str] = Field(None, description="Prompt template for response generation.")
    language: Optional[str] = Field(default="Português", description="Language for AI responses.")
    interaction_analysis_prompt_template: Optional[str] = Field(None, description="Prompt template for interaction analysis LLM.")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Temperature for LLM generation.")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top_p for LLM generation.")
    max_response_tokens: Optional[int] = Field(None, gt=0, description="Maximum tokens for AI response.")
    context_size: Optional[int] = Field(None, gt=0, description="Number of history messages or context token limit.")
    max_messages_for_context: Optional[int] = Field(None, gt=0, description="Maximum number of messages to include in LLM context.")
    active_persona_id: Optional[str] = Field(None, description="ID of the active UserPersona.")

class UserSettingsUpdate(UserSettingsBase):
    # All fields are optional for update, inheriting from UserSettingsBase
    pass

class UserSettingsInDB(UserSettingsBase):
    id: int # The fixed ID (default 1)

    class Config:
        from_attributes = True # Pydantic V2 (formerly orm_mode = True)
