from pydantic import BaseModel, validator
from typing import List, Dict, Any

class AnalysisResultSchema(BaseModel):
    key_insights: List[str]
    emotional_tone: Dict[str, float]
    continuity_checks: List[Dict[str, Any]]
    relationship_updates: Dict[str, float]
    narrative_consistency: Dict[str, float]
    character_development: Dict[str, float]
    plot_development: Dict[str, float]
    potential_issues: List[str]
    suggested_actions: List[str]

    @validator('*', pre=True)
    def check_empty_fields(cls, v):
        if not v:
            raise ValueError("Field cannot be empty")
        return v
