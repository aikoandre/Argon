# backend/schemas/chat_message.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid
from backend.schemas.character_card import CharacterCardBase # New import
from backend.schemas.scenario_card import ScenarioCardBase # New import

class ChatMessageBase(BaseModel):
    sender_type: str = Field(..., pattern="^(USER|AI|SYSTEM)$") # Valida os tipos de remetente
    content: str
    message_metadata: Optional[Dict[str, Any]] = None
    active_persona_name: Optional[str] = None
    active_persona_image_url: Optional[str] = None

class ChatMessageCreate(ChatMessageBase):
    # chat_session_id será fornecido pela rota/lógica, não pelo payload do cliente diretamente
    pass

class ChatMessageInDB(ChatMessageBase):
    id: str # Ou uuid.UUID
    chat_session_id: str # Ou uuid.UUID
    timestamp: datetime
    is_beginning_message: Optional[bool] = False

    class Config:
        from_attributes = True

class UserMessageInput(BaseModel):
    content: str = Field(..., min_length=1)
    user_persona_id: Optional[str] = None
    current_beginning_message_index: Optional[int] = None # New field

class AIPersonaCardInfo(BaseModel):
    id: str
    name: str
    image_url: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None

    class Config:
        from_attributes = True

class UserPersonaInfo(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True

class ChatTurnResponse(BaseModel):
    user_message: ChatMessageInDB
    ai_message: ChatMessageInDB
    ai_persona_card: Optional[AIPersonaCardInfo] = None # Include AI persona card info
