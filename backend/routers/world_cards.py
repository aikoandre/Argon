# backend/routers/world_cards.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

# Importe o modelo SQLAlchemy e os schemas Pydantic
from ..models.world_card import WorldCard
from ..schemas.world_card import WorldCardCreate, WorldCardUpdate, WorldCardInDB

from ..database import get_db

router = APIRouter(
    prefix="/api/world_cards",
    tags=["World Cards (Lore)"],
)

@router.post("", response_model=WorldCardInDB, status_code=status.HTTP_201_CREATED)
def create_world_card(
    card: WorldCardCreate, db: Session = Depends(get_db)
):
    """
    Cria um novo World Card.
    """
    # Validação para faction_id (opcional, mas bom ter)
    if card.faction_id:
        # Valida se a facção existe e é do tipo FACTION
        # (Assumindo que 'FACTION' é o card_type para grupos/facções)
        faction = db.query(WorldCard).filter(
            WorldCard.id == card.faction_id,
            WorldCard.card_type == "FACTION" # Ajuste se o seu tipo de facção for diferente
        ).first()
        if not faction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid faction_id: Faction {card.faction_id} not found or is not a FACTION type."
            )
    
    # Se card_type for CHARACTER_LORE, e faction_id for fornecido, verifique se faz sentido.
    # (Pode ser redundante se a UI já filtrar, mas é uma segurança)
    if card.card_type != "CHARACTER_LORE" and card.faction_id is not None:
        # Ou permita faction_id para outros tipos se fizer sentido no seu lore.
        # Por agora, vamos assumir que só personagens têm facção direta.
        # raise HTTPException(
        #     status_code=status.HTTP_400_BAD_REQUEST,
        #     detail="faction_id can only be set for CHARACTER_LORE card types."
        # )
        pass # Flexível por enquanto

    db_card = WorldCard(**card.model_dump())
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    return db_card

@router.get("", response_model=List[WorldCardInDB])
def get_all_world_cards(
    skip: int = 0,
    limit: int = 100,
    card_type: Optional[str] = None, # Permite filtrar por tipo
    db: Session = Depends(get_db)
):
    """
    Lista todos os World Cards. Pode filtrar por card_type.
    """
    query = db.query(WorldCard)
    if card_type:
        query = query.filter(WorldCard.card_type == card_type)
    
    cards = query.order_by(WorldCard.name).offset(skip).limit(limit).all()
    return cards

@router.get("/{card_id}", response_model=WorldCardInDB)
def get_world_card(card_id: str, db: Session = Depends(get_db)):
    """
    Obtém detalhes de um World Card específico pelo ID.
    """
    db_card = db.query(WorldCard).filter(WorldCard.id == card_id).first()
    if db_card is None:
        raise HTTPException(status_code=404, detail="World Card not found")
    return db_card

@router.put("/{card_id}", response_model=WorldCardInDB)
def update_world_card(
    card_id: str, card_update: WorldCardUpdate, db: Session = Depends(get_db)
):
    """
    Atualiza um World Card existente. Permite atualização parcial.
    """
    db_card = db.query(WorldCard).filter(WorldCard.id == card_id).first()
    if db_card is None:
        raise HTTPException(status_code=404, detail="World Card not found")

    update_data = card_update.model_dump(exclude_unset=True)

    # Validação para faction_id se estiver sendo atualizado
    if 'faction_id' in update_data and update_data['faction_id'] is not None:
        faction = db.query(WorldCard).filter(
            WorldCard.id == update_data['faction_id'],
            WorldCard.card_type == "FACTION" # Ajuste o tipo se necessário
        ).first()
        if not faction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid faction_id: Faction {update_data['faction_id']} not found or is not a FACTION type."
            )
    
    # Se o card_type está sendo mudado, e faction_id existe, revalidar
    current_card_type = update_data.get('card_type', db_card.card_type)
    current_faction_id = update_data.get('faction_id', db_card.faction_id)

    if current_card_type != "CHARACTER_LORE" and current_faction_id is not None:
        # raise HTTPException(
        #     status_code=status.HTTP_400_BAD_REQUEST,
        #     detail="faction_id can only be set for CHARACTER_LORE card types if type is changing."
        # )
        pass # Flexível por enquanto

    for key, value in update_data.items():
        setattr(db_card, key, value)

    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    return db_card

@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_world_card(card_id: str, db: Session = Depends(get_db)):
    """
    Deleta um World Card existente.
    """
    db_card = db.query(WorldCard).filter(WorldCard.id == card_id).first()
    if db_card is None:
        raise HTTPException(status_code=404, detail="World Card not found")

    # Cuidado: Se este card for uma facção referenciada por outros cards (faction_id),
    # você pode querer impedir a exclusão ou definir esses faction_id como NULL.
    # Ou se outros cards o referenciam em 'attributes' ou 'world_card_references'.
    # Por enquanto, apenas deleta.
    db.delete(db_card)
    db.commit()
    return None