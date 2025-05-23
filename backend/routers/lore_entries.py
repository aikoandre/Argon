# backend/routers/lore_entries.py
import json
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional

from ..models.lore_entry import LoreEntry
from ..models.master_world import MasterWorld # Para validar master_world_id
from ..schemas.lore_entry import LoreEntryCreate, LoreEntryUpdate, LoreEntryInDB, VALID_ENTRY_TYPES
from ..database import get_db

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
async def create_lore_entry_for_world(
    master_world_id: str,
    data: str = Form(...),
    db: Session = Depends(get_db),
    image: Optional[UploadFile] = File(None)
):
    try:
        entry_data = json.loads(data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON data")

    # Validate entry_type first
    if "entry_type" not in entry_data:
        raise HTTPException(status_code=400, detail="entry_type is required")
    if entry_data["entry_type"] not in VALID_ENTRY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entry_type. Valid types: {VALID_ENTRY_TYPES}"
        )

    # Validate faction_id
    faction_id = entry_data.get("faction_id")
    if faction_id:
        if entry_data["entry_type"] != "CHARACTER_LORE":
            raise HTTPException(
                status_code=400,
                detail="faction_id can only be set for CHARACTER_LORE type"
            )
            
        faction = db.query(LoreEntry).filter(
            LoreEntry.id == faction_id,
            LoreEntry.entry_type == "FACTION",  # Keep this critical check
            LoreEntry.master_world_id == master_world_id
        ).first()
        if not faction:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid faction_id: Must be a FACTION entry in this world"
            )

    db_master_world = db.query(MasterWorld).filter(MasterWorld.id == master_world_id).first()
    if not db_master_world:
        raise HTTPException(status_code=404, detail="Master World not found")

    db_entry_data = {
        **entry_data,
        "master_world_id": master_world_id,
        "faction_id": faction_id if entry_data["entry_type"] == "CHARACTER_LORE" else None
    }

    if image:
        from ..file_storage import save_uploaded_file
        db_entry_data['image_url'] = await save_uploaded_file(
            image, 
            entity_type="lore", 
            entity_name=entry_data["name"]
        )

    db_entry = LoreEntry(**db_entry_data)
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
async def update_lore_entry(
    entry_id: str,
    data: str = Form(None),
    db: Session = Depends(get_db),
    image: Optional[UploadFile] = File(None),
    remove_image: Optional[bool] = False
):
    db_entry = db.query(LoreEntry).filter(LoreEntry.id == entry_id).first()
    if db_entry is None:
        raise HTTPException(status_code=404, detail="Lore Entry not found")

    # Parse the JSON data from FormData
    update_data = {}
    if data:
        try:
            update_data = json.loads(data)
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid JSON data")
    
    # Handle image separately from the update data
    if image:
        from ..file_storage import save_uploaded_file, delete_image_file
        if db_entry.image_url:
            delete_image_file(db_entry.image_url)
        # Set image_url directly on the DB entry
        db_entry.image_url = await save_uploaded_file(
            image, 
            entity_type="lore", 
            entity_name=db_entry.name
        )
    elif remove_image and db_entry.image_url:
        from ..file_storage import delete_image_file
        delete_image_file(db_entry.image_url)
        db_entry.image_url = None

    # Handle faction_id validation
    new_entry_type = update_data.get('entry_type', db_entry.entry_type)
    new_faction_id = update_data.get('faction_id', db_entry.faction_id)
    # Handle empty string as None
    if new_faction_id == "":
        new_faction_id = None

    if 'faction_id' in update_data:
        if new_faction_id is not None:
            if new_entry_type != "CHARACTER_LORE":
                raise HTTPException(
                    status_code=400, 
                    detail="faction_id can only be set for CHARACTER_LORE type"
                )
            faction = db.query(LoreEntry).filter(
                LoreEntry.id == new_faction_id,
                LoreEntry.entry_type == "FACTION",
                LoreEntry.master_world_id == db_entry.master_world_id
            ).first()
            if not faction:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid faction_id: Faction {new_faction_id} not found in this world"
                )

    # Update other fields
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

    # Delete the associated image file if it exists
    if getattr(db_entry, 'image_url', None):
        from ..file_storage import delete_image_file
        delete_image_file(db_entry.image_url)

    db.delete(db_entry)
    db.commit()
    return None

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..models.lore_entry import LoreEntry
from ..schemas.lore_entry import LoreEntryInDB
from ..database import get_db

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
