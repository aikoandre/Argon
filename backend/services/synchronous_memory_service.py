# backend/services/synchronous_memory_service.py
"""
Synchronous Memory Service for SessionNotes system.

Orchestrates the complete memory update pipeline synchronously.
"""
import logging
import time
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel

from .enhanced_analysis_service import EnhancedAnalysisService, EntityUpdate, EntityCreation, EnhancedAnalysisResult
from .entity_matching_service import EntityMatchingService
from .session_note_service import SessionNoteService
from .composite_document_service import CompositeDocumentService
from .validation_service import ValidationService
from .session_note_rewriter import SessionNoteRewriter
from .entity_creation_service import EntityCreationService
from .faiss_service import get_faiss_index
from .litellm_service import litellm_service
from ..models.lore_entry import LoreEntry
from ..models.session_note import SessionNote
from ..schemas.session_note import SessionNoteCreate, SessionNoteUpdate

logger = logging.getLogger(__name__)


class MemoryOperationResult(BaseModel):
    """Result of a single memory operation"""
    operation_type: str  # 'update' or 'create'
    success: bool
    entity_name: str = ""
    entity_id: str = ""
    error_message: str = ""


class SynchronousMemoryResult(BaseModel):
    """Result of complete synchronous memory processing"""
    success: bool
    total_operations: int = 0
    successful_operations: int = 0
    failed_operations: int = 0
    operation_results: List[MemoryOperationResult] = []
    error_message: str = ""


