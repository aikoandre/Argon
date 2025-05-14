# backend/routers/lore_entries.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from models.lore_entry import LoreEntry
from models.master_world import MasterWorld # Para validar master_world_id
from schemas.lore_entry import LoreEntryCreate, LoreEntryUpdate, LoreEntryInDB, VALID_ENTRY_TYPES
from database import get_db

router = APIRouter(
    prefix="/api/lore_entries",
    tags=["Lore Entries"],
)

# Endpoints aninhados sob Master Worlds para listagem e criação
master_world_router = APIRouter(
    prefix="/api/master_worlds/{master_world_id}/lore_entries",
    tags=["Lore Entries (scoped to Master World)"]
)

@master_world_router.post("", response_model=LoreEntryInDB, status_code=status.HTTP_201_CREATED)
def create_lore_entry_for_world(
    master_world_id: str,
    entry: LoreEntryCreate, # master_world_id não virá mais do payload
    db: Session = Depends(get_db)
):
    db_master_world = db.query(MasterWorld).filter(MasterWorld.id == master_world_id).first()
    if not db_master_world:
        raise HTTPException(status_code=404, detail="Master World not found")

    # Validação para faction_id
    if entry.faction_id:
        if entry.entry_type != "CHARACTER_LORE":
            raise HTTPException(status_code=400, detail="faction_id can only be set for CHARACTER_LORE type")
        
        faction = db.query(LoreEntry).filter(
            LoreEntry.id == entry.faction_id,
            LoreEntry.entry_type == "FACTION",
            LoreEntry.master_world_id == master_world_id # Facção deve ser do mesmo mundo
        ).first()
        if not faction:
            raise HTTPException(status_code=400, detail=f"Invalid faction_id: Faction {entry.faction_id} not found in this world or not a FACTION type.")

    # Removido attributes do payload, como discutido
    db_entry_data = entry.model_dump()
    # db_entry_data.pop('attributes', None) # Se 'attributes' ainda estiver no schema Create mas não no modelo

    db_entry = LoreEntry(**db_entry_data, master_world_id=master_world_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@master_world_router.get("", response_model=List[LoreEntryInDB])
def get_all_lore_entries_for_world(
    master_world_id: str,
    skip: int = 0,
    limit: int = 100,
    entry_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    db_master_world = db.query(MasterWorld).filter(MasterWorld.id == master_world_id).first()
    if not db_master_world:
        raise HTTPException(status_code=404, detail="Master World not found")

    query = db.query(LoreEntry).filter(LoreEntry.master_world_id == master_world_id)
    if entry_type:
        if entry_type not in VALID_ENTRY_TYPES:
             raise HTTPException(status_code=400, detail=f"Invalid entry_type for filtering. Allowed types: {VALID_ENTRY_TYPES}")
        query = query.filter(LoreEntry.entry_type == entry_type)
    
    entries = query.order_by(LoreEntry.name).offset(skip).limit(limit).all()
    return entries

# Endpoints para operações em uma LoreEntry específica (podem ter prefixo próprio)
lore_entry_ops_router = APIRouter(
    prefix="/api/lore_entries",
    tags=["Lore Entries (individual operations)"]
)

@lore_entry_ops_router.get("/{entry_id}", response_model=LoreEntryInDB)
def get_lore_entry(entry_id: str, db: Session = Depends(get_db)):
    db_entry = db.query(LoreEntry).filter(LoreEntry.id == entry_id).first()
    if db_entry is None:
        raise HTTPException(status_code=404, detail="Lore Entry not found")
    return db_entry

@lore_entry_ops_router.put("/{entry_id}", response_model=LoreEntryInDB)
def update_lore_entry(
    entry_id: str, entry_update: LoreEntryUpdate, db: Session = Depends(get_db)
):
    db_entry = db.query(LoreEntry).filter(LoreEntry.id == entry_id).first()
    if db_entry is None:
        raise HTTPException(status_code=404, detail="Lore Entry not found")

    update_data = entry_update.model_dump(exclude_unset=True)
    
    # Validação para faction_id se estiver sendo atualizado
    # (O entry_type não deve ser mudado via PUT, ou se for, revalidar faction_id)
    new_entry_type = update_data.get('entry_type', db_entry.entry_type) # Se permitir mudar tipo
    new_faction_id = update_data.get('faction_id', db_entry.faction_id)

    if 'faction_id' in update_data: # Se faction_id está no payload
        if new_faction_id is not None:
            if new_entry_type != "CHARACTER_LORE":
                raise HTTPException(status_code=400, detail="faction_id can only be set for CHARACTER_LORE type")
            faction = db.query(LoreEntry).filter(
                LoreEntry.id == new_faction_id,
                LoreEntry.entry_type == "FACTION",
                LoreEntry.master_world_id == db_entry.master_world_id # Importante: facção do mesmo mundo
            ).first()
            if not faction:
                raise HTTPException(status_code=400, detail=f"Invalid faction_id: Faction {new_faction_id} not found in this world or not a FACTION type.")
        # Se new_faction_id for None, está limpando, o que é permitido
    elif new_faction_id is not None and new_entry_type != "CHARACTER_LORE":
         # faction_id não está no payload, mas existia e o TIPO está mudando
         # para algo que não seja CHARACTER_LORE. Limpar faction_id.
         update_data['faction_id'] = None


    # Removido attributes do payload, como discutido
    # update_data.pop('attributes', None)

    for key, value in update_data.items():
        setattr(db_entry, key, value)
    
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@lore_entry_ops_router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lore_entry(entry_id: str, db: Session = Depends(get_db)):
    db_entry = db.query(LoreEntry).filter(LoreEntry.id == entry_id).first()
    if db_entry is None:
        raise HTTPException(status_code=404, detail="Lore Entry not found")
    
    if db_entry.entry_type == "FACTION":
        # Verificar se esta facção é referenciada por outros LoreEntries (personagens)
        referencing_chars = db.query(LoreEntry).filter(
            LoreEntry.faction_id == entry_id,
            LoreEntry.master_world_id == db_entry.master_world_id # Dentro do mesmo mundo
        ).count()
        if referencing_chars > 0:
            raise HTTPException(status_code=409, detail=f"Cannot delete faction '{db_entry.name}'. It is referenced by {referencing_chars} character(s) in this world.")
    
    db.delete(db_entry)
    db.commit()
    return None

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from models.lore_entry import LoreEntry
from schemas.lore_entry import LoreEntryInDB
from database import get_db

router = APIRouter(
    prefix="/api/lore_entries",
    tags=["Lore Entries"],
)

@router.get("", response_model=List[LoreEntryInDB])
def get_all_lore_entries(
    skip: int = 0, 
    limit: int = 100,
    entry_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all lore entries with optional filtering by type."""
    query = db.query(LoreEntry)
    
    if entry_type:
        query = query.filter(LoreEntry.entry_type == entry_type.upper())
        
    return query.order_by(LoreEntry.name).offset(skip).limit(limit).all()

@router.get("/{entry_id}", response_model=LoreEntryInDB)
def get_lore_entry(entry_id: str, db: Session = Depends(get_db)):
    """Get a specific lore entry by ID."""
    db_entry = db.query(LoreEntry).filter(LoreEntry.id == entry_id).first()
    if db_entry is None:
        raise HTTPException(status_code=404, detail="Lore Entry not found")
    return db_entry

@router.get("/types/available", response_model=List[str])
def get_available_entry_types():
    """Get all available lore entry types."""
    from schemas.lore_entry import VALID_ENTRY_TYPES
    return VALID_ENTRY_TYPES
