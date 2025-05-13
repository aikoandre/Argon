# backend/routers/characters.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

# Importe o modelo SQLAlchemy e os schemas Pydantic
from ..models.character_card import CharacterCard
from ..schemas.character_card import CharacterCardCreate, CharacterCardUpdate, CharacterCardInDB

from ..database import get_db

router = APIRouter(
    prefix="/api/characters",
    tags=["Character Cards (AI NPCs/GM)"], # Tag para documentação
)

@router.post("", response_model=CharacterCardInDB, status_code=status.HTTP_201_CREATED)
def create_character_card(
    character: CharacterCardCreate, db: Session = Depends(get_db)
):
    """
    Cria um novo Character Card (NPC/GM para a IA).
    """
    # Nota: JSON fields (example_dialogues) são tratados automaticamente
    db_character = CharacterCard(**character.model_dump()) # Pydantic V2
    # Para Pydantic V1: db_character = CharacterCard(**character.dict())
    db.add(db_character)
    db.commit()
    db.refresh(db_character)
    return db_character

@router.get("", response_model=List[CharacterCardInDB])
def get_all_character_cards(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Lista todos os Character Cards.
    """
    characters = db.query(CharacterCard).offset(skip).limit(limit).all()
    return characters

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
def update_character_card(
    character_id: str, character_update: CharacterCardUpdate, db: Session = Depends(get_db)
):
    """
    Atualiza um Character Card existente. Permite atualização parcial.
    """
    db_character = db.query(CharacterCard).filter(CharacterCard.id == character_id).first()
    if db_character is None:
        raise HTTPException(status_code=404, detail="Character Card not found")

    # Usar CharacterCardUpdate (que tem todos os campos como Optional)
    update_data = character_update.model_dump(exclude_unset=True) # Pydantic V2
    # Para Pydantic V1: update_data = character_update.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_character, key, value)

    db.add(db_character)
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

    # Cuidado: Se houver ChatSessions usando este character, você pode
    # querer impedir a exclusão ou lidar com isso (ex: definir FK como NULL?).
    # Por enquanto, apenas deleta.
    db.delete(db_character)
    db.commit()
    return None