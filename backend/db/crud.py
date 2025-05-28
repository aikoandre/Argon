from __future__ import annotations
# backend-python/db/crud.py
from sqlalchemy.orm import Session
import uuid
# from . import models as db_models # Modelos SQLAlchemy (db/models.py)
from backend import models as api_models
# Importe o modelo Pydantic correto para criação de sessão
from backend.schemas.chat_session import ChatSessionCreate
from datetime import datetime

# --- Import the SQLAlchemy models directly ---
from backend.models.chat_session import ChatSession
from backend.models.session_lore_modification import SessionLoreModification
from backend.schemas.session_lore_modification import SessionLoreModificationCreate, SessionLoreModificationBase
from backend.models.lore_entry import LoreEntry
from .models import GlobalLore

# --- GlobalLore CRUD ---

def create_global_lore(db: Session, lore: "api_models.GlobalLoreCardCreate") -> "GlobalLore":
    db_lore = GlobalLore(
        title=lore.title,
        content=lore.content,
        tags=lore.tags
    )
    db.add(db_lore)
    db.commit()
    db.refresh(db_lore)
    return db_lore

def get_global_lore(db: Session, lore_id: uuid.UUID) -> GlobalLore | None:
    return db.query(GlobalLore).filter(GlobalLore.id == lore_id).first()

def get_all_global_lore(db: Session, skip: int = 0, limit: int = 100) -> list[GlobalLore]:
    return db.query(GlobalLore).offset(skip).limit(limit).all()

# --- Chat Session CRUD ---
def create_chat_session(db: Session, chat_session: ChatSessionCreate) -> ChatSession:
    """
    Creates a new chat session in the database.
    """
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
    return db.query(ChatSession).filter(ChatSession.id == chat_session_id).first()

# --- Session Lore Modification CRUD ---

def create_session_lore_modification(
    db: Session, modification: SessionLoreModificationCreate
) -> SessionLoreModification:
    """
    Creates a new session-specific lore modification.
    """
    db_modification = SessionLoreModification(
        **modification.model_dump(exclude_unset=True)
    )
    db.add(db_modification)
    db.commit()
    db.refresh(db_modification)
    return db_modification

def get_session_lore_modification_by_ids(
    db: Session, chat_session_id: str, base_lore_entry_id: str, field_to_update: str
) -> SessionLoreModification | None:
    """
    Retrieves a session-specific lore modification by chat session ID, base lore entry ID, and field to update.
    """
    return (
        db.query(SessionLoreModification)
        .filter(
            SessionLoreModification.chat_session_id == chat_session_id,
            SessionLoreModification.base_lore_entry_id == base_lore_entry_id,
            SessionLoreModification.field_to_update == field_to_update,
        )
        .first()
    )

def update_session_lore_modification(
    db: Session,
    db_modification: SessionLoreModification,
    modification_update: SessionLoreModificationBase,
) -> SessionLoreModification:
    """
    Updates an existing session-specific lore modification.
    """
    for key, value in modification_update.model_dump(exclude_unset=True).items():
        setattr(db_modification, key, value)
    db.add(db_modification)
    db.commit()
    db.refresh(db_modification)
    return db_modification

def get_lore_entry_with_session_modification(
    db: Session, lore_entry_id: str, chat_session_id: str
) -> LoreEntry:
    """
    Retrieves a LoreEntry, applying any session-specific modifications.
    """
    lore_entry = db.query(LoreEntry).filter(LoreEntry.id == lore_entry_id).first()
    if not lore_entry:
        return None

    modifications = (
        db.query(SessionLoreModification)
        .filter(
            SessionLoreModification.chat_session_id == chat_session_id,
            SessionLoreModification.base_lore_entry_id == lore_entry_id,
        )
        .all()
    )

    if modifications:
        # Create a mutable dictionary from the LoreEntry's attributes
        modified_lore_content = lore_entry.__dict__.copy()
        
        for mod in modifications:
            # Apply the modification to the specific field
            if hasattr(lore_entry, mod.field_to_update):
                modified_lore_content[mod.field_to_update] = mod.new_content_segment
        
        # Create a new LoreEntry instance with the modified content
        # This ensures that the original LoreEntry object from the DB is not altered
        # and that the RAG pipeline receives the session-specific version.
        modified_lore_entry = LoreEntry(**modified_lore_content)
        return modified_lore_entry
    
    return lore_entry

def create_lore_entry(db: Session, lore_entry_data: dict) -> LoreEntry:
    """
    Creates a new LoreEntry in the database.
    """
    db_lore_entry = LoreEntry(**lore_entry_data)
    db.add(db_lore_entry)
    db.commit()
    db.refresh(db_lore_entry)
    return db_lore_entry
