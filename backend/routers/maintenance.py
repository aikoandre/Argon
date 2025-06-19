"""
API router for MaintenanceQueue operations in the Unified LLM Services Architecture.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from db.database import get_db
from models.maintenance_queue import MaintenanceQueue
from schemas.maintenance_queue import (
    MaintenanceQueueCreate,
    MaintenanceQueueUpdate,
    MaintenanceQueueResponse,
    TaskType,
    TaskStatus
)
from services.maintenance_worker import get_maintenance_worker

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.post("/tasks", response_model=MaintenanceQueueResponse)
async def create_maintenance_task(
    task: MaintenanceQueueCreate,
    db: Session = Depends(get_db)
):
    """Create a new maintenance task"""
    try:
        db_task = MaintenanceQueue(
            task_type=task.task_type,
            task_data=task.task_data,
            priority=task.priority
        )
        
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        
        return MaintenanceQueueResponse.model_validate(db_task)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create maintenance task: {str(e)}")


@router.get("/tasks", response_model=List[MaintenanceQueueResponse])
async def get_maintenance_tasks(
    status: Optional[TaskStatus] = Query(None, description="Filter by task status"),
    task_type: Optional[TaskType] = Query(None, description="Filter by task type"),
    limit: int = Query(50, le=100, description="Maximum number of tasks to return"),
    offset: int = Query(0, ge=0, description="Number of tasks to skip"),
    db: Session = Depends(get_db)
):
    """Get maintenance tasks with optional filtering"""
    try:
        query = db.query(MaintenanceQueue)
        
        if status:
            query = query.filter(MaintenanceQueue.status == status)
        if task_type:
            query = query.filter(MaintenanceQueue.task_type == task_type)
        
        tasks = query.order_by(MaintenanceQueue.created_at.desc())\
                    .offset(offset)\
                    .limit(limit)\
                    .all()
        
        return [MaintenanceQueueResponse.model_validate(task) for task in tasks]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve maintenance tasks: {str(e)}")


@router.get("/tasks/{task_id}", response_model=MaintenanceQueueResponse)
async def get_maintenance_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific maintenance task by ID"""
    try:
        task = db.query(MaintenanceQueue).filter(MaintenanceQueue.id == task_id).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="Maintenance task not found")
        
        return MaintenanceQueueResponse.model_validate(task)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve maintenance task: {str(e)}")


@router.patch("/tasks/{task_id}", response_model=MaintenanceQueueResponse)
async def update_maintenance_task(
    task_id: int,
    task_update: MaintenanceQueueUpdate,
    db: Session = Depends(get_db)
):
    """Update a maintenance task"""
    try:
        task = db.query(MaintenanceQueue).filter(MaintenanceQueue.id == task_id).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="Maintenance task not found")
        
        # Update fields if provided
        if task_update.status is not None:
            task.status = task_update.status
        if task_update.processed_at is not None:
            task.processed_at = task_update.processed_at
        if task_update.error_message is not None:
            task.error_message = task_update.error_message
        
        db.commit()
        db.refresh(task)
        
        return MaintenanceQueueResponse.model_validate(task)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update maintenance task: {str(e)}")


@router.delete("/tasks/{task_id}")
async def delete_maintenance_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Delete a maintenance task"""
    try:
        task = db.query(MaintenanceQueue).filter(MaintenanceQueue.id == task_id).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="Maintenance task not found")
        
        db.delete(task)
        db.commit()
        
        return {"message": "Maintenance task deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete maintenance task: {str(e)}")


@router.post("/tasks/batch", response_model=List[MaintenanceQueueResponse])
async def create_batch_maintenance_tasks(
    tasks: List[MaintenanceQueueCreate],
    db: Session = Depends(get_db)
):
    """Create multiple maintenance tasks in a batch"""
    try:
        db_tasks = []
        for task in tasks:
            db_task = MaintenanceQueue(
                task_type=task.task_type,
                task_data=task.task_data,
                priority=task.priority
            )
            db_tasks.append(db_task)
            db.add(db_task)
        
        db.commit()
        
        for db_task in db_tasks:
            db.refresh(db_task)
        
        return [MaintenanceQueueResponse.model_validate(task) for task in db_tasks]
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create batch maintenance tasks: {str(e)}")


@router.get("/queue/stats")
async def get_queue_stats(db: Session = Depends(get_db)):
    """Get maintenance queue statistics"""
    try:
        stats = {}
        
        # Count tasks by status
        for status in TaskStatus:
            count = db.query(MaintenanceQueue).filter(MaintenanceQueue.status == status).count()
            stats[f"{status.value}_tasks"] = count
        
        # Count tasks by type
        for task_type in TaskType:
            count = db.query(MaintenanceQueue).filter(MaintenanceQueue.task_type == task_type).count()
            stats[f"{task_type.value}_tasks"] = count
        
        # Get oldest pending task
        oldest_pending = db.query(MaintenanceQueue)\
            .filter(MaintenanceQueue.status == TaskStatus.PENDING)\
            .order_by(MaintenanceQueue.created_at.asc())\
            .first()
        
        if oldest_pending:
            stats["oldest_pending_task"] = {
                "id": oldest_pending.id,
                "created_at": oldest_pending.created_at.isoformat(),
                "age_seconds": (datetime.now() - oldest_pending.created_at).total_seconds()
            }
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve queue statistics: {str(e)}")


@router.get("/worker/stats")
async def get_worker_stats():
    """Get maintenance worker statistics"""
    try:
        worker = get_maintenance_worker()
        return worker.get_stats()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve worker statistics: {str(e)}")


@router.post("/worker/start")
async def start_worker():
    """Start the maintenance worker"""
    try:
        worker = get_maintenance_worker()
        if worker.is_running:
            return {"message": "Worker is already running"}
        
        # Start the worker in the background
        import asyncio
        asyncio.create_task(worker.start())
        
        return {"message": "Maintenance worker started"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start worker: {str(e)}")


@router.post("/worker/stop")
async def stop_worker():
    """Stop the maintenance worker"""
    try:
        worker = get_maintenance_worker()
        worker.stop()
        
        return {"message": "Maintenance worker stopped"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop worker: {str(e)}")
