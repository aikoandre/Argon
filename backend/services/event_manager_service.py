from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.models.lore_entry import LoreEntry
from backend.models.chat_session import ChatSession
from backend.models.session_relationship import SessionRelationship
from backend.models.active_session_event import ActiveSessionEvent
# Removed SessionCacheFact and SessionLoreModification - replaced by SessionNote system
from backend.schemas.event import TriggerCondition, Phase, FixedEventData, EventOutcome
from backend.schemas.active_session_event import ActiveSessionEventCreate, ActiveSessionEventUpdate
import logging
import uuid

logger = logging.getLogger(__name__)

class EventManagerService:
    def __init__(self):
        pass # DB session will be passed per method call

    async def _evaluate_condition(self, db: Session, condition: TriggerCondition, session_state: Dict[str, Any]) -> bool:
        """Evaluates a single trigger condition against the current session state."""
        condition_type = condition.type

        if condition_type == "location_reached":
            current_location_id = session_state.get("current_location_id")
            return current_location_id == condition.location_id
        elif condition_type == "relationship_status":
            target_entity_id = condition.target_entity_id
            dimension = condition.dimension
            operator = condition.operator
            value = condition.value

            if not all([target_entity_id, dimension, operator, value is not None]):
                logger.warning(f"Incomplete relationship_status condition: {condition}")
                return False

            relationships = session_state.get("relationships", {})
            target_relationship = relationships.get(target_entity_id, {})
            actual_value = target_relationship.get(dimension)

            if actual_value is None:
                return False

            try:
                actual_value = float(actual_value)
                value = float(value)
                if operator == "<":
                    return actual_value < value
                elif operator == ">":
                    return actual_value > value
                elif operator == "=":
                    return actual_value == value
                elif operator == ">=":
                    return actual_value >= value
                elif operator == "<=":
                    return actual_value <= value
                else:
                    logger.warning(f"Unknown operator: {operator}")
                    return False
            except (ValueError, TypeError):
                logger.error(f"Invalid values for relationship comparison: actual={actual_value}, expected={value}")
                return False
        elif condition_type == "item_possessed":
            possessed_items = session_state.get("possessed_items", [])
            return condition.item_name in possessed_items
        elif condition_type == "previous_event_phase_completed":
            active_events = session_state.get("active_events", [])
            for event in active_events:
                if event.event_id == condition.event_id and event.current_phase_id == condition.phase_id and event.status == "completed":
                    return True
            return False
        elif condition_type == "dialogue_keyword":
            dialogue_text = session_state.get("last_dialogue_text", "").lower()
            keywords = [kw.lower() for kw in condition.keywords or []]
            return any(kw in dialogue_text for kw in keywords)
        # Add more condition types as needed
        else:
            logger.warning(f"Unsupported trigger condition type: {condition_type}")
            return False

    async def evaluate_trigger_conditions(self, db: Session, conditions: List[TriggerCondition], session_state: Dict[str, Any]) -> bool:
        """Evaluates a list of trigger conditions (AND logic)."""
        if not conditions:
            return False # No conditions means no trigger

        for condition in conditions:
            if not await self._evaluate_condition(db, condition, session_state):
                return False # All conditions must be true
        return True

    async def _get_session_state_for_evaluation(self, db: Session, session_id: str) -> Dict[str, Any]:
        """Gathers relevant session state data for trigger evaluation."""
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            logger.error(f"Session {session_id} not found.")
            return {}

        # TODO: Replace with SessionNote system
        # Temporarily returning minimal session state
        session_facts = {}

        # Fetch SessionRelationships (still available)
        relationships_raw = db.query(SessionRelationship).filter(SessionRelationship.chat_session_id == session_id).all()
        session_relationships = {}
        for rel in relationships_raw:
            # Create a relationship key that combines both entities
            rel_key = f"{rel.entity1_id}_{rel.entity2_id}"
            session_relationships[rel_key] = {
                "entity1_id": rel.entity1_id,
                "entity1_type": rel.entity1_type,
                "entity2_id": rel.entity2_id,
                "entity2_type": rel.entity2_type,
                "trust_score": rel.trust_score,
                "affection_score": rel.affection_score,
                "rivalry_score": rel.rivalry_score,
                "status_tags": rel.status_tags if rel.status_tags else []
            }

        # Fetch ActiveSessionEvents
        active_events = db.query(ActiveSessionEvent).filter(ActiveSessionEvent.session_id == session_id).all()

        return {
            "session_facts": session_facts,
            "relationships": session_relationships,
            "active_events": active_events,
            "current_location_id": session_facts.get("current_location_id"), # Example
            "possessed_items": session_facts.get("possessed_items", []), # Example
            "last_dialogue_text": session_facts.get("last_dialogue_text", ""), # Example
        }

    async def trigger_event(self, db: Session, session_id: str, event_id: str):
        """
        Triggers a fixed event based on its ID.
        """
        session_state = await self._get_session_state_for_evaluation(db, session_id)

        lore_entry = db.query(LoreEntry).filter(
            LoreEntry.id == event_id,
            LoreEntry.entry_type == "FIXED_EVENT"
        ).first()

        if not lore_entry:
            logger.warning(f"Fixed Event LoreEntry {event_id} not found or is not of type FIXED_EVENT.")
            return

        event_data_dict = lore_entry.event_data
        if not event_data_dict:
            logger.warning(f"LoreEntry {lore_entry.id} is FIXED_EVENT but has no event_data.")
            return

        try:
            fixed_event_data = FixedEventData(**event_data_dict)
        except Exception as e:
            logger.error(f"Failed to parse FixedEventData for LoreEntry {lore_entry.id}: {e}")
            return

        # Check if event is already active
        existing_active_event = db.query(ActiveSessionEvent).filter(
            ActiveSessionEvent.session_id == session_id,
            ActiveSessionEvent.event_id == event_id
        ).first()

        if existing_active_event:
            # Event is already active, check for phase completion
            if existing_active_event.status == "active" and existing_active_event.current_phase_id:
                current_phase_obj: Optional[Phase] = None
                for p in fixed_event_data.phases:
                    if p.phase_id == existing_active_event.current_phase_id:
                        current_phase_obj = p
                        break

                if current_phase_obj and await self.evaluate_trigger_conditions(db, current_phase_obj.phase_completion_conditions, session_state):
                    # Advance to next phase or complete event
                    current_phase_index = fixed_event_data.phases.index(current_phase_obj)
                    next_phase_index = current_phase_index + 1

                    if next_phase_index < len(fixed_event_data.phases):
                        next_phase = fixed_event_data.phases[next_phase_index]
                        existing_active_event.current_phase_id = next_phase.phase_id
                        existing_active_event.status = "active"
                        # Apply PhaseEffectsOnStart for the new phase
                        if next_phase.phase_effects_on_start:
                            await self._apply_phase_effects(db, session_id, next_phase.phase_effects_on_start)
                        logger.info(f"Event {event_id} advanced to phase {next_phase.phase_id} for session {session_id}")
                    else:
                        # All phases completed, mark event as completed
                        existing_active_event.status = "completed"
                        existing_active_event.current_phase_id = None
                        logger.info(f"Event {event_id} completed for session {session_id}")
                        # Resolve event outcomes if defined
                        if fixed_event_data.event_outcomes:
                            await self._resolve_event_outcome(db, session_id, event_id, fixed_event_data.event_outcomes, session_state)
                    db.add(existing_active_event)
                    db.commit()
                    db.refresh(existing_active_event)
                else:
                    logger.debug(f"Event {event_id} phase {existing_active_event.current_phase_id} conditions not met or no current phase found.")
            else:
                logger.debug(f"Event {event_id} is active but not in a state to advance phases for session {session_id}.")
        else:
            # Event is not active, check initial trigger conditions
            if await self.evaluate_trigger_conditions(db, fixed_event_data.trigger_conditions, session_state):
                # Trigger the event
                first_phase = fixed_event_data.phases[0] if fixed_event_data.phases else None
                new_active_event = ActiveSessionEventCreate(
                    session_id=session_id,
                    event_id=event_id,
                    current_phase_id=first_phase.phase_id if first_phase else None,
                    status="active",
                    event_type="FIXED"
                )
                db_active_event = ActiveSessionEvent(**new_active_event.model_dump())
                db.add(db_active_event)
                db.commit()
                db.refresh(db_active_event)
                # Apply PhaseEffectsOnStart for the first phase
                if first_phase and first_phase.phase_effects_on_start:
                    await self._apply_phase_effects(db, session_id, first_phase.phase_effects_on_start)
                logger.info(f"Fixed Event {event_id} triggered for session {session_id}")
            else:
                logger.debug(f"Fixed Event {event_id} conditions not met for session {session_id}.")

    async def create_and_trigger_dynamic_event(self, db: Session, session_id: str, suggested_dynamic_event: Dict[str, Any]):
        """
        Creates and triggers a dynamic event suggested by the LLM.
        """
        if await self._accept_dynamic_event(suggested_dynamic_event):
            # Create a unique event ID (e.g., using UUID)
            event_id = str(uuid.uuid4())

            # Create the ActiveSessionEvent
            new_active_event = ActiveSessionEventCreate(
                session_id=session_id,
                event_id=event_id,
                current_phase_id=None,  # Dynamic events might not have pre-defined phases
                status="active",
                event_type="DYNAMIC",
                dynamic_event_data=suggested_dynamic_event  # Store the event details
            )
            db_active_event = ActiveSessionEvent(**new_active_event.model_dump())
            db.add(db_active_event)
            db.commit()
            db.refresh(db_active_event)

            logger.info(f"Dynamic Event {event_id} triggered for session {session_id}")
        else:
            logger.info(f"Suggested dynamic event was not accepted for session {session_id}.")

    async def _apply_phase_effects(self, db: Session, session_id: str, effects: Dict[str, Any]):
        """Applies immediate effects of a phase on the session state."""
        logger.info(f"Applying phase effects for session {session_id}: {effects}")
        
        # TODO: Replace with SessionNote system
        if "update_session_cache_fact" in effects:
            fact_key = effects["update_session_cache_fact"]["key"]
            fact_value = effects["update_session_cache_fact"]["value"]
            # Temporarily disabled - will be replaced by SessionNote system
            logger.info(f"Placeholder: Would update session fact {fact_key}={fact_value}")

        if "suggest_session_lore_modification" in effects:
            mod_data = effects["suggest_session_lore_modification"]
            # Temporarily disabled - will be replaced by SessionNote system
            logger.info(f"Placeholder: Would create lore modification for entry {mod_data.get('base_lore_entry_id')}")
            logger.info(f"Suggested SessionLoreModification for session {session_id}: {mod_data}")

    async def _resolve_event_outcome(self, db: Session, session_id: str, event_id: str, outcomes: List[EventOutcome], session_state: Dict[str, Any]):
        """
        Resolves the outcome of a completed fixed event based on session state.
        """
        logger.info(f"Resolving outcomes for event {event_id} in session {session_id}. Available outcomes: {len(outcomes)}")
        if outcomes:
            chosen_outcome = outcomes[0] # This logic needs to be refined
            logger.info(f"Applying effects of chosen outcome '{chosen_outcome.outcome_id}': {chosen_outcome.effects}")
            if chosen_outcome.effects:
                await self._apply_phase_effects(db, session_id, chosen_outcome.effects)
        else:
            logger.info(f"No specific outcomes defined for event {event_id}.")

    async def _accept_dynamic_event(self, dynamic_event: Dict[str, Any]) -> bool:
        """
        Logic to determine if a dynamic event suggested by the LLM should be accepted.
        """
        if "urgent" in dynamic_event.get("description", "").lower():
            logger.info(f"Dynamic event accepted due to 'urgent' keyword: {dynamic_event.get('description')}")
            return True
        return True