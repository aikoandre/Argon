from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class TriggerCondition(BaseModel):
    type: str = Field(..., description="Type of trigger condition (e.g., 'location_reached', 'relationship_status', 'item_possessed', 'previous_event_phase_completed', 'dialogue_keyword')")
    location_id: Optional[str] = Field(None, description="ID of the LoreEntry for location_reached type")
    target_entity_id: Optional[str] = Field(None, description="ID of the NPC/entity for relationship_status type")
    dimension: Optional[str] = Field(None, description="Dimension of relationship (e.g., 'trust_score')")
    operator: Optional[str] = Field(None, description="Comparison operator (e.g., '<', '>', '=', '>=', '<=')")
    value: Optional[Any] = Field(None, description="Value to compare against for relationship_status or other types")
    item_name: Optional[str] = Field(None, description="Name of the item for item_possessed type")
    event_id: Optional[str] = Field(None, description="ID of the previous event for previous_event_phase_completed type")
    phase_id: Optional[str] = Field(None, description="ID of the phase for previous_event_phase_completed type")
    keywords: Optional[List[str]] = Field(None, description="List of keywords for dialogue_keyword type")
    # Add other specific fields as needed for future trigger types

class Phase(BaseModel):
    phase_id: str = Field(..., description="Unique ID or name for the event phase")
    phase_description_for_llms: str = Field(..., description="Description of how this phase should influence the world or AI behavior for LLMs")
    phase_effects_on_start: Optional[Dict[str, Any]] = Field(None, description="Immediate changes to session state upon starting this phase (e.g., SessionCacheFacts update, SessionLoreModification suggestion)")
    phase_completion_conditions: List[TriggerCondition] = Field([], description="Conditions that, when met, finalize this phase and can lead to the next")

class EventOutcome(BaseModel):
    outcome_id: str = Field(..., description="Unique ID for the event outcome")
    outcome_description: str = Field(..., description="Description of the outcome")
    effects: Optional[Dict[str, Any]] = Field(None, description="Effects of this outcome on the session state or future narrative")

class FixedEventData(BaseModel):
    event_name: str = Field(..., description="A name for the event (e.g., 'The Ambush in the Dark Forest')")
    event_description: str = Field(..., description="A summary of what the event is about")
    trigger_conditions: List[TriggerCondition] = Field(..., description="Structured rules that, when satisfied, initiate the event")
    phases: List[Phase] = Field(..., description="Multiple phases of the event, each with its own description and completion conditions")
    event_outcomes: Optional[List[EventOutcome]] = Field(None, description="Different possible resolutions for the event, depending on player choices during phases")