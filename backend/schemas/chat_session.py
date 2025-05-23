# backend/schemas/chat_session.py
from pydantic import BaseModel, Field
from typing import Optional, List # Importe List se for usar para mensagens
from datetime import datetime
import uuid
# Importe os schemas dos cartões referenciados se quiser incluí-los na resposta
# from .scenario_card import ScenarioCardInDB
# from .character_card import CharacterCardInDB
# from .user_persona import UserPersonaInDB
# from .chat_message import ChatMessageInDB # Se for incluir mensagens

class ChatSessionBase(BaseModel):
    title: Optional[str] = Field(None, max_length=150)
    scenario_id: Optional[str] = None
    gm_character_id: Optional[str] = None
    user_persona_id: Optional[str] = None

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSessionUpdate(BaseModel): # Para atualizar, por exemplo, o título
    title: Optional[str] = Field(None, max_length=150)

class ChatSessionInDBBase(ChatSessionBase): # Base para respostas que incluem o ID
    id: str # Ou uuid.UUID
    created_at: datetime
    last_active_at: datetime
    
    class Config:
        from_attributes = True

# Schema para listar sessões (pode ser mais leve)
class ChatSessionListed(BaseModel):
    id: str
    title: Optional[str]
    last_active_at: datetime
    card_type: Optional[str] = None
    card_id: Optional[str] = None
    card_name: Optional[str] = None
    card_image_url: Optional[str] = None
    message_count: int = 0 # Adicionado para contar mensagens

    class Config:
        from_attributes = True

# Schema completo para resposta, incluindo objetos relacionados (opcional)
class ChatSessionInDB(ChatSessionInDBBase):
    # Para incluir detalhes dos cartões referenciados na resposta da API:
    # scenario: Optional[ScenarioCardInDB] = None
    # gm_character: Optional[CharacterCardInDB] = None
    # user_persona: Optional[UserPersonaInDB] = None
    # messages: List[ChatMessageInDB] = [] # Se quiser carregar mensagens junto com a sessão
    pass