class SynchronousMemoryService:
    """Service for synchronous memory pipeline orchestration"""
    
    def __init__(self):
        self.enhanced_analysis = EnhancedAnalysisService()
        self.entity_matching = EntityMatchingService()
        self.session_note_service = SessionNoteService()
        self.composite_document_service = CompositeDocumentService()
        self.validation_service = ValidationService()
        self.session_note_rewriter = SessionNoteRewriter()
        self.entity_creation_service = EntityCreationService()
        self.faiss_index = get_faiss_index()
        self.litellm_service = litellm_service

    async def process_turn_memory_updates(
        self,
        db: Session,
        session_id: str,
        turn_number: int,
        turn_context: Dict[str, Any],
        user_settings: Dict[str, Any],
        master_world_id: str,
        reasoning_mode: str = None,
        reasoning_effort: str = None
    ) -> SynchronousMemoryResult:
        """
        Process complete turn memory updates synchronously.
        
        This is the main orchestration method that:
        1. Analyzes the turn for memory operations
        2. Processes entity updates
        3. Creates new entities
        4. Updates composite documents
        5. Returns complete result
        """
        logger.info(f"[SynchronousMemory] Starting memory processing for session {session_id}, turn {turn_number}")
        
        # Store turn context for use by sub-services
        self._current_turn_context = turn_context
        
        try:
            # Step 1: Enhanced Analysis
            analysis_result = await self.enhanced_analysis.analyze_turn_for_memory_operations(
                db=db,
                turn_context=turn_context,
                user_settings=user_settings,
                master_world_id=master_world_id,
                reasoning_mode=reasoning_mode,
                reasoning_effort=reasoning_effort
            )
            
            if not analysis_result.success:
                return SynchronousMemoryResult(
                    success=False,
                    error_message=f"Analysis failed: {analysis_result.error_message}"
                )
            
            # Step 1.5: Validate Analysis Results
            validation_result = self.validation_service.validate_analysis_result(analysis_result)
            
            if not validation_result.is_valid:
                error_messages = [error.message for error in validation_result.errors]
                logger.warning(f"[SynchronousMemory] Analysis validation failed: {error_messages}")
                
                # For now, continue with processing but log the issues
                # In production, you might want to retry the analysis
                for warning in validation_result.warnings:
                    logger.warning(f"[SynchronousMemory] Validation warning: {warning}")
            
            total_ops = len(analysis_result.updates) + len(analysis_result.creations)
            logger.info(f"[SynchronousMemory] Analysis found {len(analysis_result.updates)} updates, {len(analysis_result.creations)} creations")
            
            operation_results = []
            successful_ops = 0
            
            # Step 2: Process Entity Updates
            for update in analysis_result.updates:
                result = await self._process_entity_update(
                    db=db,
                    session_id=session_id,
                    turn_number=turn_number,
                    update=update,
                    user_settings=user_settings,
                    master_world_id=master_world_id
                )
                operation_results.append(result)
                if result.success:
                    successful_ops += 1
            
            # Step 3: Process Entity Creations
            for creation in analysis_result.creations:
                result = await self._process_entity_creation(
                    db=db,
                    session_id=session_id,
                    turn_number=turn_number,
                    creation=creation,
                    user_settings=user_settings,
                    master_world_id=master_world_id
                )
                operation_results.append(result)
                if result.success:
                    successful_ops += 1
            
            # Step 4: Commit all changes
            try:
                db.commit()
                logger.info(f"[SynchronousMemory] Committed {successful_ops}/{total_ops} operations")
            except SQLAlchemyError as e:
                db.rollback()
                logger.error(f"[SynchronousMemory] Database commit failed: {e}")
                return SynchronousMemoryResult(
                    success=False,
                    error_message=f"Database commit failed: {e}"
                )
            
            return SynchronousMemoryResult(
                success=True,
                total_operations=total_ops,
                successful_operations=successful_ops,
                failed_operations=total_ops - successful_ops,
                operation_results=operation_results
            )
            
        except Exception as e:
            db.rollback()
            logger.error(f"[SynchronousMemory][ERROR] {e}")
            return SynchronousMemoryResult(
                success=False,
                error_message=str(e)
            )

    async def _process_entity_update(
        self,
        db: Session,
        session_id: str,
        turn_number: int,
        update: EntityUpdate,
        user_settings: Dict[str, Any],
        master_world_id: str
    ) -> MemoryOperationResult:
        """Process a single entity update"""
        try:
            # Find matching entity
            match_result = await self.entity_matching.find_matching_entity(
                db=db,
                entity_description=update.entity_description,
                master_world_id=master_world_id,
                user_settings=user_settings
            )
            
            if not match_result.success:
                return MemoryOperationResult(
                    operation_type="update",
                    success=False,
                    error_message=f"Entity matching failed: {match_result.error_message}"
                )
            
            if not match_result.match:
                return MemoryOperationResult(
                    operation_type="update",
                    success=False,
                    error_message=f"No entity found matching '{update.entity_description}'"
                )
            
            # Get or create SessionNote
            session_note = self.session_note_service.get_session_note_for_lore_entry(
                db=db,
                session_id=session_id,
                lore_entry_id=match_result.match.lore_entry_id
            )
            
            if session_note:
                # Update existing SessionNote using advanced rewriter
                rewrite_result = await self.session_note_rewriter.rewrite_session_note(
                    lore_entry_content=match_result.match.entity_description,
                    current_session_note=session_note.note_content or "",
                    update_summary=update.update_summary,
                    user_settings=user_settings,
                    entity_name=match_result.match.entity_name,
                    turn_context=getattr(self, '_current_turn_context', None)
                )
                
                if not rewrite_result.success:
                    logger.warning(f"[SynchronousMemory] Rewrite failed, using fallback: {rewrite_result.error_message}")
                
                update_result = self.session_note_service.update_session_note(
                    db=db,
                    session_note_id=session_note.id,
                    update_data=SessionNoteUpdate(
                        note_content=rewrite_result.rewritten_content,
                        last_updated_turn=turn_number
                    )
                )
                
                if not update_result.success:
                    return MemoryOperationResult(
                        operation_type="update",
                        success=False,
                        error_message=update_result.error_message
                    )
                
                logger.info(f"[SynchronousMemory] Updated session note for {match_result.match.entity_name} (quality: {rewrite_result.quality_score:.2f})")
            else:
                # Create new SessionNote using advanced rewriter
                rewrite_result = await self.session_note_rewriter.rewrite_session_note(
                    lore_entry_content=match_result.match.entity_description,
                    current_session_note="",
                    update_summary=update.update_summary,
                    user_settings=user_settings,
                    entity_name=match_result.match.entity_name,
                    turn_context=getattr(self, '_current_turn_context', None)
                )
                
                create_result = self.session_note_service.create_session_note(
                    db=db,
                    session_note_data=SessionNoteCreate(
                        session_id=session_id,
                        lore_entry_id=match_result.match.lore_entry_id,
                        note_content=rewrite_result.rewritten_content,
                        last_updated_turn=turn_number
                    )
                )
                
                if not create_result.success:
                    return MemoryOperationResult(
                        operation_type="update",
                        success=False,
                        error_message=create_result.error_message
                    )
            
            # Update FAISS index with composite document
            await self._update_faiss_for_entity(
                db=db,
                lore_entry_id=match_result.match.lore_entry_id,
                session_id=session_id,
                user_settings=user_settings
            )
            
            return MemoryOperationResult(
                operation_type="update",
                success=True,
                entity_name=match_result.match.entity_name,
                entity_id=match_result.match.lore_entry_id
            )
            
        except Exception as e:
            logger.error(f"Error processing entity update: {e}")
            return MemoryOperationResult(
                operation_type="update",
                success=False,
                error_message=str(e)
            )

    async def _process_entity_creation(
        self,
        db: Session,
        session_id: str,
        turn_number: int,
        creation: EntityCreation,
        user_settings: Dict[str, Any],
        master_world_id: str
    ) -> MemoryOperationResult:
        """Process a single entity creation"""
        try:
            # Get existing entities context for duplicate prevention
            existing_entities = db.query(LoreEntry).filter(
                LoreEntry.master_world_id == master_world_id
            ).limit(20).all()  # Limit for context size
            
            existing_context = "\n".join([
                f"- {entity.name} ({entity.entry_type}): {entity.description[:100]}..."
                for entity in existing_entities
            ])
            
            # Generate LoreEntry data using advanced creation service
            creation_result = await self.entity_creation_service.create_entity(
                creation_summary=creation.creation_summary,
                entity_type=creation.entity_type,
                user_settings=user_settings,
                existing_entities_context=existing_context,
                turn_context=getattr(self, '_current_turn_context', None)
            )
            
            if not creation_result.success:
                return MemoryOperationResult(
                    operation_type="create",
                    success=False,
                    error_message=creation_result.error_message
                )
            
            entity_data = creation_result.entity_data
            
            # Create new LoreEntry
            import uuid
            new_lore_entry = LoreEntry(
                id=str(uuid.uuid4()),
                entry_type=creation.entity_type,
                name=entity_data["name"],
                description=entity_data["description"],
                tags=entity_data.get("tags", []),
                master_world_id=master_world_id,
                is_dynamically_generated=True,
                created_in_session_id=session_id
            )
            
            db.add(new_lore_entry)
            db.flush()  # Get the ID without committing
            
            # Create initial SessionNote
            create_result = self.session_note_service.create_session_note(
                db=db,
                session_note_data=SessionNoteCreate(
                    session_id=session_id,
                    lore_entry_id=new_lore_entry.id,
                    note_content="",  # Start with empty note
                    last_updated_turn=turn_number
                )
            )
            
            if not create_result.success:
                return MemoryOperationResult(
                    operation_type="create",
                    success=False,
                    error_message=create_result.error_message
                )
            
            # Add new entity to FAISS index with composite document
            await self._update_faiss_for_entity(
                db=db,
                lore_entry_id=new_lore_entry.id,
                session_id=session_id,
                user_settings=user_settings
            )
            
            return MemoryOperationResult(
                operation_type="create",
                success=True,
                entity_name=entity_data["name"],
                entity_id=new_lore_entry.id
            )
            
        except Exception as e:
            logger.error(f"Error processing entity creation: {e}")
            return MemoryOperationResult(
                operation_type="create",
                success=False,
                error_message=str(e)
            )

    async def _rewrite_session_note(
        self,
        lore_entry_content: str,
        current_session_note: str,
        update_summary: str,
        user_settings: Dict[str, Any]
    ) -> str:
        """Rewrite session note with new update using LLM"""
        try:
            # Extract rewrite LLM configuration
            rewrite_provider = user_settings.get('analysis_llm_provider', 'openrouter')
            rewrite_model = user_settings.get('analysis_llm_model_new') or user_settings.get('analysis_llm_model', 'mistral-large-latest')
            rewrite_api_key = user_settings.get('analysis_llm_api_key_new') or user_settings.get('analysis_llm_api_key')
            
            prompt = f"""You are a story continuity editor. Your task is to update session notes based on new events.

[Base LoreEntry]: {lore_entry_content}
[Current Session Note]: {current_session_note if current_session_note else "No previous session notes."}
[New Event]: {update_summary}

Task: Rewrite the complete Session Note incorporating the new event.
- Keep existing true information
- Integrate new event naturally  
- Maintain narrative consistency
- Respond ONLY with the complete rewritten note

New Session Note:"""

            response = await self.litellm_service.get_completion(
                provider=rewrite_provider,
                model=rewrite_model,
                messages=[{"role": "user", "content": prompt}],
                api_key=rewrite_api_key,
                max_tokens=1000,
                temperature=0.7
            )
            
            content = response.get('choices', [{}])[0].get('message', {}).get('content', '')
            return content.strip() if content else f"{current_session_note}\n\n[Update]: {update_summary}"
            
        except Exception as e:
            logger.error(f"Error rewriting session note: {e}")
            return f"{current_session_note}\n\n[Update]: {update_summary}"  # Fallback

    async def _generate_lore_entry_data(
        self,
        creation_summary: str,
        entity_type: str,
        user_settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate LoreEntry data using LLM"""
        try:
            # Extract creation LLM configuration
            creation_provider = user_settings.get('analysis_llm_provider', 'openrouter')
            creation_model = user_settings.get('analysis_llm_model_new') or user_settings.get('analysis_llm_model', 'mistral-large-latest')
            creation_api_key = user_settings.get('analysis_llm_api_key_new') or user_settings.get('analysis_llm_api_key')
            
            prompt = f"""You are a world-building assistant. Create a LoreEntry for a new story element.

[Creation Summary]: {creation_summary}
[Entity Type]: {entity_type}

Task: Generate a JSON object with:
- name: Entity name (short, clear)
- description: Detailed third-person description
- tags: Array of relevant keywords

Response (JSON only):"""

            response = await self.litellm_service.get_completion(
                provider=creation_provider,
                model=creation_model,
                messages=[{"role": "user", "content": prompt}],
                api_key=creation_api_key,
                max_tokens=800,
                temperature=0.5
            )
            
            # Parse JSON response
            content = response.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            import json
            import re
            
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            else:
                logger.error(f"Could not parse LoreEntry JSON: {content}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating LoreEntry data: {e}")
            return None

    async def _update_faiss_for_entity(
        self,
        db: Session,
        lore_entry_id: str,
        session_id: str,
        user_settings: Dict[str, Any]
    ) -> bool:
        """Update FAISS index with composite document for entity"""
        try:
            # Get LoreEntry
            lore_entry = db.query(LoreEntry).filter(LoreEntry.id == lore_entry_id).first()
            if not lore_entry:
                logger.error(f"LoreEntry {lore_entry_id} not found for FAISS update")
                return False
            
            # Get SessionNote for this entity in this session
            session_note = self.session_note_service.get_session_note_for_lore_entry(
                db=db,
                session_id=session_id,
                lore_entry_id=lore_entry_id
            )
            
            # Create composite document
            composite_doc = await self.composite_document_service.create_composite_document(
                db=db,
                lore_entry_id=lore_entry_id,
                session_id=session_id
            )
            
            if composite_doc:
                # Generate embedding for composite document
                embedding = await self.composite_document_service.generate_composite_embedding(
                    composite_doc=composite_doc,
                    user_settings=user_settings
                )
                
                if embedding is not None:
                    # Update FAISS index
                    await self.faiss_index.update_embedding(
                        item_id=lore_entry_id,
                        new_embedding=embedding.tolist(),
                        item_type="lore_entry"
                    )
                    
                    # Cache the composite document for RAG
                    self.faiss_index.cache_composite_document(lore_entry_id, composite_doc.composite_text)
                    
                    logger.info(f"[FAISS] Updated composite document for entity {lore_entry.name}")
                    return True
                else:
                    logger.error(f"[FAISS] Failed to generate embedding for composite document")
                    return False
            else:
                logger.error(f"[FAISS] Failed to create composite document")
                return False
                
        except Exception as e:
            logger.error(f"Error updating FAISS for entity {lore_entry_id}: {e}")
            return False

    async def _validate_and_retry_analysis(
        self,
        analysis_result: EnhancedAnalysisResult,
        db: Session,
        turn_context: Dict[str, Any],
        user_settings: Dict[str, Any],
        master_world_id: str,
        max_retries: int = 2
    ) -> EnhancedAnalysisResult:
        """Validate analysis result and retry if needed"""
        validation_result = self.validation_service.validate_analysis_result(analysis_result)
        
        if validation_result.is_valid:
            return analysis_result
        
        # Log validation issues
        for error in validation_result.errors:
            logger.warning(f"[AnalysisValidation] {error.error_type}: {error.message}")
        
        # For now, return original result even if validation fails
        # In production, you could implement retry logic here
        return analysis_result

    async def _handle_transaction_rollback(
        self,
        db: Session,
        operation_results: List[MemoryOperationResult],
        error_message: str
    ) -> SynchronousMemoryResult:
        """Handle transaction rollback with detailed error reporting"""
        try:
            db.rollback()
            logger.error(f"[SynchronousMemory] Transaction rolled back: {error_message}")
            
            # Count successful operations before rollback
            successful_count = sum(1 for result in operation_results if result.success)
            
            return SynchronousMemoryResult(
                success=False,
                total_operations=len(operation_results),
                successful_operations=0,  # All rolled back
                failed_operations=len(operation_results),
                operation_results=operation_results,
                error_message=f"Transaction rollback: {error_message}"
            )
            
        except Exception as rollback_error:
            logger.error(f"[SynchronousMemory] Error during rollback: {rollback_error}")
            return SynchronousMemoryResult(
                success=False,
                error_message=f"Critical error during rollback: {rollback_error}"
            )

    def _create_fallback_lore_entry_data(
        self,
        creation: EntityCreation
    ) -> Dict[str, Any]:
        """Create fallback LoreEntry data when LLM generation fails"""
        # Extract name from creation summary
        import re
        
        # Try to find a name in quotes or after "named"
        name_match = re.search(r"(?:named|called)\s+['\"]?([^'\"]+)['\"]?", creation.creation_summary, re.IGNORECASE)
        if name_match:
            name = name_match.group(1).strip()
        else:
            # Use entity type + "Entity" as fallback
            name = f"New {creation.entity_type.title()}"
        
        return {
            "name": name,
            "description": creation.creation_summary,
            "tags": [creation.entity_type.lower(), "dynamically_created"]
        }

    async def _batch_update_faiss_entities(
        self,
        db: Session,
        session_id: str,
        user_settings: Dict[str, Any],
        updated_entity_ids: List[str]
    ) -> Dict[str, bool]:
        """
        Phase 4: Batch update FAISS entities for better performance.
        
        This method replaces individual FAISS updates with batch processing.
        """
        if not updated_entity_ids:
            return {}
        
        logger.info(f"[Phase4] Starting batch FAISS update for {len(updated_entity_ids)} entities")
        
        try:
            # Use the enhanced composite document service for batch updates
            batch_results = await self.composite_document_service.batch_update_faiss_entities(
                db=db,
                lore_entry_ids=updated_entity_ids,
                session_id=session_id,
                user_settings=user_settings
            )
            
            successful_count = sum(1 for success in batch_results.values() if success)
            logger.info(f"[Phase4] Batch FAISS update: {successful_count}/{len(updated_entity_ids)} successful")
            
            return batch_results
            
        except Exception as e:
            logger.error(f"[Phase4] Batch FAISS update failed: {e}")
            return {entity_id: False for entity_id in updated_entity_ids}

    async def optimize_memory_performance(self, db: Session) -> Dict[str, Any]:
        """
        Phase 4: Run memory system optimization and performance analysis.
        
        Includes:
        - FAISS index optimization
        - Cache performance analysis
        - Memory usage statistics
        """
        logger.info("[Phase4] Starting memory system optimization")
        
        try:
            # Run FAISS optimization
            faiss_optimization = await self.composite_document_service.optimize_faiss_index(db)
            
            # Get cache statistics
            cache_stats = self.composite_document_service.get_cache_stats()
            
            # Get validation service statistics
            validation_stats = self.validation_service.get_performance_stats()
            
            optimization_result = {
                'success': True,
                'faiss_optimization': faiss_optimization,
                'cache_performance': cache_stats,
                'validation_performance': validation_stats,
                'optimization_timestamp': time.time()
            }
            
            logger.info("[Phase4] Memory system optimization completed")
            return optimization_result
            
        except Exception as e:
            logger.error(f"[Phase4] Memory optimization failed: {e}")
            return {
                'success': False,
                'error_message': str(e)
            }

# Global validation service instance
validation_service = ValidationService()
