# backend-python/routers/cards.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
import uuid
from typing import List

# Use importações absolutas a partir da raiz do pacote 'backend'
from backend import models as api_models # Pydantic models
from backend.db import crud, models as db_models # CRUD functions and DB models
from backend.db.database import get_db # DB session dependency
from backend.services import mistral_client # Para enfileirar embeddings

router = APIRouter(
    prefix="/api/cards", # Prefixo para todas as rotas neste arquivo
    tags=["Cards"],      # Agrupamento na documentação Swagger/OpenAPI
)

# --- Global Lore Endpoints ---

@router.post("/lore", response_model=api_models.GlobalLoreCard, status_code=status.HTTP_201_CREATED)
async def create_new_global_lore(
    lore: api_models.GlobalLoreCardCreate,
    background_tasks: BackgroundTasks, # Injeta BackgroundTasks
    db: Session = Depends(get_db)      # Injeta sessão do DB
):
    """Cria um novo cartão de Global Lore."""
    db_lore = crud.create_global_lore(db=db, lore=lore)

    # Enfileira a tarefa de embedding para o conteúdo do cartão
    task_data = {"card_id": str(db_lore.id), "text": db_lore.content} # Passa ID como string
    background_tasks.add_task(mistral_client.add_embedding_task, task_data)
    print(f"Lore card {db_lore.id} criado, tarefa de embedding adicionada.")

    return db_lore # Retorna o objeto criado (Pydantic fará a conversão)

@router.get("/lore/{lore_id}", response_model=api_models.GlobalLoreCard)
def read_global_lore(lore_id: uuid.UUID, db: Session = Depends(get_db)):
    """Obtém um cartão de Global Lore pelo ID."""
    db_lore = crud.get_global_lore(db=db, lore_id=lore_id)
    if db_lore is None:
        raise HTTPException(status_code=404, detail="Global Lore Card not found")
    return db_lore

@router.get("/lore", response_model=List[api_models.GlobalLoreCard])
def read_all_global_lore(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Lista todos os cartões de Global Lore."""
    lore_list = crud.get_all_global_lore(db=db, skip=skip, limit=limit)
    return lore_list

# ... (Implementar PUT e DELETE depois) ...

# --- Adicionar endpoints para ScenarioCard, CharacterCard, etc. aqui ---
