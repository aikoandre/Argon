# backend/services/enhanced_analysis_service.py
"""
Enhanced Analysis Service for SessionNotes system.

Provides analysis with entity-description matching for memory updates and new entity creation.
"""
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .litellm_service import litellm_service
from ..models.lore_entry import LoreEntry
from ..utils.reasoning_utils import is_reasoning_capable_model

logger = logging.getLogger(__name__)


class EntityUpdate(BaseModel):
    """Entity update information"""
    entity_description: str = Field(description="Description of the entity to update")
    update_summary: str = Field(description="Summary of what happened to this entity")


class EntityCreation(BaseModel):
    """New entity creation information"""
    entity_type: str = Field(description="Type of entity: CHARACTER, LOCATION, OBJECT, EVENT, CONCEPT")
    creation_summary: str = Field(description="Summary of the new entity and what it is")


class EnhancedAnalysisResult(BaseModel):
    """Result of enhanced analysis with entity operations"""
    updates: List[EntityUpdate] = Field(default_factory=list)
    creations: List[EntityCreation] = Field(default_factory=list)
    success: bool = True
    error_message: Optional[str] = None


class EnhancedAnalysisService:
    """Service for enhanced analysis with entity matching"""
    
    def __init__(self):
        self.litellm_service = litellm_service

    async def analyze_turn_for_memory_operations(
        self,
        db: Session,
        turn_context: Dict[str, Any],
        user_settings: Dict[str, Any],
        master_world_id: str,
        reasoning_mode: Optional[str] = None,
        reasoning_effort: Optional[str] = None
    ) -> EnhancedAnalysisResult:
        """
        Analyze a complete turn for memory operations.
        
        Returns both entity updates and new entity creations.
        """
        try:
            # Extract analysis LLM configuration
            analysis_provider = user_settings.get('analysis_llm_provider', 'openrouter')
            analysis_model = user_settings.get('analysis_llm_model_new') or user_settings.get('analysis_llm_model', 'mistral-large-latest')
            analysis_api_key = user_settings.get('analysis_llm_api_key_new') or user_settings.get('analysis_llm_api_key')
            
            # Get existing entities for context
            existing_entities = self._get_existing_entities_context(db, master_world_id)
            
            # Create enhanced analysis prompt
            prompt = self._create_enhanced_analysis_prompt(turn_context, existing_entities)
            
            # Configure reasoning if available
            reasoning_params = {}
            if is_reasoning_capable_model(analysis_model) and reasoning_mode:
                reasoning_params = {
                    "reasoning_mode": reasoning_mode,
                    "reasoning_effort": reasoning_effort or "medium"
                }
            
            # Call LLM for analysis
            response = await self.litellm_service.get_completion(
                messages=[{"role": "user", "content": prompt}],
                provider=analysis_provider,
                model=analysis_model,
                api_key=analysis_api_key,
                max_tokens=2000,
                temperature=0.3,
                **reasoning_params
            )
            
            # Parse the response
            content = response.get('choices', [{}])[0].get('message', {}).get('content', '')
            result = self._parse_analysis_response(content)
            logger.info(f"[EnhancedAnalysis] Found {len(result.updates)} updates and {len(result.creations)} creations")
            
            return result
            
        except Exception as e:
            logger.error(f"[EnhancedAnalysis][ERROR] {e}")
            return EnhancedAnalysisResult(
                success=False,
                error_message=str(e)
            )

    def _get_existing_entities_context(self, db: Session, master_world_id: str) -> str:
        """Get existing entities context for the analysis"""
        try:
            entities = db.query(LoreEntry).filter(
                LoreEntry.master_world_id == master_world_id
            ).limit(50).all()  # Limit to avoid token overflow
            
            entity_list = []
            for entity in entities:
                entity_list.append(f"- {entity.name} ({entity.entry_type}): {entity.description[:100]}...")
            
            return "\n".join(entity_list) if entity_list else "No existing entities found."
            
        except Exception as e:
            logger.error(f"Error getting existing entities context: {e}")
            return "Error retrieving existing entities."

    def _create_enhanced_analysis_prompt(self, turn_context: Dict[str, Any], existing_entities: str) -> str:
        """Create the enhanced analysis prompt"""
        user_message = turn_context.get('user_message', '')
        ai_response = turn_context.get('ai_response', '')
        rag_context = turn_context.get('rag_context', '')
        
        return f"""You are an expert story analyst. Analyze this conversation turn and identify memory operations needed.

**CONVERSATION TURN:**
User: {user_message}
AI: {ai_response}

**EXISTING ENTITIES:**
{existing_entities}

**RAG CONTEXT USED:**
{rag_context}

**TASK:** Identify two types of memory operations:

1. **UPDATES**: Existing entities that need their session notes updated
2. **CREATIONS**: New entities that should be created

**OUTPUT FORMAT (JSON):**
```json
{{
  "updates": [
    {{
      "entity_description": "The main character Momo",
      "update_summary": "Developed new magical ability after intense training with spiritual energy"
    }}
  ],
  "creations": [
    {{
      "entity_type": "CHARACTER",
      "creation_summary": "A new character named 'Kenta' was introduced. He is a mysterious demon hunter who appeared to help Momo, but his true intentions are unknown. He wears a black coat and carries a katana."
    }}
  ]
}}
```

**GUIDELINES:**
- For updates: Describe entities by their content/role, not by ID
- For creations: Only create entities that are significant to the story
- Valid entity types: CHARACTER, LOCATION, OBJECT, EVENT, CONCEPT
- Be specific in descriptions to enable accurate entity matching
- Avoid duplicating existing entities in creations

**IMPORTANT:** Respond ONLY with valid JSON in the exact format shown above."""
        
    def _parse_analysis_response(self, response_content: str) -> EnhancedAnalysisResult:
        """Parse the LLM response into structured result"""
        import json
        import re
        
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find JSON without code blocks
                json_str = response_content.strip()
            
            # Parse JSON
            data = json.loads(json_str)
            
            # Validate and convert to Pydantic models
            updates = [EntityUpdate(**update) for update in data.get('updates', [])]
            creations = [EntityCreation(**creation) for creation in data.get('creations', [])]
            
            return EnhancedAnalysisResult(
                updates=updates,
                creations=creations,
                success=True
            )
            
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.error(f"Failed to parse analysis response: {e}")
            logger.error(f"Response content: {response_content}")
            
            return EnhancedAnalysisResult(
                success=False,
                error_message=f"Failed to parse analysis response: {e}"
            )
