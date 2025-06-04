from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID

class NewFact(BaseModel):
    text: str = Field(..., description="The extracted fact.")
    relevance_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Relevance score (0.0 to 1.0).")
    tags: Optional[List[str]] = Field(default_factory=list, description="List of relevant tags.")

class RelationshipChange(BaseModel):
    between_entities: List[str] = Field(..., min_length=2, max_length=2, description="IDs or names of the two entities in the relationship.")
    dimension_changed: str = Field(..., description="Name of the dimension changed (e.g., 'trust_score', 'affection_score', 'rivalry_score').")
    change_value: str = Field(..., description="Description of the change (e.g., '+15', '-5', 'aumento_significativo', 'ligeira_diminuicao').")
    new_status_tags_add: Optional[List[str]] = Field(default_factory=list, description="Optional: tags to be added to the relationship status.")
    new_status_tags_remove: Optional[List[str]] = Field(default_factory=list, description="Optional: tags to be removed from the relationship status.")
    reason_summary: Optional[str] = Field(None, description="Brief justification based on the interaction.")

class SessionLoreUpdate(BaseModel):
    base_lore_entry_id: str = Field(..., description="ID of the base LoreEntry being updated.")
    field_to_update: str = Field(..., description="The field of the LoreEntry to update (e.g., 'description', 'relationships_summary').")
    new_content_segment: str = Field(..., description="The new content segment for the specified field.")
    change_reason: Optional[str] = Field(None, description="Reason for the lore update.")

class UserPersonaSessionUpdate(BaseModel):
    attribute: str = Field(..., description="The attribute of the UserPersona to update (e.g., 'current_objective').")
    new_value: Any = Field(..., description="The new value for the attribute.")
    reason: Optional[str] = Field(None, description="Reason for the UserPersona update.")

class SuggestedDynamicEvent(BaseModel):
    description: str = Field(..., description="A description of the suggested dynamic event.")
    initial_impact: Optional[str] = Field(None, description="A summary of the immediate impact of the event.")
    suggested_goal_for_ai: Optional[str] = Field(None, description="A suggested goal for the AI to pursue once the event is triggered.")

class DynamicallyGeneratedLoreEntry(BaseModel):
    entry_type: str = Field(..., description="Type of the new LoreEntry (e.g., 'CHARACTER_LORE', 'LOCATION', 'ITEM', 'GROUP').")
    name: str = Field(..., description="Name of the dynamically generated LoreEntry.")
    description: Optional[str] = Field(None, description="Description of the new LoreEntry.")
    tags: Optional[List[str]] = Field(default_factory=list, description="Relevant tags for the new LoreEntry.")
    aliases: Optional[List[str]] = Field(default_factory=list, description="Aliases for the new LoreEntry.")
    # master_world_id will be added by the service based on the session's master world

class SessionCacheUpdate(BaseModel):
    """Updates to session cache facts (volatile session memory)"""
    text: str = Field(..., description="The session cache fact text.")
    key: Optional[str] = Field(None, description="Optional key for the session cache fact.")
    value: Optional[str] = Field(None, description="Optional value for the session cache fact.")
    relevance_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Relevance score (0.0 to 1.0).")
    tags: Optional[List[str]] = Field(default_factory=list, description="List of relevant tags for categorization.")

class InteractionAnalysisResult(BaseModel):
    # Full analysis fields (for comprehensive analysis)
    new_facts_established: Optional[List[NewFact]] = Field(default_factory=list, description="New facts established in the session.")
    relationship_changes: Optional[List[RelationshipChange]] = Field(default_factory=list, description="Changes in relationships between characters.")
    session_lore_updates: Optional[List[SessionLoreUpdate]] = Field(default_factory=list, description="Updates to LoreEntries specific to this session.")
    user_persona_session_updates: Optional[List[UserPersonaSessionUpdate]] = Field(default_factory=list, description="Updates to the UserPersona's state for this session.")
    triggered_event_ids_candidates: Optional[List[str]] = Field(default_factory=list, description="List of EventCard IDs whose conditions were met.")
    dynamically_generated_lore_entries: Optional[List[DynamicallyGeneratedLoreEntry]] = Field(default_factory=list, description="Details of dynamically generated LoreEntries (NPCs, Locations, Items, etc.).")
    suggested_dynamic_event: Optional[SuggestedDynamicEvent] = Field(None, description="Details of a dynamically suggested event by the LLM.")
    panel_data_update: Optional["PanelData"] = Field(None, description="Data to be displayed on the user's info panel.")
    session_cache_updates: Optional[List[SessionCacheUpdate]] = Field(default_factory=list, description="Updates to session cache facts (volatile session memory).")
    dynamic_memories_to_index: Optional[List[str]] = Field(default_factory=list, description="Important memories to be embedded and indexed for future retrieval.")

class PanelData(BaseModel):
    current_time: Optional[str] = Field(default=None, description="E.g., 'Morning', 'Afternoon Sun', '08:00'")
    current_date: Optional[str] = Field(default=None, description="E.g., 'Serpent Day, 3rd Spring Moon'")
    current_location: Optional[str] = Field(default=None, description="Location summary for the panel")