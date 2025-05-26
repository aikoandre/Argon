# backend/schemas/chat_message.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid
from backend.schemas.ai_plan import AIPlan, PanelData # New import

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

class UserMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)

class ChatTurnResponse(BaseModel):
    user_message: ChatMessageInDB
    ai_message: ChatMessageInDB
    ai_plan: Optional[AIPlan] = None # Include the AI plan in the response
    panel_data_update: Optional[PanelData] = None # Include panel data update in the response
