# backend/routers/master_worlds.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..models.master_world import MasterWorld
from ..schemas.master_world import MasterWorldCreate, MasterWorldUpdate, MasterWorldInDB
from ..database import get_db

router = APIRouter(
    prefix="/api/master_worlds",
    tags=["Master Worlds"],
)

@router.post("", response_model=MasterWorldInDB, status_code=status.HTTP_201_CREATED)
def create_master_world(world: MasterWorldCreate, db: Session = Depends(get_db)):
    if not world.name or len(world.name) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name must be at least 3 characters long"
        )
        
    db_world = db.query(MasterWorld).filter(MasterWorld.name == world.name).first()
    if db_world:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Master World with this name already exists"
        )
    db_world = MasterWorld(**world.model_dump())
    db.add(db_world)
    db.commit()
    db.refresh(db_world)
    return db_world

@router.get("", response_model=List[MasterWorldInDB])
def get_all_master_worlds(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    worlds = db.query(MasterWorld).order_by(MasterWorld.name).offset(skip).limit(limit).all()
    return worlds

@router.get("/{world_id}", response_model=MasterWorldInDB)
def get_master_world(world_id: str, db: Session = Depends(get_db)):
    db_world = db.query(MasterWorld).filter(MasterWorld.id == world_id).first()
    if db_world is None:
        raise HTTPException(status_code=404, detail="Master World not found")
    return db_world

@router.put("/{world_id}", response_model=MasterWorldInDB)
def update_master_world(
    world_id: str, world_update: MasterWorldUpdate, db: Session = Depends(get_db)
):
    db_world = db.query(MasterWorld).filter(MasterWorld.id == world_id).first()
    if db_world is None:
        raise HTTPException(status_code=404, detail="Master World not found")

    update_data = world_update.model_dump(exclude_unset=True)
    
    # Se o nome está sendo mudado, verifique se o novo nome já existe
    if "name" in update_data and update_data["name"] != db_world.name:
        existing_world = db.query(MasterWorld).filter(MasterWorld.name == update_data["name"]).first()
        if existing_world:
            raise HTTPException(status_code=400, detail="Another Master World with this name already exists")

    for key, value in update_data.items():
        setattr(db_world, key, value)
    
    db.add(db_world)
    db.commit()
    db.refresh(db_world)
    return db_world

@router.delete("/{world_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_master_world(world_id: str, db: Session = Depends(get_db)):
    db_world = db.query(MasterWorld).filter(MasterWorld.id == world_id).first()
    if db_world is None:
        raise HTTPException(status_code=404, detail="Master World not found")
    
    # Cascade delete para LoreEntries é definido no modelo MasterWorld
    db.delete(db_world)
    db.commit()
    return None
