# backend/routers/master_worlds.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional

from ..models.master_world import MasterWorld
from ..schemas.master_world import MasterWorldCreate, MasterWorldUpdate, MasterWorldInDB
from ..database import get_db
from ..file_storage import save_uploaded_file, delete_image_file

router = APIRouter(
    prefix="/api/master_worlds",
    tags=["Master Worlds"],
)

@router.post("", response_model=MasterWorldInDB, status_code=status.HTTP_201_CREATED)
async def create_master_world(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON stringified list, e.g. '["tag1","tag2"]'
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    db_world = db.query(MasterWorld).filter(MasterWorld.name == name).first()
    if db_world:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Master World with this name already exists"
        )
    tags_list = []
    if tags:
        import json
        try:
            tags_list = json.loads(tags)
            if not isinstance(tags_list, list):
                raise ValueError
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Tags must be a JSON stringified list, e.g. ['tag1','tag2']"
            )
    image_url = None
    if image:
        image_url = await save_uploaded_file(image, entity_type="world", entity_name=name)
    db_world = MasterWorld(
        name=name,
        description=description,
        tags=tags_list,
        image_url=image_url
    )
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
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    remove_image: Optional[bool] = Form(False),
    db: Session = Depends(get_db)
):
    db_world = db.query(MasterWorld).filter(MasterWorld.id == world_id).first()
    if db_world is None:
        raise HTTPException(status_code=404, detail="Master World not found")
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description
    if tags is not None:
        import json
        try:
            update_data["tags"] = json.loads(tags)
        except Exception:
            update_data["tags"] = []
    if image:
        # Remove old image if exists
        if db_world.image_url:
            try:
                delete_image_file(db_world.image_url)
            except Exception:
                pass
        update_data["image_url"] = await save_uploaded_file(image, entity_type="world", entity_name=name or db_world.name)
    elif remove_image and db_world.image_url:
        try:
            delete_image_file(db_world.image_url)
        except Exception:
            pass
        update_data["image_url"] = None
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
    # Delete the associated image file if it exists
    delete_image_file(db_world.image_url)
    # Cascade delete para LoreEntries é definido no modelo MasterWorld
    db.delete(db_world)
    db.commit()
    return None
