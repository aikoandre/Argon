# backend/routers/personas.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import logging

logger = logging.getLogger(__name__)

# Importe o modelo SQLAlchemy e os schemas Pydantic
from models.user_persona import UserPersona
from schemas.user_persona import UserPersonaCreate, UserPersonaUpdate, UserPersonaInDB
from models.master_world import MasterWorld

from database import get_db

router = APIRouter(
    prefix="/api/personas",
    tags=["User Personas"], # Tag para agrupar na documentação da API
)

@router.post("", response_model=UserPersonaInDB, status_code=status.HTTP_201_CREATED)
async def create_user_persona(
    persona_create: UserPersonaCreate = Depends(UserPersonaCreate.as_form),
    image: Optional[UploadFile] = None,
    db: Session = Depends(get_db)
):
    """
    Create a new User Persona.
    """
    persona_data = persona_create.model_dump(exclude_unset=True)

    # Validate master_world_id if provided
    if persona_data.get("master_world_id"):
        world = db.query(MasterWorld).filter(MasterWorld.id == persona_data["master_world_id"]).first()
        if not world:
            raise HTTPException(status_code=400, detail="Master World not found")

    if image:
        from file_storage import save_uploaded_file
        image_url = await save_uploaded_file(
            image,
            entity_type="persona",
            entity_name=persona_create.name
        )
        persona_data["image_url"] = image_url

    db_persona = UserPersona(**persona_data)
    db.add(db_persona)
    db.commit()
    db.refresh(db_persona)
    return UserPersonaInDB.from_orm(db_persona)

@router.get("", response_model=List[UserPersonaInDB])
def get_all_user_personas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Lista todas as User Personas.
    """
    try:
        personas = db.query(UserPersona).offset(skip).limit(limit).all()
        # Convert SQLAlchemy models to Pydantic models
        return [UserPersonaInDB.from_orm(persona) for persona in personas]
    except Exception as e:
        # Log the error for debugging
        logger.error(f"Error fetching user personas: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{persona_id}", response_model=UserPersonaInDB)
def get_user_persona(persona_id: str, db: Session = Depends(get_db)):
    """
    Obtém detalhes de uma User Persona específica pelo ID.
    """
    db_persona = db.query(UserPersona).filter(UserPersona.id == persona_id).first()
    if db_persona is None:
        raise HTTPException(status_code=404, detail="User Persona not found")
    return UserPersonaInDB.from_orm(db_persona)

@router.put("/{persona_id}", response_model=UserPersonaInDB)
async def update_user_persona(
    persona_id: str,
    update_data_model: UserPersonaUpdate = Depends(UserPersonaUpdate.as_form),
    image: Optional[UploadFile] = None,
    remove_image: bool = Form(False),
    db: Session = Depends(get_db)
):
    """
    Update an existing User Persona.
    """
    update_data = update_data_model.model_dump(exclude_unset=True)

    db_persona = db.query(UserPersona).filter(UserPersona.id == persona_id).first()
    if db_persona is None:
        raise HTTPException(status_code=404, detail="User Persona not found")

    # Validate master_world_id if provided
    if update_data.get("master_world_id"):
        world = db.query(MasterWorld).filter(MasterWorld.id == update_data["master_world_id"]).first()
        if not world:
            raise HTTPException(status_code=400, detail="Master World not found")

    if image:
        from file_storage import save_uploaded_file, delete_image_file
        if db_persona.image_url:
            delete_image_file(db_persona.image_url)
        # Use the name from update_data_model if provided, otherwise fallback to db_persona.name
        image_name_for_file = update_data_model.name if update_data_model.name is not None else db_persona.name
        update_data["image_url"] = await save_uploaded_file(
            image,
            entity_type="persona",
            entity_name=image_name_for_file
        )
    elif remove_image:
        from file_storage import delete_image_file
        if db_persona.image_url:
            delete_image_file(db_persona.image_url)
        update_data["image_url"] = None

    # Apply updates from the validated Pydantic model
    for key, value in update_data.items():
        setattr(db_persona, key, value)

    db.add(db_persona)
    db.commit()
    db.refresh(db_persona)
    return UserPersonaInDB.from_orm(db_persona)

@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_persona(persona_id: str, db: Session = Depends(get_db)):
    """
    Deleta uma User Persona existente.
    """
    db_persona = db.query(UserPersona).filter(UserPersona.id == persona_id).first()
    if db_persona is None:
        raise HTTPException(status_code=404, detail="User Persona not found")

    # Delete the associated image file if it exists
    if getattr(db_persona, 'image_url', None):
        from file_storage import delete_image_file
        delete_image_file(db_persona.image_url)

    db.delete(db_persona)
    db.commit()
    return None
