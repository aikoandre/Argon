# backend-python/models.py
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

# --- Modelos para API (Pydantic) ---

class GlobalLoreCardBase(BaseModel):
    title: str
    content: str
    tags: List[str] = [] # Lista de tags/palavras-chave

class GlobalLoreCardCreate(GlobalLoreCardBase):
    pass # Nenhuma diferença para criar por enquanto

class GlobalLoreCard(GlobalLoreCardBase):
    id: uuid.UUID # Usar UUID para IDs únicos
    # Poderíamos adicionar campos de embedding aqui depois,
    # ou mantê-los separados no armazenamento vetorial.

    class Config:
        from_attributes = True # Permite criar a partir de objetos ORM

# --- Novos Modelos para ScenarioCard ---

class ScenarioCardBase(BaseModel):
    scenario_name: str
    scenario_description: str
    tags: List[str] = [] # Lista de tags/palavras-chave específicas do cenário

class ScenarioCardCreate(ScenarioCardBase):
    pass # Nenhuma diferença para criar por enquanto

class ScenarioCard(ScenarioCardBase):
    id: uuid.UUID # Usar UUID para IDs únicos para cenários
    # Poderíamos adicionar campos de embedding aqui depois,
    # ou mantê-los separados no armazenamento vetorial.

    class Config:
        from_attributes = True # Permite criar a partir de objetos ORM
