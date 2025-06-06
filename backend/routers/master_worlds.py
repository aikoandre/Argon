# backend/routers/master_worlds.py
from fastapi import APIRouter, Depends, HTTPException, status, Form
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
async def create_master_world(
    name: str = Form(...),
    db: Session = Depends(get_db)
):
    db_world = db.query(MasterWorld).filter(MasterWorld.name == name).first()
    if db_world:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Master World with this name already exists"
        )
    
    db_world = MasterWorld(name=name)
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
async def update_master_world(
    world_id: str,
    name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    db_world = db.query(MasterWorld).filter(MasterWorld.id == world_id).first()
    if db_world is None:
        raise HTTPException(status_code=404, detail="Master World not found")
    
    if name is not None:
        db_world.name = name
    
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
