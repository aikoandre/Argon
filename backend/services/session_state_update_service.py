from typing import List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
import logging

from schemas.ai_analysis_result import InteractionAnalysisResult, NewFact, RelationshipChange, SessionLoreUpdate, UserPersonaSessionUpdate, DynamicallyGeneratedLoreEntry, SuggestedDynamicEvent
from backend.db import crud
from services.event_manager_service import EventManagerService
from services.session_lore_service import SessionLoreService
from services.embedding_service import EmbeddingService
from services.faiss_service import FAISSIndex

logger = logging.getLogger(__name__)

class SessionStateUpdateService:
    def __init__(
        self,
        event_manager_service: EventManagerService,
        session_lore_service: SessionLoreService,
        embedding_service: EmbeddingService,
        faiss_service: FAISSIndex
    ):
        self.event_manager_service = event_manager_service
        self.session_lore_service = session_lore_service
        self.embedding_service = embedding_service
        self.faiss_service = faiss_service

    async def apply_analysis_results(
        self,
        db: Session,
        chat_session_id: UUID,
        analysis_result: InteractionAnalysisResult
    ):
        """
        Applies the structured updates from InteractionAnalysisResult to the session's global state.
        """
        # Get API key from user settings for embedding operations
        from models.user_settings import UserSettings as UserSettingsModel
        user_settings = db.query(UserSettingsModel).first()
        mistral_api_key = user_settings.mistral_api_key if user_settings else None

        if not mistral_api_key:
            logger.warning("Mistral API key not found. Embedding operations will be skipped.")

        # --- Phase 3: Synchronous Memory Pipeline with LLM Integration ---
        from services.session_note_service import SessionNoteService
        session_note_service = SessionNoteService()
        from models.lore_entry import LoreEntry
        from models.chat_session import ChatSession
        from services.unified_llm_service import get_llm_service
        unified_llm_service = get_llm_service()

        # 0. Handle SessionNote updates (entity matching by description)
        updates = getattr(analysis_result, "updates", None)
        if updates:
            chat_session = db.query(ChatSession).filter(ChatSession.id == str(chat_session_id)).first()
            for upd in updates:
                entity_desc = getattr(upd, "entity_description", None)
                update_summary = getattr(upd, "update_summary", None)
                if not entity_desc or not update_summary:
                    continue
                # Naive entity matching: try exact name match, fallback to first similar
                lore_entry = db.query(LoreEntry).filter(LoreEntry.title.ilike(f"%{entity_desc}%")).first()
                if not lore_entry:
                    # TODO: Replace with semantic similarity search
                    lore_entry = db.query(LoreEntry).first()
                if not lore_entry:
                    logger.warning(f"No LoreEntry found for update entity description: {entity_desc}")
                    continue
                # Find or create SessionNote for this LoreEntry and session
                from schemas.session_note import SessionNoteCreate, SessionNoteUpdate
                existing_note = db.query(SessionNote).filter(
                    SessionNote.session_id == str(chat_session_id),
                    SessionNote.lore_entry_id == lore_entry.id
                ).first()
                # Get base lore content and current note
                base_lore = lore_entry.description or ""
                current_note = existing_note.note_content if existing_note else ""
                # Use LLM to rewrite SessionNote
                llm_result = await unified_llm_service.update_note(
                    entity_id=str(lore_entry.id),
                    current_content=current_note,
                    update_summary=update_summary,
                    context=base_lore
                )
                new_note_content = llm_result.get("content", update_summary).strip() if llm_result.get("success") else update_summary
                if existing_note:
                    update_data = SessionNoteUpdate(
                        note_content=new_note_content
                    )
                    session_note_service.update_session_note(
                        db, existing_note.id, update_data
                    )
                    note_id = existing_note.id
                else:
                    note_data = SessionNoteCreate(
                        session_id=str(chat_session_id),
                        lore_entry_id=lore_entry.id,
                        note_content=new_note_content
                    )
                    result = session_note_service.create_session_note(db, note_data)
                    note_id = result.session_note_id if result.success else None
                # Composite document generation and embedding
                if note_id and lore_entry.description and mistral_api_key:
                    composite_doc = f"[Base Lore]\n{lore_entry.description}\n\n[Session Notes]\n{new_note_content}"
                    embedding = await self.embedding_service.create_embedding(composite_doc, mistral_api_key)
                    lore_entry.embedding_vector = embedding
                    db.add(lore_entry)
                    db.commit()
                    db.refresh(lore_entry)
                    await self.faiss_service.add_lore_entry_to_index(lore_entry)

        # 0b. Handle SessionNote creations (new entities)
        creations = getattr(analysis_result, "creations", None)
        if creations:
            chat_session = db.query(ChatSession).filter(ChatSession.id == str(chat_session_id)).first()
            master_world_id = getattr(chat_session, 'master_world_id', None)
            for cr in creations:
                entity_type = getattr(cr, "entity_type", None)
                creation_summary = getattr(cr, "creation_summary", None)
                if not entity_type or not creation_summary or not master_world_id:
                    continue
                # Create new LoreEntry
                from schemas.lore_entry import LoreEntryCreate
                lore_entry_data = {
                    "title": creation_summary.split("named '")[-1].split("'")[0] if "named '" in creation_summary else creation_summary[:32],
                    "description": creation_summary,
                    "entry_type": entity_type.upper(),
                    "master_world_id": master_world_id,
                    "is_dynamically_generated": True
                }
                lore_entry = crud.create_lore_entry(db, lore_entry_data)
                # Create initial SessionNote (empty, but can be enhanced with LLM if needed)
                from schemas.session_note import SessionNoteCreate
                note_data = SessionNoteCreate(
                    session_id=str(chat_session_id),
                    lore_entry_id=lore_entry.id,
                    note_content=""
                )
                result = session_note_service.create_session_note(db, note_data)
                note_id = result.session_note_id if result.success else None
                # Composite document generation and embedding
                if note_id and lore_entry.description and mistral_api_key:
                    composite_doc = f"[Base Lore]\n{lore_entry.description}\n\n[Session Notes]\n"
                    embedding = await self.embedding_service.create_embedding(composite_doc, mistral_api_key)
                    lore_entry.embedding_vector = embedding
                    db.add(lore_entry)
                    db.commit()
                    db.refresh(lore_entry)
                    await self.faiss_service.add_lore_entry_to_index(lore_entry)

        # 1. Update SessionCacheFacts
        if analysis_result.new_facts_established:
            for fact in analysis_result.new_facts_established:
                # Create new fact entry using the text as the main content
                crud.create_or_update_session_cache_fact(
                    db,
                    chat_session_id=str(chat_session_id),
                    text=fact.text,
                    relevance_score=fact.relevance_score,
                    tags=fact.tags
                )

        # 2. Update SessionRelationships
        if analysis_result.relationship_changes:
            for change in analysis_result.relationship_changes:
                # Extract entity information from the change
                entity1_name = change.between_entities[0]
                entity2_name = change.between_entities[1]
                
                # Determine entity types and IDs (assuming names are the entity IDs for now)
                # TODO: Enhance this logic to properly resolve entity types based on context
                entity1_id = entity1_name
                entity1_type = "character_card"  # Default assumption
                entity2_id = entity2_name  
                entity2_type = "character_card"  # Default assumption
                
                # Try to retrieve existing relationship
                existing_relationship = crud.get_session_relationship_by_entity_ids(
                    db=db,
                    chat_session_id=str(chat_session_id),
                    entity1_id=entity1_id,
                    entity1_type=entity1_type,
                    entity2_id=entity2_id,
                    entity2_type=entity2_type
                )
                
                if existing_relationship:
                    # Update existing relationship
                    update_data = {}
                    
                    # Map dimension changes to database fields
                    if change.dimension_changed == "trust_score":
                        # Parse change_value to extract numeric change
                        new_value = self._parse_relationship_change_value(
                            existing_relationship.trust_score, change.change_value
                        )
                        update_data["trust_score"] = new_value
                    elif change.dimension_changed == "affection_score":
                        new_value = self._parse_relationship_change_value(
                            existing_relationship.affection_score, change.change_value
                        )
                        update_data["affection_score"] = new_value
                    elif change.dimension_changed == "rivalry_score":
                        new_value = self._parse_relationship_change_value(
                            existing_relationship.rivalry_score, change.change_value
                        )
                        update_data["rivalry_score"] = new_value
                    
                    # Handle status tag changes
                    if change.new_status_tags_add or change.new_status_tags_remove:
                        current_tags = set(existing_relationship.status_tags or [])
                        if change.new_status_tags_add:
                            current_tags.update(change.new_status_tags_add)
                        if change.new_status_tags_remove:
                            current_tags.difference_update(change.new_status_tags_remove)
                        update_data["status_tags"] = list(current_tags)
                    
                    # Apply the update if there are changes
                    if update_data:
                        from schemas.session_relationship import SessionRelationshipUpdate
                        relationship_update = SessionRelationshipUpdate(**update_data)
                        crud.update_session_relationship(
                            db=db,
                            db_relationship=existing_relationship,
                            relationship_update=relationship_update
                        )
                else:
                    # Create new relationship if it doesn't exist
                    # Initialize with default values and apply the change
                    initial_scores = {"trust_score": 0, "affection_score": 0, "rivalry_score": 0}
                    
                    if change.dimension_changed == "trust_score":
                        initial_scores["trust_score"] = self._parse_relationship_change_value(0, change.change_value)
                    elif change.dimension_changed == "affection_score":
                        initial_scores["affection_score"] = self._parse_relationship_change_value(0, change.change_value)
                    elif change.dimension_changed == "rivalry_score":
                        initial_scores["rivalry_score"] = self._parse_relationship_change_value(0, change.change_value)
                    
                    status_tags = list(change.new_status_tags_add) if change.new_status_tags_add else []
                    
                    from schemas.session_relationship import SessionRelationshipCreate
                    new_relationship = SessionRelationshipCreate(
                        chat_session_id=str(chat_session_id),
                        entity1_id=entity1_id,
                        entity1_type=entity1_type,
                        entity2_id=entity2_id,
                        entity2_type=entity2_type,
                        trust_score=initial_scores["trust_score"],
                        affection_score=initial_scores["affection_score"],
                        rivalry_score=initial_scores["rivalry_score"],
                        status_tags=status_tags
                    )
                    crud.create_session_relationship(db=db, relationship=new_relationship)

        # 3. Create/Update SessionLoreModifications and route others to SessionCacheFacts
        if analysis_result.session_lore_updates:
            # --- Begin refactor for correct lore/fact routing ---
            from models.lore_entry import LoreEntry
            from models.chat_session import ChatSession
            
            chat_session = db.query(ChatSession).filter(ChatSession.id == str(chat_session_id)).first()
            master_world_id = getattr(chat_session, 'master_world_id', None)
            valid_lore_updates = []
            volatile_lore_updates = []

            for update in analysis_result.session_lore_updates:
                # Check if session has a MasterWorld and if the lore entry is part of it
                lore_entry = db.query(LoreEntry).filter(LoreEntry.id == update.base_lore_entry_id).first()
                if master_world_id and lore_entry and getattr(lore_entry, 'master_world_id', None) == master_world_id:
                    valid_lore_updates.append(update)
                else:
                    volatile_lore_updates.append(update)

            # Only persistent, narratively significant changes with MasterWorld linkage go to SessionLoreModifications
            if valid_lore_updates:
                self.session_lore_service.apply_session_lore_updates(
                    db, str(chat_session_id), valid_lore_updates
                )
            # All others (volatile, contextual, or not linked to MasterWorld) go to SessionCacheFacts
            for update in volatile_lore_updates:
                # Store as a SessionCacheFact with a tag for traceability
                crud.create_or_update_session_cache_fact(
                    db,
                    chat_session_id=str(chat_session_id),
                    text=f"[LORE-UPDATE-FACT] {update.field_to_update}: {update.new_content_segment}",
                    tags=["volatile_lore_update", "auto_routed"]
                )
            # --- End refactor for correct lore/fact routing ---

        # 4. Update UserPersona specific to the session
        if analysis_result.user_persona_session_updates:
            # First, get the user_persona_id from the chat session
            from models.chat_session import ChatSession
            chat_session = db.query(ChatSession).filter(ChatSession.id == str(chat_session_id)).first()
            if not chat_session or not chat_session.user_persona_id:
                # Log warning but don't fail - some sessions might not have an assigned user persona
                print(f"Warning: No user persona assigned to chat session {chat_session_id}. Skipping user persona session updates.")
            else:
                user_persona_id = chat_session.user_persona_id
                for update in analysis_result.user_persona_session_updates:
                    # Call with the required user_persona_id parameter
                    crud.update_user_persona_session_attribute(
                        db,
                        chat_session_id=str(chat_session_id),
                        user_persona_id=user_persona_id,
                        attribute=update.attribute,
                        new_value=update.new_value,
                        reason=update.reason
                    )

        # 5. Process triggered_event_ids and update ActiveSessionEvents
        if analysis_result.triggered_event_ids_candidates:
            for event_id in analysis_result.triggered_event_ids_candidates:
                await self.event_manager_service.trigger_event(db, chat_session_id, event_id)

        if analysis_result.suggested_dynamic_event:
            # Handle dynamically suggested event, e.g., create a new event card or trigger a generic event
            await self.event_manager_service.create_and_trigger_dynamic_event(
                db,
                chat_session_id,
                analysis_result.suggested_dynamic_event
            )

        # 6. Handle creation of dynamic LoreEntries (NPCs, Locations, Items, etc.)
        if analysis_result.dynamically_generated_lore_entries:
            # Retrieve the master_world_id from the chat_session
            chat_session = crud.get_chat_session(db, chat_session_id)
            if not chat_session or not chat_session.master_world_id:
                # Log an error or raise an exception if master_world_id is not found
                print(f"Error: MasterWorld ID not found for chat session {chat_session_id}. Cannot create dynamic lore entry.")
                return

            for entry_data in analysis_result.dynamically_generated_lore_entries:
                # Create the LoreEntry in the database
                lore_entry_dict = entry_data.model_dump()
                lore_entry_dict["master_world_id"] = chat_session.master_world_id
                new_lore_entry = crud.create_lore_entry(db, lore_entry_dict)
                
                # Re-embed and update FAISS index for the new entry
                if new_lore_entry.description and mistral_api_key:
                    embedding = await self.embedding_service.create_embedding(new_lore_entry.description, mistral_api_key)
                    new_lore_entry.embedding_vector = embedding
                    db.add(new_lore_entry)
                    db.commit()
                    db.refresh(new_lore_entry)
                    
                    # Add to FAISS index
                    await self.faiss_service.add_lore_entry_to_index(new_lore_entry)

        # 7. Handle panel_data_update (persist as SessionCacheFacts for consistency)
        if analysis_result.panel_data_update:
            panel_data = analysis_result.panel_data_update
            
            # Store panel data as key-value pairs in SessionCacheFacts
            if panel_data.current_time:
                crud.create_or_update_session_cache_fact(
                    db,
                    chat_session_id=str(chat_session_id),
                    key="current_time",
                    value=panel_data.current_time,
                    text=f"Current time: {panel_data.current_time}",
                    tags=["panel_data", "time"]
                )
            
            if panel_data.current_date:
                crud.create_or_update_session_cache_fact(
                    db,
                    chat_session_id=str(chat_session_id),
                    key="current_date",
                    value=panel_data.current_date,
                    text=f"Current date: {panel_data.current_date}",
                    tags=["panel_data", "date"]
                )
            
            if panel_data.current_location:
                crud.create_or_update_session_cache_fact(
                    db,
                    chat_session_id=str(chat_session_id),
                    key="current_location",
                    value=panel_data.current_location,
                    text=f"Current location: {panel_data.current_location}",
                    tags=["panel_data", "location"]
                )
    
        # 8. Embed and store dynamic memories in FAISS as 'extracted_knowledge'
        if analysis_result.dynamic_memories_to_index:
            for memory_text in analysis_result.dynamic_memories_to_index:
                try:
                    if mistral_api_key:
                        embedding = await self.embedding_service.create_embedding(memory_text, mistral_api_key)
                        import uuid
                        memory_id = str(uuid.uuid4())
                        # Persist to ExtractedKnowledge in DB first
                        # For now, we use the current chat_session_id and the latest message as source_message_id
                        # (In production, pass the correct message ID from context)
                        from models.chat_message import ChatMessage
                        last_message = db.query(ChatMessage).filter(ChatMessage.chat_session_id == str(chat_session_id)).order_by(ChatMessage.timestamp.desc()).first()
                        source_message_id = str(last_message.id) if last_message else str(uuid.uuid4())
                        ek = crud.create_extracted_knowledge(
                            db,
                            chat_session_id=str(chat_session_id),
                            source_message_id=source_message_id,
                            extracted_content={"text": memory_text},
                            embedding_vector=embedding
                        )
                        # Add to FAISS index after DB commit
                        if hasattr(self.faiss_service, 'add_embedding') and callable(getattr(self.faiss_service, 'add_embedding')):
                            await self.faiss_service.add_embedding(str(ek.id), embedding, item_type='extracted_knowledge')
                        else:
                            import asyncio
                            await asyncio.to_thread(self.faiss_service.add_vectors, [embedding], [{
                                'type': 'extracted_knowledge',
                                'session_id': str(chat_session_id),
                                'memory_id': str(ek.id),
                                'content': memory_text
                            }])
                    else:
                        logger.warning(f"Skipping embedding for dynamic memory due to missing API key: {memory_text[:50]}...")
                except Exception as e:
                    logger.error(f"Error embedding/storing dynamic memory: {e}")

    def _parse_relationship_change_value(self, current_value: int, change_description: str) -> int:
        """
        Parse a relationship change description and return the new value.
        
        Args:
            current_value: Current value of the relationship metric
            change_description: Description like '+15', '-5', 'significant_increase', 'slight_decrease'
            
        Returns:
            New value after applying the change
        """
        change_description = change_description.strip().lower()
        
        # Handle explicit numeric changes
        if change_description.startswith('+'):
            try:
                change_amount = int(change_description[1:])
                return max(-100, min(100, current_value + change_amount))
            except ValueError:
                pass
        elif change_description.startswith('-'):
            try:
                change_amount = int(change_description[1:])
                return max(-100, min(100, current_value - change_amount))
            except ValueError:
                pass
        elif change_description.isdigit() or (change_description.startswith('-') and change_description[1:].isdigit()):
            try:
                new_value = int(change_description)
                return max(-100, min(100, new_value))
            except ValueError:
                pass
        
        # Handle descriptive changes
        if 'significant' in change_description:
            if 'increase' in change_description or 'positive' in change_description:
                return max(-100, min(100, current_value + 25))
            elif 'decrease' in change_description or 'negative' in change_description:
                return max(-100, min(100, current_value - 25))
        elif 'moderate' in change_description:
            if 'increase' in change_description or 'positive' in change_description:
                return max(-100, min(100, current_value + 15))
            elif 'decrease' in change_description or 'negative' in change_description:
                return max(-100, min(100, current_value - 15))
        elif 'slight' in change_description or 'small' in change_description:
            if 'increase' in change_description or 'positive' in change_description:
                return max(-100, min(100, current_value + 5))
            elif 'decrease' in change_description or 'negative' in change_description:
                return max(-100, min(100, current_value - 5))
        elif 'major' in change_description or 'dramatic' in change_description:
            if 'increase' in change_description or 'positive' in change_description:
                return max(-100, min(100, current_value + 40))
            elif 'decrease' in change_description or 'negative' in change_description:
                return max(-100, min(100, current_value - 40))
        
        # Default fallback - no change
        return current_value