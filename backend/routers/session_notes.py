# backend/routers/session_notes.py
"""
API router for SessionNotes operations.

This router provides endpoints for managing session-specific narrative notes
that enhance LoreEntries with dynamic, context-aware updates.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Path, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.session_note_service import SessionNoteService
from backend.schemas.session_note import (
    SessionNoteCreate,
    SessionNoteUpdate, 
    SessionNoteResponse,
    SessionNoteOperationResult
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/session-notes",
    tags=["Session Notes"],
    responses={404: {"description": "Not found"}},
)

# Initialize service
session_note_service = SessionNoteService()


@router.post("/", response_model=SessionNoteOperationResult, status_code=status.HTTP_201_CREATED)
async def create_session_note(
    session_note_data: SessionNoteCreate,
    db: Session = Depends(get_db)
):
    """Create a new SessionNote"""
    try:
        result = session_note_service.create_session_note(db, session_note_data)
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.error_message
            )
        return result
    except Exception as e:
        logger.error(f"Error creating SessionNote: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{session_note_id}", response_model=SessionNoteResponse)
async def get_session_note(
    session_note_id: str = Path(..., description="ID of the SessionNote"),
    db: Session = Depends(get_db)
):
    """Get a specific SessionNote by ID"""
    try:
        session_note = session_note_service.get_session_note(db, session_note_id)
        if not session_note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SessionNote {session_note_id} not found"
            )
        return session_note
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting SessionNote {session_note_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.put("/{session_note_id}", response_model=SessionNoteOperationResult)
async def update_session_note(
    session_note_id: str = Path(..., description="ID of the SessionNote"),
    update_data: SessionNoteUpdate = ...,
    db: Session = Depends(get_db)
):
    """Update an existing SessionNote"""
    try:
        result = session_note_service.update_session_note(db, session_note_id, update_data)
        if not result.success:
            if "not found" in result.error_message.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=result.error_message
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=result.error_message
                )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating SessionNote {session_note_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/{session_note_id}", response_model=SessionNoteOperationResult)
async def delete_session_note(
    session_note_id: str = Path(..., description="ID of the SessionNote"),
    db: Session = Depends(get_db)
):
    """Delete a SessionNote"""
    try:
        result = session_note_service.delete_session_note(db, session_note_id)
        if not result.success:
            if "not found" in result.error_message.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=result.error_message
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=result.error_message
                )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting SessionNote {session_note_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/session/{session_id}", response_model=List[SessionNoteResponse])
async def get_session_notes_for_session(
    session_id: str = Path(..., description="ID of the chat session"),
    db: Session = Depends(get_db)
):
    """Get all SessionNotes for a specific session"""
    try:
        session_notes = session_note_service.get_session_notes_for_session(db, session_id)
        return session_notes
    except Exception as e:
        logger.error(f"Error getting SessionNotes for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/session/{session_id}/lore-entry/{lore_entry_id}", response_model=SessionNoteResponse)
async def get_session_note_for_lore_entry(
    session_id: str = Path(..., description="ID of the chat session"),
    lore_entry_id: str = Path(..., description="ID of the LoreEntry"),
    db: Session = Depends(get_db)
):
    """Get SessionNote for a specific LoreEntry in a session"""
    try:
        session_note = session_note_service.get_session_note_for_lore_entry(
            db, session_id, lore_entry_id
        )
        if not session_note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SessionNote not found for LoreEntry {lore_entry_id} in session {session_id}"
            )
        return session_note
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting SessionNote for LoreEntry {lore_entry_id} in session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/session/{session_id}/stats")
async def get_session_notes_stats(
    session_id: str = Path(..., description="ID of the chat session"),
    db: Session = Depends(get_db)
):
    """Get statistics about SessionNotes for a session"""
    try:
        session_notes = session_note_service.get_session_notes_for_session(db, session_id)
        
        stats = {
            "total_notes": len(session_notes),
            "notes_with_content": len([note for note in session_notes if note.has_content]),
            "orphaned_notes": len([note for note in session_notes if note.is_orphaned]),
            "linked_notes": len([note for note in session_notes if not note.is_orphaned]),
            "last_updated_turn": max([note.last_updated_turn for note in session_notes]) if session_notes else 0
        }
        
        return stats
    except Exception as e:
        logger.error(f"Error getting SessionNotes stats for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
