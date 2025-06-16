# backend/services/entity_creation_service.py
"""
Advanced Entity Creation Service for Phase 3.

Provides sophisticated LLM-driven entity creation with structured prompts and validation.
"""
import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import json
import re

from .litellm_service import litellm_service
from ..utils.reasoning_utils import is_reasoning_capable_model

logger = logging.getLogger(__name__)


class EntityCreationResult(BaseModel):
    """Result of entity creation"""
    success: bool
    entity_data: Dict[str, Any] = {}
    quality_score: float = 0.0
    error_message: str = ""
    validation_warnings: List[str] = []


class EntityCreationService:
    """Advanced service for creating new entities with LLM integration"""
    
    def __init__(self):
        self.litellm_service = litellm_service
        self.valid_entity_types = {"CHARACTER", "LOCATION", "OBJECT", "EVENT", "CONCEPT"}
        self.max_description_length = 1000
        self.max_name_length = 100

    async def create_entity(
        self,
        creation_summary: str,
        entity_type: str,
        user_settings: Dict[str, Any],
        existing_entities_context: str = "",
        turn_context: Optional[Dict[str, Any]] = None,
        reasoning_mode: Optional[str] = None,
        reasoning_effort: Optional[str] = None
    ) -> EntityCreationResult:
        """
        Create a new entity with advanced context awareness.
        
        Args:
            creation_summary: Summary of the new entity to create
            entity_type: Type of entity (CHARACTER, LOCATION, etc.)
            user_settings: User LLM configuration
            existing_entities_context: Context about existing entities
            turn_context: Optional conversation context
            reasoning_mode: Optional reasoning mode for capable models
            reasoning_effort: Optional reasoning effort level
        """
        try:
            # Validate entity type
            if entity_type not in self.valid_entity_types:
                return EntityCreationResult(
                    success=False,
                    error_message=f"Invalid entity type: {entity_type}. Must be one of: {', '.join(self.valid_entity_types)}"
                )
            
            # Extract LLM configuration
            provider = user_settings.get('analysis_llm_provider', 'openrouter')
            model = user_settings.get('analysis_llm_model_new') or user_settings.get('analysis_llm_model', 'mistral-large-latest')
            api_key = user_settings.get('analysis_llm_api_key_new') or user_settings.get('analysis_llm_api_key')
            
            # Create enhanced creation prompt
            prompt = self._create_creation_prompt(
                creation_summary=creation_summary,
                entity_type=entity_type,
                existing_entities_context=existing_entities_context,
                turn_context=turn_context
            )
            
            # Configure reasoning if available
            reasoning_params = {}
            if is_reasoning_capable_model(model) and reasoning_mode:
                reasoning_params = {
                    "reasoning_mode": reasoning_mode,
                    "reasoning_effort": reasoning_effort or "medium"
                }
            
            # Call LLM for entity creation
            response = await self.litellm_service.get_completion(
                provider=provider,
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=api_key,
                max_tokens=1000,
                temperature=0.4,  # Lower temperature for more consistent structure
                **reasoning_params
            )
            
            # Extract and parse content
            content = response.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            if not content:
                return EntityCreationResult(
                    success=False,
                    error_message="Empty response from LLM"
                )
            
            # Parse JSON response
            entity_data = self._parse_entity_data(content)
            
            if not entity_data:
                # Try fallback creation
                entity_data = self._create_fallback_entity_data(creation_summary, entity_type)
                logger.warning(f"[EntityCreation] Used fallback creation for {entity_type}")
            
            # Validate and clean the entity data
            validated_data, warnings = self._validate_and_clean_entity_data(entity_data, entity_type)
            
            # Calculate quality score
            quality_score = self._calculate_quality_score(validated_data, creation_summary)
            
            logger.info(f"[EntityCreation] Created {entity_type}: {validated_data.get('name', 'Unknown')}, quality: {quality_score:.2f}")
            
            return EntityCreationResult(
                success=True,
                entity_data=validated_data,
                quality_score=quality_score,
                validation_warnings=warnings
            )
            
        except Exception as e:
            logger.error(f"[EntityCreation] Error: {e}")
            
            # Fallback creation
            fallback_data = self._create_fallback_entity_data(creation_summary, entity_type)
            
            return EntityCreationResult(
                success=True,  # Still successful with fallback
                entity_data=fallback_data,
                quality_score=0.4,  # Lower quality for fallback
                error_message=f"Used fallback due to error: {str(e)}"
            )

    def _create_creation_prompt(
        self,
        creation_summary: str,
        entity_type: str,
        existing_entities_context: str,
        turn_context: Optional[Dict[str, Any]]
    ) -> str:
        """Create an enhanced entity creation prompt"""
        
        # Add context section if available
        context_section = ""
        if turn_context:
            recent_messages = turn_context.get('chat_history', [])[-2:]  # Last 2 messages for context
            if recent_messages:
                context_section = f"""
[Story Context]:
{chr(10).join([f"{msg.get('content', '')}" for msg in recent_messages])}
"""
        
        # Add duplicate prevention section
        duplicate_prevention = ""
        if existing_entities_context:
            duplicate_prevention = f"""
[Existing Entities to Avoid Duplicating]:
{existing_entities_context}

**IMPORTANT**: Do not create an entity that duplicates or closely resembles any existing entity listed above.
"""
        
        return f"""You are a creative world-building assistant. Create a detailed {entity_type.lower()} based on the story development.

[Story Development]:
{creation_summary}
{context_section}{duplicate_prevention}

**Task**: Create a JSON object for this new {entity_type.lower()} with the following structure:

```json
{{
  "name": "Clear, memorable name (max 50 characters)",
  "description": "Rich, detailed description in third person (100-400 words)",
  "tags": ["relevant", "descriptive", "keywords"],
  "physical_traits": "Physical appearance (for characters/objects)",
  "personality_traits": "Personality description (for characters)", 
  "significance": "Why this entity matters to the story",
  "relationships": "Connections to other characters/elements"
}}
```

**Guidelines:**
- Make the {entity_type.lower()} distinctive and memorable
- Include specific details that make it unique
- Ensure it fits naturally into the story world
- For characters: include personality, appearance, motivations
- For locations: include atmosphere, layout, important features
- For objects: include appearance, function, significance
- Use vivid, descriptive language

**Respond with ONLY the JSON object:**"""

    def _parse_entity_data(self, content: str) -> Optional[Dict[str, Any]]:
        """Parse entity data from LLM response"""
        try:
            # Find JSON in the response
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL | re.IGNORECASE)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find JSON without code blocks
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    return None
            
            # Parse JSON
            data = json.loads(json_str)
            
            # Ensure required fields exist
            required_fields = ['name', 'description']
            for field in required_fields:
                if field not in data:
                    logger.warning(f"Missing required field: {field}")
                    return None
            
            return data
            
        except (json.JSONDecodeError, AttributeError) as e:
            logger.error(f"Failed to parse entity JSON: {e}")
            return None

    def _validate_and_clean_entity_data(
        self,
        entity_data: Dict[str, Any],
        entity_type: str
    ) -> tuple[Dict[str, Any], List[str]]:
        """Validate and clean entity data"""
        warnings = []
        cleaned_data = {}
        
        # Clean and validate name
        name = str(entity_data.get('name', '')).strip()
        if len(name) > self.max_name_length:
            name = name[:self.max_name_length]
            warnings.append(f"Name truncated to {self.max_name_length} characters")
        cleaned_data['name'] = name or f"New {entity_type.title()}"
        
        # Clean and validate description
        description = str(entity_data.get('description', '')).strip()
        if len(description) > self.max_description_length:
            description = description[:self.max_description_length] + "..."
            warnings.append(f"Description truncated to {self.max_description_length} characters")
        cleaned_data['description'] = description or entity_data.get('name', 'A new entity in the story')
        
        # Clean tags
        tags = entity_data.get('tags', [])
        if isinstance(tags, list):
            cleaned_tags = [str(tag).strip().lower() for tag in tags if str(tag).strip()]
            cleaned_data['tags'] = cleaned_tags[:10]  # Limit to 10 tags
        else:
            cleaned_data['tags'] = [entity_type.lower(), 'generated']
        
        # Add entity type if not in tags
        if entity_type.lower() not in cleaned_data['tags']:
            cleaned_data['tags'].append(entity_type.lower())
        
        # Optional fields (keep if present and valid)
        optional_fields = ['physical_traits', 'personality_traits', 'significance', 'relationships']
        for field in optional_fields:
            if field in entity_data and entity_data[field]:
                value = str(entity_data[field]).strip()
                if len(value) <= 500:  # Reasonable limit for optional fields
                    cleaned_data[field] = value
        
        return cleaned_data, warnings

    def _calculate_quality_score(self, entity_data: Dict[str, Any], creation_summary: str) -> float:
        """Calculate quality score for created entity"""
        score = 0.0
        
        # Name quality (0.2)
        name = entity_data.get('name', '')
        if name and len(name) > 2 and not name.startswith('New '):
            score += 0.2
        elif name:
            score += 0.1
        
        # Description quality (0.4)
        description = entity_data.get('description', '')
        if len(description) >= 100:
            score += 0.4
        elif len(description) >= 50:
            score += 0.3
        elif len(description) >= 20:
            score += 0.2
        
        # Tags quality (0.1)
        tags = entity_data.get('tags', [])
        if len(tags) >= 3:
            score += 0.1
        elif len(tags) >= 1:
            score += 0.05
        
        # Relevance to creation summary (0.2)
        summary_words = set(creation_summary.lower().split())
        description_words = set(description.lower().split())
        name_words = set(name.lower().split())
        
        all_entity_words = description_words.union(name_words)
        if summary_words and all_entity_words:
            relevance = len(summary_words.intersection(all_entity_words)) / len(summary_words)
            score += relevance * 0.2
        
        # Optional fields bonus (0.1)
        optional_fields = ['physical_traits', 'personality_traits', 'significance', 'relationships']
        present_optional = sum(1 for field in optional_fields if entity_data.get(field))
        score += (present_optional / len(optional_fields)) * 0.1
        
        return min(score, 1.0)

    def _create_fallback_entity_data(self, creation_summary: str, entity_type: str) -> Dict[str, Any]:
        """Create fallback entity data when LLM generation fails"""
        # Extract potential name from summary
        name_match = re.search(r"(?:named|called)\s+['\"]?([^'\",.!?]+)['\"]?", creation_summary, re.IGNORECASE)
        if name_match:
            name = name_match.group(1).strip()
        else:
            name = f"New {entity_type.title()}"
        
        return {
            "name": name,
            "description": creation_summary,
            "tags": [entity_type.lower(), "generated", "fallback"]
        }


# Global entity creation service instance
entity_creation_service = EntityCreationService()
