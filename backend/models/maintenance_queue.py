from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from backend.db.database import Base
from typing import Dict, Any, Optional
from datetime import datetime


class MaintenanceQueue(Base):
    """
    Queue for background maintenance tasks in the Unified LLM Services Architecture.
    Handles UPDATE_NOTE, CREATE_ENTITY, and SIMULATE_WORLD tasks.
    """
    __tablename__ = "maintenance_queue"

    id = Column(Integer, primary_key=True, index=True)
    task_type = Column(String(50), nullable=False, index=True)  # UPDATE_NOTE, CREATE_ENTITY, SIMULATE_WORLD
    task_data = Column(JSON, nullable=False)  # Task-specific data payload
    priority = Column(Integer, default=0, index=True)  # Higher number = higher priority
    status = Column(String(20), default='pending', index=True)  # pending, processing, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    
    def __repr__(self):
        return f"<MaintenanceQueue(id={self.id}, task_type='{self.task_type}', status='{self.status}')>"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "task_type": self.task_type,
            "task_data": self.task_data,
            "priority": self.priority,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "error_message": self.error_message
        }
