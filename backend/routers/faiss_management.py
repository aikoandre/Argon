# backend/routers/faiss_management.py
import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.services.faiss_service import get_faiss_index

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/faiss", tags=["FAISS Management"])

class FAISSStats(BaseModel):
    total_vectors: int
    dimension: int
    lore_entries: int
    extracted_knowledge: int
    total_mappings: int
    type_breakdown: Dict[str, int]

class ClearRequest(BaseModel):
    confirm: bool = False
    type_filter: Optional[str] = None  # Optional: only clear specific type

@router.get("/stats", response_model=FAISSStats)
def get_faiss_stats():
    """Get statistics about the current FAISS index."""
    try:
        faiss_index = get_faiss_index()
        stats = faiss_index.get_index_stats()
        return FAISSStats(**stats)
    except Exception as e:
        logger.error(f"Failed to get FAISS stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get FAISS stats: {str(e)}")

@router.post("/clear", status_code=200)
async def clear_faiss_data(request: ClearRequest):
    """Clear FAISS data - either all data or by specific type."""
    if not request.confirm:
        raise HTTPException(
            status_code=400, 
            detail="Must set 'confirm: true' to proceed with data clearing"
        )
    
    try:
        faiss_index = get_faiss_index()
        
        if request.type_filter:
            # Clear only specific type
            await faiss_index.remove_all_vectors_by_type(request.type_filter)
            message = f"Cleared all FAISS vectors of type '{request.type_filter}'"
        else:
            # Clear all data
            await faiss_index.clear_all_data()
            message = "All FAISS data cleared successfully"
        
        return {"message": message, "stats": faiss_index.get_index_stats()}
        
    except Exception as e:
        logger.error(f"Failed to clear FAISS data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear FAISS data: {str(e)}")

@router.delete("/session/{session_id}", status_code=200)
async def delete_session_vectors(session_id: str):
    """Delete all FAISS vectors related to a specific chat session."""
    try:
        faiss_index = get_faiss_index()
        await faiss_index.remove_vectors_by_session(session_id)
        return {"message": f"Removed all vectors for session {session_id}"}
    except Exception as e:
        logger.error(f"Failed to remove session vectors: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove session vectors: {str(e)}")

@router.delete("/card/{card_id}", status_code=200)
async def delete_card_vectors(card_id: str):
    """Delete all FAISS vectors related to a specific character/scenario card."""
    try:
        faiss_index = get_faiss_index()
        await faiss_index.remove_vectors_by_card(card_id)
        return {"message": f"Removed all vectors for card {card_id}"}
    except Exception as e:
        logger.error(f"Failed to remove card vectors: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove card vectors: {str(e)}")

@router.delete("/lore/{lore_entry_id}", status_code=200)
async def delete_lore_vectors(lore_entry_id: str):
    """Delete FAISS vectors for a specific lore entry."""
    try:
        faiss_index = get_faiss_index()
        await faiss_index.remove_vectors_by_lore_entry(lore_entry_id)
        return {"message": f"Removed vectors for lore entry {lore_entry_id}"}
    except Exception as e:
        logger.error(f"Failed to remove lore vectors: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove lore vectors: {str(e)}")

@router.get("/vectors", status_code=200)
def list_all_vectors():
    """List all vectors currently in the FAISS index."""
    try:
        faiss_index = get_faiss_index()
        vectors = faiss_index.list_all_vectors()
        return {
            "vectors": vectors,
            "count": len(vectors),
            "stats": faiss_index.get_index_stats()
        }
    except Exception as e:
        logger.error(f"Failed to list vectors: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list vectors: {str(e)}")

@router.get("/detect-unmapped", status_code=200)
def detect_unmapped_vectors():
    """Detect vectors in FAISS index that don't have corresponding mapping entries."""
    try:
        faiss_index = get_faiss_index()
        unmapped_vectors = faiss_index.detect_unmapped_vectors()
        return {
            "unmapped_vectors": unmapped_vectors,
            "count": len(unmapped_vectors),
            "stats": faiss_index.get_index_stats()
        }
    except Exception as e:
        logger.error(f"Failed to detect unmapped vectors: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to detect unmapped vectors: {str(e)}")

@router.delete("/cleanup-unmapped", status_code=200)
async def cleanup_unmapped_vectors():
    """Remove unmapped vectors from the FAISS index."""
    try:
        faiss_index = get_faiss_index()
        removed_count = await faiss_index.cleanup_unmapped_vectors()
        return {
            "message": f"Removed {removed_count} unmapped vectors",
            "removed_count": removed_count,
            "stats": faiss_index.get_index_stats()
        }
    except Exception as e:
        logger.error(f"Failed to cleanup unmapped vectors: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup unmapped vectors: {str(e)}")
