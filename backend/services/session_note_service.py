# backend/services/session_note_service.py
"""
SessionNote service for managing session-specific narrative notes.

This service provides CRUD operations for SessionNotes and handles the
integration between LoreEntries and their session-specific updates.
"""
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models.session_note import SessionNote
from models.lore_entry import LoreEntry
from models.chat_session import ChatSession
from schemas.session_note import (
    SessionNoteCreate, 
    SessionNoteUpdate, 
    SessionNoteInDB,
    SessionNoteResponse,
    SessionNoteOperationResult
)

logger = logging.getLogger(__name__)


class SessionNoteService:
    """Service for managing SessionNotes"""
    
    def create_session_note(
        self,
        db: Session,
        session_note_data: SessionNoteCreate
    ) -> SessionNoteOperationResult:
        """Create a new SessionNote"""
        logger.debug(f"[SessionNote][CREATE] Input: {session_note_data}")
        try:
            # Validate session exists
            session = db.query(ChatSession).filter(
                ChatSession.id == session_note_data.session_id
            ).first()
            if not session:
                logger.warning(f"[SessionNote][CREATE] Session {session_note_data.session_id} not found")
                return SessionNoteOperationResult(
                    success=False,
                    error_message=f"Session {session_note_data.session_id} not found"
                )
            
            # Validate LoreEntry exists (if provided)
            if session_note_data.lore_entry_id:
                lore_entry = db.query(LoreEntry).filter(
                    LoreEntry.id == session_note_data.lore_entry_id
                ).first()
                if not lore_entry:
                    logger.warning(f"[SessionNote][CREATE] LoreEntry {session_note_data.lore_entry_id} not found")
                    return SessionNoteOperationResult(
                        success=False,
                        error_message=f"LoreEntry {session_note_data.lore_entry_id} not found"
                    )
            
            # Check for existing SessionNote (one per LoreEntry per session)
            if session_note_data.lore_entry_id:
                existing = db.query(SessionNote).filter(
                    and_(
                        SessionNote.session_id == session_note_data.session_id,
                        SessionNote.lore_entry_id == session_note_data.lore_entry_id
                    )
                ).first()
                if existing:
                    logger.warning(f"[SessionNote][CREATE] SessionNote already exists for LoreEntry {session_note_data.lore_entry_id} in session {session_note_data.session_id}")
                    return SessionNoteOperationResult(
                        success=False,
                        error_message="SessionNote already exists for this LoreEntry in this session"
                    )
            
            # Create new SessionNote
            db_session_note = SessionNote(**session_note_data.model_dump())
            db.add(db_session_note)
            db.commit()
            db.refresh(db_session_note)
            
            logger.info(f"[SessionNote][CREATE] Created SessionNote {db_session_note.id} for session {session_note_data.session_id}")
            return SessionNoteOperationResult(
                success=True,
                session_note_id=db_session_note.id
            )
            
        except Exception as e:
            db.rollback()
            logger.error(f"[SessionNote][CREATE][ERROR] {e}")
            return SessionNoteOperationResult(
                success=False,
                error_message=str(e)
            )
    
    def update_session_note(
        self,
        db: Session,
        session_note_id: str,
        update_data: SessionNoteUpdate
    ) -> SessionNoteOperationResult:
        """Update an existing SessionNote"""
        logger.debug(f"[SessionNote][UPDATE] session_note_id={session_note_id}, update_data={update_data}")
        try:
            db_session_note = db.query(SessionNote).filter(
                SessionNote.id == session_note_id
            ).first()
            
            if not db_session_note:
                logger.warning(f"[SessionNote][UPDATE] SessionNote {session_note_id} not found")
                return SessionNoteOperationResult(
                    success=False,
                    error_message=f"SessionNote {session_note_id} not found"
                )
            
            # Update fields
            update_data_dict = update_data.model_dump(exclude_unset=True)
            for field, value in update_data_dict.items():
                setattr(db_session_note, field, value)
            
            db.commit()
            db.refresh(db_session_note)
            
            logger.info(f"[SessionNote][UPDATE] Updated SessionNote {session_note_id}")
            return SessionNoteOperationResult(
                success=True,
                session_note_id=session_note_id
            )
            
        except Exception as e:
            db.rollback()
            logger.error(f"[SessionNote][UPDATE][ERROR] {e}")
            return SessionNoteOperationResult(
                success=False,
                error_message=str(e)
            )
    
    def get_session_note(
        self,
        db: Session,
        session_note_id: str
    ) -> Optional[SessionNoteResponse]:
        """Get a SessionNote by ID"""
        logger.debug(f"[SessionNote][GET] session_note_id={session_note_id}")
        try:
            db_session_note = db.query(SessionNote).filter(
                SessionNote.id == session_note_id
            ).first()
            
            if not db_session_note:
                logger.warning(f"[SessionNote][GET] SessionNote {session_note_id} not found")
                return None
            
            logger.info(f"[SessionNote][GET] Fetched SessionNote {session_note_id}")
            return SessionNoteResponse(
                **SessionNoteInDB.model_validate(db_session_note).model_dump(),
                display_name=db_session_note.display_name,
                is_orphaned=db_session_note.is_orphaned,
                has_content=db_session_note.has_content()
            )
            
        except Exception as e:
            logger.error(f"[SessionNote][GET][ERROR] {e}")
            return None
    
    def get_session_notes_for_session(
        self,
        db: Session,
        session_id: str
    ) -> List[SessionNoteResponse]:
        """Get all SessionNotes for a specific session"""
        try:
            db_session_notes = db.query(SessionNote).filter(
                SessionNote.session_id == session_id
            ).all()
            
            return [
                SessionNoteResponse(
                    **SessionNoteInDB.model_validate(note).model_dump(),
                    display_name=note.display_name,
                    is_orphaned=note.is_orphaned,
                    has_content=note.has_content()
                )
                for note in db_session_notes
            ]
            
        except Exception as e:
            logger.error(f"Error getting SessionNotes for session {session_id}: {e}")
            return []
    
    def get_session_note_for_lore_entry(
        self,
        db: Session,
        session_id: str,
        lore_entry_id: str
    ) -> Optional[SessionNoteResponse]:
        """Get SessionNote for a specific LoreEntry in a session"""
        try:
            db_session_note = db.query(SessionNote).filter(
                and_(
                    SessionNote.session_id == session_id,
                    SessionNote.lore_entry_id == lore_entry_id
                )
            ).first()
            
            if not db_session_note:
                return None
            
            return SessionNoteResponse(
                **SessionNoteInDB.model_validate(db_session_note).model_dump(),
                display_name=db_session_note.display_name,
                is_orphaned=db_session_note.is_orphaned,
                has_content=db_session_note.has_content()
            )
            
        except Exception as e:
            logger.error(f"Error getting SessionNote for LoreEntry {lore_entry_id} in session {session_id}: {e}")
            return None
    
    def delete_session_note(
        self,
        db: Session,
        session_note_id: str
    ) -> SessionNoteOperationResult:
        """Delete a SessionNote"""
        try:
            db_session_note = db.query(SessionNote).filter(
                SessionNote.id == session_note_id
            ).first()
            
            if not db_session_note:
                return SessionNoteOperationResult(
                    success=False,
                    error_message=f"SessionNote {session_note_id} not found"
                )
            
            db.delete(db_session_note)
            db.commit()
            
            logger.info(f"Deleted SessionNote {session_note_id}")
            return SessionNoteOperationResult(success=True)
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting SessionNote {session_note_id}: {e}")
            return SessionNoteOperationResult(
                success=False,
                error_message=str(e)
            )
