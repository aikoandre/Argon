# backend/routers/session_notes.py
"""
API router for SessionNotes management.

Provides CRUD operations for session-specific narrative notes.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Path, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.services.session_note_service import SessionNoteService
from backend.schemas.session_note import (
    SessionNoteCreate,
    SessionNoteUpdate,
    SessionNoteResponse,
    SessionNoteInDB,
    SessionNoteOperationResult
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/session-notes",
    tags=["Session Notes"],
    responses={404: {"description": "Not found"}},
)

# Service instance
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
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating SessionNote: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{session_note_id}", response_model=SessionNoteResponse)
async def get_session_note(
    session_note_id: str = Path(..., description="The ID of the SessionNote"),
    db: Session = Depends(get_db)
):
    """Get a SessionNote by ID"""
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


@router.get("/session/{session_id}", response_model=List[SessionNoteResponse])
async def get_session_notes_for_session(
    session_id: str = Path(..., description="The ID of the chat session"),
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
