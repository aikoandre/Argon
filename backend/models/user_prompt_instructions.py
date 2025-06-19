# backend/models/user_prompt_instructions.py
from sqlalchemy import Column, Integer, Text, DateTime, func
from db.database import Base

class UserPromptInstructions(Base):
    __tablename__ = "user_prompt_instructions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Simple user instructions for each LLM call type
    primary_instructions = Column(Text, nullable=True, default="")
    extraction_instructions = Column(Text, nullable=True, default="")
    analysis_instructions = Column(Text, nullable=True, default="")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<UserPromptInstructions(id={self.id})>"
