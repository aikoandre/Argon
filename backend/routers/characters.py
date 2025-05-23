# backend/routers/characters.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from ..file_storage import save_uploaded_file, delete_image_file

# Importe o modelo SQLAlchemy e os schemas Pydantic
from ..models.character_card import CharacterCard
from ..schemas.character_card import CharacterCardCreate, CharacterCardUpdate, CharacterCardInDB

from ..database import get_db

router = APIRouter(
    prefix="/api/characters",
    tags=["Character Cards (AI NPCs/GM)"], # Tag para documentação
)

@router.post("", response_model=CharacterCardInDB, status_code=status.HTTP_201_CREATED)
async def create_character(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    instructions: Optional[str] = Form(None),
    example_dialogues: Optional[str] = Form(None),
    beginning_messages: Optional[str] = Form(None),
    master_world_id: Optional[str] = Form(None),
    linked_lore_ids: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Create a new character with optional image upload"""
    """
    Creates a new character with optional image upload.
    """
    from ..models.master_world import MasterWorld
    
    # Validate master world if provided
    if master_world_id:
        master_world = db.query(MasterWorld).filter(MasterWorld.id == master_world_id).first()
        if not master_world:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Master world not found"
            )

    # Handle image upload
    image_url = None
    if image and image.filename:
        image_url = await save_uploaded_file(image, entity_name=name)
    
    # Parse JSON strings
    example_dialogues_list = json.loads(example_dialogues) if example_dialogues else []
    beginning_messages_list = json.loads(beginning_messages) if beginning_messages else []
    linked_lore_ids_list = json.loads(linked_lore_ids) if linked_lore_ids else []
    
    character_data = {
        "name": name,
        "description": description,
        "instructions": instructions,
        "image_url": image_url,
        "example_dialogues": example_dialogues_list,
        "beginning_messages": beginning_messages_list,
        "master_world_id": master_world_id,
        "linked_lore_ids": linked_lore_ids_list
    }

    db_character = CharacterCard(**character_data)
    db.add(db_character)
    db.commit()
    db.refresh(db_character)
    return db_character

@router.get("", response_model=List[CharacterCardInDB])
def get_all_character_cards(
    skip: int = 0,
    limit: int = 100,
    master_world_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all Character Cards with optional filtering by Master World ID.
    """
    query = db.query(CharacterCard)

    if master_world_id is not None:
        query = query.filter(CharacterCard.master_world_id == master_world_id)

    return query.order_by(CharacterCard.name).offset(skip).limit(limit).all()

@router.get("/{character_id}", response_model=CharacterCardInDB)
def get_character_card(character_id: str, db: Session = Depends(get_db)):
    """
    Obtém detalhes de um Character Card específico pelo ID.
    """
    db_character = db.query(CharacterCard).filter(CharacterCard.id == character_id).first()
    if db_character is None:
        raise HTTPException(status_code=404, detail="Character Card not found")
    return db_character

@router.put("/{character_id}", response_model=CharacterCardInDB)
async def update_character(
    character_id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    instructions: Optional[str] = Form(None),
    example_dialogues: Optional[str] = Form(None),
    beginning_messages: Optional[str] = Form(None),
    master_world_id: Optional[str] = Form(None),
    linked_lore_ids: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    remove_image: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Updates a character including optional image update or removal.
    """
    from ..models.master_world import MasterWorld

    db_character = db.query(CharacterCard).filter(CharacterCard.id == character_id).first()
    if not db_character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Handle image removal if requested (and no new image is being uploaded)
    if remove_image == 'true' and not image and db_character.image_url:
        delete_image_file(db_character.image_url)
        db_character.image_url = None

    # Handle image update
    if image and image.filename:
        # Delete old image if exists
        if db_character.image_url:
            delete_image_file(db_character.image_url)
        # Save new image
        db_character.image_url = await save_uploaded_file(image, entity_name=name if name is not None else db_character.name)

    # Parse JSON fields
    if example_dialogues is not None:
        db_character.example_dialogues = json.loads(example_dialogues)
    if beginning_messages is not None:
        db_character.beginning_messages = json.loads(beginning_messages)
    if linked_lore_ids is not None:
        db_character.linked_lore_ids = json.loads(linked_lore_ids)

    # Update other fields
    if name is not None:
        db_character.name = name
    if description is not None:
        db_character.description = description
    if instructions is not None:
        db_character.instructions = instructions
    if master_world_id is not None:
        # Validate master world if provided
        if master_world_id:
            master_world = db.query(MasterWorld).filter(MasterWorld.id == master_world_id).first()
            if not master_world:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Master world not found"
                )
        db_character.master_world_id = master_world_id

    db.commit()
    db.refresh(db_character)
    return db_character

@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character_card(character_id: str, db: Session = Depends(get_db)):
    """
    Deleta um Character Card existente.
    """
    db_character = db.query(CharacterCard).filter(CharacterCard.id == character_id).first()
    if db_character is None:
        raise HTTPException(status_code=404, detail="Character Card not found")

    # Delete the associated image file if it exists
    if db_character.image_url:
        delete_image_file(db_character.image_url)
    db.delete(db_character)
    db.commit()
    return None
