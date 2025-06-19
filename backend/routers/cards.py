# backend-python/routers/cards.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
import uuid
from typing import List

# Use importações absolutas a partir da raiz do pacote 'backend'
from backend import models as api_models # Pydantic models
from backend.db import crud, models as db_models # CRUD functions and DB models
from db.database import get_db # DB session dependency
from services.litellm_service import litellm_service # LiteLLM service for embeddings
from services.faiss_service import get_faiss_index # FAISS service for embeddings

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

    # Generate embedding directly using LiteLLM service
    try:
        # Get user settings for embedding generation (assuming ID 1 for global settings)
        from models.user_settings import UserSettings as UserSettingsModel
        
        db_settings = db.query(UserSettingsModel).filter(UserSettingsModel.id == 1).first()
        if db_settings:
            user_settings_dict = {
                "embedding_llm_provider": getattr(db_settings, "embedding_llm_provider", "mistral"),
                "embedding_llm_model": getattr(db_settings, "embedding_llm_model", "mistral-embed"),
                "embedding_llm_api_key": getattr(db_settings, "embedding_llm_api_key", None) or db_settings.mistral_api_key,
            }
            
            # Generate embedding using LiteLLM service
            embeddings = await litellm_service.get_service_completion(
                service_type="embedding",
                messages=[],  # Not used for embedding
                user_settings=user_settings_dict,
                input_text=db_lore.content
            )
            
            if embeddings and len(embeddings) > 0:
                embedding_vector = embeddings[0]
                
                # Add to FAISS index
                faiss_index = get_faiss_index()
                await faiss_index.add_embedding(str(db_lore.id), embedding_vector, "global_lore")
                
                print(f"Lore card {db_lore.id} criado, embedding gerado e adicionado ao FAISS.")
            else:
                print(f"Falha ao gerar embedding para o lore card {db_lore.id}.")
        else:
            print(f"Configurações de usuário não encontradas. Pulando embedding para o lore card {db_lore.id}.")
    except Exception as e:
        print(f"Erro ao gerar embedding para o lore card {db_lore.id}: {e}")

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
