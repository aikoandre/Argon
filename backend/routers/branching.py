from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.chat_session import ChatSession
from models.chat_message import ChatMessage
from models.full_analysis_result import FullAnalysisResult
from db.database import get_db

router = APIRouter(tags=["Branching"], prefix="/branch")

@router.post("/from_message/{message_id}", response_model=dict)
def create_branch_from_message(message_id: str, db: Session = Depends(get_db)):
    # Find the message and its session
    orig_msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not orig_msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    orig_session = db.query(ChatSession).filter(ChatSession.id == orig_msg.chat_session_id).first()
    if not orig_session:
        raise HTTPException(status_code=404, detail="Session not found.")
    # Create new session (branch)
    new_session = ChatSession(
        card_type=orig_session.card_type,
        card_id=orig_session.card_id,
        title=orig_session.title + " (branch)",
        user_persona_id=orig_session.user_persona_id,
        master_world_id=orig_session.master_world_id
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    # Copy messages up to and including the branch point
    msgs = db.query(ChatMessage).filter(
        ChatMessage.chat_session_id == orig_session.id,
        ChatMessage.timestamp <= orig_msg.timestamp
    ).order_by(ChatMessage.timestamp.asc()).all()
    for m in msgs:
        new_msg = ChatMessage(
            chat_session_id=new_session.id,
            sender_type=m.sender_type,
            content=m.content,
            timestamp=m.timestamp,
            message_metadata=m.message_metadata,
            active_persona_name=m.active_persona_name,
            active_persona_image_url=m.active_persona_image_url,
            is_beginning_message=m.is_beginning_message
        )
        db.add(new_msg)
    db.commit()
    # Restore session state from FullAnalysisResult
    analysis = db.query(FullAnalysisResult).filter(FullAnalysisResult.source_message_id == message_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis snapshot for branch point.")
    # TODO: Restore SessionCacheFacts, SessionRelationships, SessionLoreModifications, ActiveSessionEvents from analysis.analysis_data
    # This is a placeholder for the actual restoration logic
    return {"new_session_id": new_session.id}
