# backend/routers/prompt_instructions.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.database import get_db
from models.user_prompt_instructions import UserPromptInstructions
from schemas.user_prompt_instructions import (
    UserPromptInstructionsInDB, 
    UserPromptInstructionsUpdate
)

router = APIRouter(
    prefix="/prompt-instructions",
    tags=["Prompt Instructions"],
    responses={404: {"description": "Not found"}},
)

USER_INSTRUCTIONS_ID = 1  # Single global instructions row

@router.get("", response_model=UserPromptInstructionsInDB)
async def get_prompt_instructions(db: Session = Depends(get_db)):
    """Get user's custom prompt instructions for each LLM call type"""
    instructions = db.query(UserPromptInstructions).filter(
        UserPromptInstructions.id == USER_INSTRUCTIONS_ID
    ).first()
    
    if not instructions:
        # Create default empty instructions
        instructions = UserPromptInstructions(
            id=USER_INSTRUCTIONS_ID,
            primary_instructions="",
            extraction_instructions="",
            analysis_instructions=""
        )
        db.add(instructions)
        db.commit()
        db.refresh(instructions)
    
    return instructions

@router.put("", response_model=UserPromptInstructionsInDB)
async def update_prompt_instructions(
    instructions_update: UserPromptInstructionsUpdate,
    db: Session = Depends(get_db)
):
    """Update user's custom prompt instructions"""
    instructions = db.query(UserPromptInstructions).filter(
        UserPromptInstructions.id == USER_INSTRUCTIONS_ID
    ).first()
    
    if not instructions:
        # Create new instructions
        instructions = UserPromptInstructions(
            id=USER_INSTRUCTIONS_ID,
            **instructions_update.model_dump()
        )
        db.add(instructions)
    else:
        # Update existing instructions
        for field, value in instructions_update.model_dump().items():
            if value is not None:
                setattr(instructions, field, value)
    
    db.commit()
    db.refresh(instructions)
    return instructions
