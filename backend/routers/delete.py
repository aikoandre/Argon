from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.models.chat_session import ChatSession
from backend.models.chat_message import ChatMessage
from backend.models.full_analysis_result import FullAnalysisResult
from backend.models.session_cache_fact import SessionCacheFact
from backend.models.session_relationship import SessionRelationship
from backend.models.session_lore_modification import SessionLoreModification
from backend.models.active_session_event import ActiveSessionEvent
from backend.models.temp_message_variant import TempMessageVariant
from backend.database import get_db

router = APIRouter(tags=["Delete"], prefix="/delete")

@router.post("/after_message/{message_id}", response_model=dict)
def delete_messages_after(message_id: str, db: Session = Depends(get_db)):
    # Find the message and its session
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    session_id = msg.chat_session_id
    # Delete all messages after this one
    db.query(ChatMessage).filter(
        ChatMessage.chat_session_id == session_id,
        ChatMessage.timestamp > msg.timestamp
    ).delete(synchronize_session=False)
    db.commit()
    # Restore session state from FullAnalysisResult
    analysis = db.query(FullAnalysisResult).filter(FullAnalysisResult.source_message_id == message_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis snapshot for reversion.")
    # --- Restore session state from FullAnalysisResult ---
    analysis_data = analysis.analysis_data
    # Restore SessionCacheFacts
    if 'session_cache_facts' in analysis_data:
        db.query(SessionCacheFact).filter(SessionCacheFact.chat_session_id == session_id).delete(synchronize_session=False)
        for fact in analysis_data['session_cache_facts']:
            db.add(SessionCacheFact(chat_session_id=session_id, key=fact['key'], value=fact['value']))
    # Restore SessionRelationships
    if 'session_relationships' in analysis_data:
        db.query(SessionRelationship).filter(SessionRelationship.chat_session_id == session_id).delete(synchronize_session=False)
        for rel in analysis_data['session_relationships']:
            db.add(SessionRelationship(chat_session_id=session_id, **rel))
    # Restore SessionLoreModifications
    if 'session_lore_modifications' in analysis_data:
        db.query(SessionLoreModification).filter(SessionLoreModification.chat_session_id == session_id).delete(synchronize_session=False)
        for mod in analysis_data['session_lore_modifications']:
            db.add(SessionLoreModification(chat_session_id=session_id, **mod))
    # Restore ActiveSessionEvents
    if 'active_session_events' in analysis_data:
        db.query(ActiveSessionEvent).filter(ActiveSessionEvent.chat_session_id == session_id).delete(synchronize_session=False)
        for event in analysis_data['active_session_events']:
            db.add(ActiveSessionEvent(chat_session_id=session_id, **event))
    db.commit()
    # --- Remove dynamic memories from FAISS that are no longer relevant ---
    from backend.services.faiss_service import get_faiss_index
    faiss_index = get_faiss_index()
    if 'dynamic_memories_to_remove' in analysis_data:
        for item_id in analysis_data['dynamic_memories_to_remove']:
            try:
                faiss_index.remove_ids([item_id])
            except Exception:
                pass
    return {"status": "ok"}

@router.delete("/message/{message_id}", response_model=dict)
def delete_specific_message(message_id: str, db: Session = Depends(get_db)):
    """
    Delete a specific message and its related data (analysis, memories, variants).
    This deletes ONLY the specified message, not messages after it.
    """
    import uuid
    
    # Find the message
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    
    session_id = msg.chat_session_id
    
    # Convert message_id to UUID for FullAnalysisResult query (it uses UUID type)
    try:
        message_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID format.")
    
    # Delete associated FullAnalysisResult (if any)
    db.query(FullAnalysisResult).filter(FullAnalysisResult.source_message_id == message_uuid).delete(synchronize_session=False)
    
    # Delete associated TempMessageVariant records (CASCADE will handle TempVariantAnalysis and TempVariantMemory)
    variants = db.query(TempMessageVariant).filter(TempMessageVariant.original_message_id == message_id).all()
    variant_faiss_ids = []
    
    # Collect FAISS IDs from variant memories before deletion
    for variant in variants:
        for memory in variant.memory_vectors:
            variant_faiss_ids.append(memory.faiss_vector_id)
    
    # Delete variants (CASCADE will clean up analysis and memory records)
    db.query(TempMessageVariant).filter(TempMessageVariant.original_message_id == message_id).delete(synchronize_session=False)
    
    # Delete the message itself
    db.delete(msg)
    db.commit()
    
    # Clean up FAISS vectors for variants
    if variant_faiss_ids:
        from backend.services.faiss_service import get_faiss_index
        faiss_index = get_faiss_index()
        try:
            faiss_index.remove_ids(variant_faiss_ids)
        except Exception as e:
            # Log but don't fail the deletion if FAISS cleanup fails
            print(f"Warning: Failed to remove FAISS vectors for variants: {e}")
    
    return {"status": "ok", "deleted_message_id": message_id}
