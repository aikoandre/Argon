# backend/models/user_settings.py
from sqlalchemy import Column, Integer, String, Boolean # Boolean é opcional, só se for usar
from ..database import Base

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, default=1)
    selected_llm_model = Column(String, default="GPT-4o")
    openrouter_api_key = Column(String, nullable=True)
    # format_thoughts_italic = Column(Boolean, default=True) # Exemplo de outro campo