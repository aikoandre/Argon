# backend/routers/personas.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

# Importe o modelo SQLAlchemy e os schemas Pydantic
from ..models.user_persona import UserPersona
from ..schemas.user_persona import UserPersonaCreate, UserPersonaUpdate, UserPersonaInDB
from ..models.master_world import MasterWorld

from ..database import get_db

router = APIRouter(
    prefix="/api/personas",
    tags=["User Personas"], # Tag para agrupar na documentação da API
)

@router.post("", response_model=UserPersonaInDB, status_code=status.HTTP_201_CREATED)
def create_user_persona(
    persona: UserPersonaCreate, db: Session = Depends(get_db)
):
    """
    Cria uma nova User Persona.
    """
    # Validate master_world_id if provided
    if persona.master_world_id:
        world = db.query(MasterWorld).filter(MasterWorld.id == persona.master_world_id).first()
        if not world:
            raise HTTPException(status_code=400, detail="Master World not found")
    db_persona = UserPersona(**persona.model_dump()) # Pydantic V2
    # Para Pydantic V1: db_persona = UserPersona(**persona.dict())
    db.add(db_persona)
    db.commit()
    db.refresh(db_persona)
    return db_persona

@router.get("", response_model=List[UserPersonaInDB])
def get_all_user_personas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Lista todas as User Personas.
    """
    personas = db.query(UserPersona).offset(skip).limit(limit).all()
    return personas

@router.get("/{persona_id}", response_model=UserPersonaInDB)
def get_user_persona(persona_id: str, db: Session = Depends(get_db)):
    """
    Obtém detalhes de uma User Persona específica pelo ID.
    """
    db_persona = db.query(UserPersona).filter(UserPersona.id == persona_id).first()
    if db_persona is None:
        raise HTTPException(status_code=404, detail="User Persona not found")
    return db_persona

@router.put("/{persona_id}", response_model=UserPersonaInDB)
def update_user_persona(
    persona_id: str, persona_update: UserPersonaUpdate, db: Session = Depends(get_db)
):
    """
    Atualiza uma User Persona existente. Permite atualização parcial.
    """
    db_persona = db.query(UserPersona).filter(UserPersona.id == persona_id).first()
    if db_persona is None:
        raise HTTPException(status_code=404, detail="User Persona not found")

    update_data = persona_update.model_dump(exclude_unset=True) # Pydantic V2
    # Para Pydantic V1: update_data = persona_update.dict(exclude_unset=True)

    # Validate master_world_id if provided
    if "master_world_id" in update_data and update_data["master_world_id"]:
        world = db.query(MasterWorld).filter(MasterWorld.id == update_data["master_world_id"]).first()
        if not world:
            raise HTTPException(status_code=400, detail="Master World not found")

    for key, value in update_data.items():
        setattr(db_persona, key, value)

    db.add(db_persona) # Adiciona ao estado da sessão para registrar a mudança
    db.commit()
    db.refresh(db_persona)
    return db_persona

@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_persona(persona_id: str, db: Session = Depends(get_db)):
    """
    Deleta uma User Persona existente.
    """
    db_persona = db.query(UserPersona).filter(UserPersona.id == persona_id).first()
    if db_persona is None:
        raise HTTPException(status_code=404, detail="User Persona not found")

    db.delete(db_persona)
    db.commit()
    return None # Retorna None para status 204
