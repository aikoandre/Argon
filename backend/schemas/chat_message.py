# backend/schemas/chat_message.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

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

    class Config:
        from_attributes = True
