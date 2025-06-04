# backend/services/session_lore_service.py
from sqlalchemy.orm import Session
from typing import List
from backend.schemas.ai_analysis_result import SessionLoreUpdate
from backend.schemas.session_lore_modification import SessionLoreModificationCreate
from backend.db import crud
import logging

logger = logging.getLogger(__name__)

def apply_session_lore_updates(
    db: Session, chat_session_id: str, session_lore_updates: List[SessionLoreUpdate]
):
    """
    Applies session-specific lore modifications based on AI analysis.
    Creates new modifications or updates existing ones.
    """
    if not session_lore_updates:
        return

    for update in session_lore_updates:
        # Check if a modification for this lore entry and field already exists in this session
        existing_modification = crud.get_session_lore_modification_by_ids(
            db,
            chat_session_id=chat_session_id,
            base_lore_entry_id=update.base_lore_entry_id,
            field_to_update=update.field_to_update,
        )

        if existing_modification:
            # Update existing modification
            logger.info(
                f"Updating existing SessionLoreModification for session {chat_session_id}, "
                f"lore entry {update.base_lore_entry_id}, field {update.field_to_update}"
            )
            # Convert SessionLoreUpdate to SessionLoreModificationCreate for updating
            update_data = SessionLoreModificationCreate(
                chat_session_id=chat_session_id,
                base_lore_entry_id=update.base_lore_entry_id,
                field_to_update=update.field_to_update,
                new_content_segment=update.new_content_segment,
                change_reason=update.change_reason
            )
            crud.update_session_lore_modification(db, existing_modification, update_data)
        else:
            # Create new modification
            logger.info(
                f"Creating new SessionLoreModification for session {chat_session_id}, "
                f"lore entry {update.base_lore_entry_id}, field {update.field_to_update}"
            )
            # Convert SessionLoreUpdate to SessionLoreModificationCreate for creation
            create_data = SessionLoreModificationCreate(
                chat_session_id=chat_session_id,
                base_lore_entry_id=update.base_lore_entry_id,
                field_to_update=update.field_to_update,
                new_content_segment=update.new_content_segment,
                change_reason=update.change_reason
            )
            crud.create_session_lore_modification(db, create_data)

# For compatibility, define a dummy class that exposes the function as a static method.
class SessionLoreService:
    @staticmethod
    def apply_session_lore_updates(db, chat_session_id, session_lore_updates):
        return apply_session_lore_updates(db, chat_session_id, session_lore_updates)