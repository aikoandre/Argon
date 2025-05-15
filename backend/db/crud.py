from __future__ import annotations
# backend-python/db/crud.py
from sqlalchemy.orm import Session
import uuid
from . import models as db_models # Modelos SQLAlchemy (db/models.py) - Mantém relativo pois está no mesmo subpacote 'db'
from backend import models as api_models # Modelos Pydantic (backend/models.py) - Usa absoluto a partir de 'backend'

# --- GlobalLore CRUD ---

def create_global_lore(db: Session, lore: "api_models.GlobalLoreCardCreate") -> "db_models.GlobalLore":
    db_lore = db_models.GlobalLore(
        title=lore.title,
        content=lore.content,
        tags=lore.tags
    )
    db.add(db_lore)
    db.commit()
    db.refresh(db_lore)
    return db_lore

def get_global_lore(db: Session, lore_id: uuid.UUID) -> db_models.GlobalLore | None:
    return db.query(db_models.GlobalLore).filter(db_models.GlobalLore.id == lore_id).first()

def get_all_global_lore(db: Session, skip: int = 0, limit: int = 100) -> list[db_models.GlobalLore]:
    return db.query(db_models.GlobalLore).offset(skip).limit(limit).all()

# ... (Implementar update e delete depois) ...
