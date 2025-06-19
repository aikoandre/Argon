from __future__ import annotations
# backend-python/db/crud.py
from typing import TYPE_CHECKING
from sqlalchemy.orm import Session
import uuid
# from . import models as db_models # Modelos SQLAlchemy (db/models.py)
# Temporarily removed: from backend import models as api_models - causing circular import
# Importe o modelo Pydantic correto para criação de sessão
from backend.schemas.chat_session import ChatSessionCreate
from datetime import datetime

if TYPE_CHECKING:
    from backend.models.chat_session import ChatSession
    from backend.models.lore_entry import LoreEntry

# --- Import the SQLAlchemy models with lazy imports to avoid circular dependencies ---
# All models will be imported inside functions when needed to break circular imports
# Temporarily commenting out GlobalLore to isolate the ChatSession issue
# from .models import GlobalLore

# --- GlobalLore CRUD (temporarily commented out to isolate ChatSession issue) ---

# def create_global_lore(db: Session, lore: "api_models.GlobalLoreCardCreate") -> "GlobalLore":
#     db_lore = GlobalLore(
#         title=lore.title,
#         content=lore.content,
#         tags=lore.tags
#     )
#     db.add(db_lore)
#     db.commit()
#     db.refresh(db_lore)
#     return db_lore

# def get_global_lore(db: Session, lore_id: uuid.UUID) -> GlobalLore | None:
#     return db.query(GlobalLore).filter(GlobalLore.id == lore_id).first()

# def get_all_global_lore(db: Session, skip: int = 0, limit: int = 100) -> list[GlobalLore]:
#     return db.query(GlobalLore).offset(skip).limit(limit).all()

# --- Chat Session CRUD ---
def create_chat_session(db: Session, chat_session: ChatSessionCreate) -> ChatSession:
    """
    Creates a new chat session in the database.
    """
    # Lazy import to avoid circular dependency
    from backend.models.chat_session import ChatSession
    
    # Convert the Pydantic model to a SQLAlchemy model instance
    # .dict() is deprecated, use model_dump() in Pydantic v2+
    # exclude_unset=True ensures only fields explicitly set are included
    session_data = chat_session.model_dump(exclude_unset=True)

    db_session = ChatSession(
        **session_data,
        # Ensure last_active_at is set on creation if not handled by server_default
        # If your model uses server_default=func.now(), this might not be strictly needed here,
        # but setting it explicitly is safer.
        last_active_at=datetime.utcnow()
    )

    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def get_chat_session(db: Session, chat_session_id: str) -> ChatSession | None:
    """
    Retrieves a chat session by its ID.
    """
    # Lazy import to avoid circular dependency
    from backend.models.chat_session import ChatSession
    
    return db.query(ChatSession).filter(ChatSession.id == chat_session_id).first()
