"""
WorldMaintenanceWorker for the Unified LLM Services Architecture.

This worker processes tasks from the MaintenanceQueue using the Maintenance Service.
It handles UPDATE_NOTE, CREATE_ENTITY, and SIMULATE_WORLD tasks asynchronously.
"""
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.models.maintenance_queue import MaintenanceQueue
from backend.schemas.maintenance_queue import TaskType, TaskStatus
from backend.services.unified_llm_service import get_llm_service
from backend.models.lore_entry import LoreEntry
from backend.models.master_world import MasterWorld

logger = logging.getLogger(__name__)


class WorldMaintenanceWorker:
    """Worker that processes maintenance tasks from the queue"""
    
    def __init__(self):
        self.llm_service = get_llm_service()
        self.is_running = False
        self.processing_task = None
        self.stats = {
            "tasks_processed": 0,
            "tasks_failed": 0,
            "last_run": None,
            "current_status": "idle"
        }
    
    async def start(self, poll_interval: int = 5) -> None:
        """Start the worker to continuously process tasks"""
        self.is_running = True
        self.stats["current_status"] = "running"
        logger.info("WorldMaintenanceWorker started")
        
        while self.is_running:
            try:
                await self._process_next_task()
                await asyncio.sleep(poll_interval)
            except Exception as e:
                logger.error(f"Error in worker main loop: {str(e)}")
                await asyncio.sleep(poll_interval * 2)  # Longer sleep on error
    
    def stop(self) -> None:
        """Stop the worker"""
        self.is_running = False
        self.stats["current_status"] = "stopped"
        logger.info("WorldMaintenanceWorker stopped")
    
    async def _process_next_task(self) -> None:
        """Process the next available task from the queue"""
        db: Session = next(get_db())
        
        try:
            # Get the highest priority pending task
            task = db.query(MaintenanceQueue)\
                .filter(MaintenanceQueue.status == TaskStatus.PENDING)\
                .order_by(MaintenanceQueue.priority.desc(), MaintenanceQueue.created_at.asc())\
                .first()
            
            if not task:
                return  # No tasks to process
            
            # Mark task as processing
            task.status = TaskStatus.PROCESSING
            task.processed_at = datetime.now()
            db.commit()
            
            self.processing_task = task
            logger.info(f"Processing task {task.id}: {task.task_type}")
            
            # Process the task based on its type
            success = False
            error_message = None
            
            try:
                if task.task_type == TaskType.UPDATE_NOTE:
                    success = await self._process_update_note_task(task, db)
                elif task.task_type == TaskType.CREATE_ENTITY:
                    success = await self._process_create_entity_task(task, db)
                elif task.task_type == TaskType.SIMULATE_WORLD:
                    success = await self._process_simulate_world_task(task, db)
                else:
                    error_message = f"Unknown task type: {task.task_type}"
                    logger.error(error_message)
            
            except Exception as e:
                error_message = str(e)
                logger.error(f"Error processing task {task.id}: {error_message}")
            
            # Update task status
            if success:
                task.status = TaskStatus.COMPLETED
                self.stats["tasks_processed"] += 1
                logger.info(f"Successfully completed task {task.id}")
            else:
                task.status = TaskStatus.FAILED
                task.error_message = error_message
                self.stats["tasks_failed"] += 1
                logger.error(f"Failed to complete task {task.id}: {error_message}")
            
            db.commit()
            self.stats["last_run"] = datetime.now().isoformat()
            
        except Exception as e:
            logger.error(f"Error in _process_next_task: {str(e)}")
            db.rollback()
        finally:
            self.processing_task = None
            db.close()
    
    async def _process_update_note_task(self, task: MaintenanceQueue, db: Session) -> bool:
        """Process an UPDATE_NOTE task"""
        try:
            task_data = task.task_data
            entity_id = task_data.get("entity_id")
            update_summary = task_data.get("update_summary")
            context = task_data.get("context", {})
            
            if not entity_id or not update_summary:
                logger.error(f"Invalid UPDATE_NOTE task data: {task_data}")
                return False
            
            # Get the current lore entry
            lore_entry = db.query(LoreEntry).filter(LoreEntry.id == entity_id).first()
            if not lore_entry:
                logger.error(f"Lore entry not found: {entity_id}")
                return False
            
            # Use the Maintenance Service to update the note
            result = await self.llm_service.update_note(
                entity_id=entity_id,
                current_content=lore_entry.content,
                update_summary=update_summary,
                context=json.dumps(context) if context else None
            )
            
            if not result.get("success"):
                logger.error(f"LLM service failed for UPDATE_NOTE: {result.get('error')}")
                return False
            
            # Update the lore entry with the new content
            updated_content = result.get("content", "").strip()
            if updated_content:
                lore_entry.content = updated_content
                lore_entry.updated_at = datetime.now()
                db.commit()
                logger.info(f"Updated lore entry {entity_id}")
                return True
            else:
                logger.error(f"Empty content returned for UPDATE_NOTE task {task.id}")
                return False
                
        except Exception as e:
            logger.error(f"Error in _process_update_note_task: {str(e)}")
            return False
    
    async def _process_create_entity_task(self, task: MaintenanceQueue, db: Session) -> bool:
        """Process a CREATE_ENTITY task"""
        try:
            task_data = task.task_data
            entity_type = task_data.get("entity_type")
            entity_data = task_data.get("entity_data", {})
            world_id = task_data.get("world_id")
            
            if not entity_type or not entity_data:
                logger.error(f"Invalid CREATE_ENTITY task data: {task_data}")
                return False
            
            # For now, we'll primarily handle lore entry creation
            if entity_type.lower() in ["character", "location", "item", "concept"]:
                # Create a new lore entry
                new_lore_entry = LoreEntry(
                    title=entity_data.get("title", f"New {entity_type}"),
                    content=entity_data.get("content", ""),
                    master_world_id=world_id,
                    category=entity_type.lower()
                )
                
                db.add(new_lore_entry)
                db.commit()
                logger.info(f"Created new {entity_type} lore entry: {new_lore_entry.id}")
                return True
            else:
                logger.warning(f"Unsupported entity type for creation: {entity_type}")
                return False
                
        except Exception as e:
            logger.error(f"Error in _process_create_entity_task: {str(e)}")
            return False
    
    async def _process_simulate_world_task(self, task: MaintenanceQueue, db: Session) -> bool:
        """Process a SIMULATE_WORLD task"""
        try:
            task_data = task.task_data
            world_id = task_data.get("world_id")
            simulation_scope = task_data.get("simulation_scope")
            context = task_data.get("context", {})
            
            if not world_id or not simulation_scope:
                logger.error(f"Invalid SIMULATE_WORLD task data: {task_data}")
                return False
            
            # Get world information for context
            world = db.query(MasterWorld).filter(MasterWorld.id == world_id).first()
            if not world:
                logger.error(f"World not found: {world_id}")
                return False
            
            # Build context for simulation
            simulation_context = {
                "world_name": world.name,
                "world_description": world.description,
                **context
            }
            
            # Use the Maintenance Service to simulate world events
            result = await self.llm_service.simulate_world(
                world_id=world_id,
                simulation_scope=simulation_scope,
                context=json.dumps(simulation_context)
            )
            
            if not result.get("success"):
                logger.error(f"LLM service failed for SIMULATE_WORLD: {result.get('error')}")
                return False
            
            # Parse the simulation results and create new UPDATE_NOTE tasks
            simulation_content = result.get("content", "").strip()
            try:
                simulation_results = json.loads(simulation_content)
                if isinstance(simulation_results, list):
                    for update in simulation_results:
                        if isinstance(update, dict) and "entity_id" in update and "update_summary" in update:
                            # Create a new UPDATE_NOTE task
                            new_task = MaintenanceQueue(
                                task_type=TaskType.UPDATE_NOTE,
                                task_data={
                                    "entity_id": update["entity_id"],
                                    "update_summary": update["update_summary"],
                                    "context": {"source": "world_simulation", "world_id": world_id}
                                },
                                priority=update.get("priority", 1)
                            )
                            db.add(new_task)
                    
                    db.commit()
                    logger.info(f"Created {len(simulation_results)} new tasks from world simulation")
                    return True
                else:
                    logger.error(f"Invalid simulation results format: {simulation_content}")
                    return False
                    
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse simulation results: {e}")
                return False
                
        except Exception as e:
            logger.error(f"Error in _process_simulate_world_task: {str(e)}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get worker statistics"""
        stats = self.stats.copy()
        if self.processing_task:
            stats["current_task"] = {
                "id": self.processing_task.id,
                "type": self.processing_task.task_type,
                "created_at": self.processing_task.created_at.isoformat()
            }
        return stats


# Global worker instance
maintenance_worker = WorldMaintenanceWorker()


def get_maintenance_worker() -> WorldMaintenanceWorker:
    """Get the global maintenance worker instance"""
    return maintenance_worker
