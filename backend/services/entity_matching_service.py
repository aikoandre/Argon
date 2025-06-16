# backend/services/entity_matching_service.py
"""
Entity Matching Service for SessionNotes system.

Provides semantic matching of entity descriptions to existing LoreEntries.
"""
import logging
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
import numpy as np
from pydantic import BaseModel

from ..models.lore_entry import LoreEntry
from .litellm_service import litellm_service

logger = logging.getLogger(__name__)


class EntityMatch(BaseModel):
    """Result of entity matching"""
    lore_entry_id: str
    confidence: float
    entity_name: str
    entity_description: str


class EntityMatchingResult(BaseModel):
    """Result of entity matching operation"""
    success: bool
    match: Optional[EntityMatch] = None
    confidence: float = 0.0
    error_message: Optional[str] = None


class EntityMatchingService:
    """Service for semantic entity matching"""
    
    def __init__(self):
        self.litellm_service = litellm_service
        self.confidence_threshold = 0.85

    async def find_matching_entity(
        self,
        db: Session,
        entity_description: str,
        master_world_id: str,
        user_settings: Dict[str, Any]
    ) -> EntityMatchingResult:
        """
        Find the best matching LoreEntry for an entity description.
        
        Uses semantic similarity to match entity descriptions to existing LoreEntries.
        """
        try:
            # Get all entities for this master world
            entities = db.query(LoreEntry).filter(
                LoreEntry.master_world_id == master_world_id
            ).all()
            
            if not entities:
                return EntityMatchingResult(
                    success=True,
                    confidence=0.0
                )
            
            # Generate embedding for the description
            description_embedding = await self._generate_embedding(entity_description, user_settings)
            if description_embedding is None:
                return EntityMatchingResult(
                    success=False,
                    error_message="Failed to generate embedding for entity description"
                )
            
            # Find best match
            best_match = None
            best_confidence = 0.0
            
            for entity in entities:
                if entity.embedding_vector:
                    try:
                        # Calculate similarity
                        entity_embedding = np.array(entity.embedding_vector)
                        similarity = self._calculate_cosine_similarity(description_embedding, entity_embedding)
                        
                        if similarity > best_confidence:
                            best_confidence = similarity
                            best_match = entity
                            
                    except Exception as e:
                        logger.warning(f"Error calculating similarity for entity {entity.id}: {e}")
                        continue
            
            # Check if match meets confidence threshold
            if best_match and best_confidence >= self.confidence_threshold:
                logger.info(f"[EntityMatching] Found match: {best_match.name} (confidence: {best_confidence:.3f})")
                return EntityMatchingResult(
                    success=True,
                    match=EntityMatch(
                        lore_entry_id=best_match.id,
                        confidence=best_confidence,
                        entity_name=best_match.name,
                        entity_description=best_match.description or ""
                    ),
                    confidence=best_confidence
                )
            else:
                logger.info(f"[EntityMatching] No match found above threshold {self.confidence_threshold} (best: {best_confidence:.3f})")
                return EntityMatchingResult(
                    success=True,
                    confidence=best_confidence
                )
                
        except Exception as e:
            logger.error(f"[EntityMatching][ERROR] {e}")
            return EntityMatchingResult(
                success=False,
                error_message=str(e)
            )

    async def _generate_embedding(self, text: str, user_settings: Dict[str, Any]) -> Optional[np.ndarray]:
        """Generate embedding for text using the embedding service"""
        try:
            # Extract embedding configuration
            embedding_provider = user_settings.get('embedding_llm_provider', 'openrouter')
            embedding_model = user_settings.get('embedding_llm_model', 'mistral/mistral-embed')
            embedding_api_key = user_settings.get('embedding_llm_api_key')
            
            # Generate embedding
            response = await self.litellm_service.get_embedding(
                text=text,
                provider=embedding_provider,
                model=embedding_model,
                api_key=embedding_api_key
            )
            
            if response and 'data' in response and len(response['data']) > 0:
                embedding = response['data'][0].get('embedding')
                if embedding:
                    return np.array(embedding)
            
            logger.error(f"Embedding generation failed: No embedding data in response")
            return None
                
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return None

    def _calculate_cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            # Ensure vectors are the same length
            if len(vec1) != len(vec2):
                logger.warning(f"Vector length mismatch: {len(vec1)} vs {len(vec2)}")
                return 0.0
            
            # Calculate cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
                
            similarity = dot_product / (norm1 * norm2)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {e}")
            return 0.0

    def validate_entity_matches(
        self,
        db: Session,
        entity_descriptions: List[str],
        master_world_id: str
    ) -> List[bool]:
        """
        Validate if entity descriptions can find matches.
        
        Returns list of booleans indicating whether each description
        could potentially match an existing entity.
        """
        try:
            results = []
            entities = db.query(LoreEntry).filter(
                LoreEntry.master_world_id == master_world_id
            ).all()
            
            for description in entity_descriptions:
                # Simple keyword matching for validation
                found_match = False
                for entity in entities:
                    if self._simple_text_match(description.lower(), entity.name.lower(), entity.description):
                        found_match = True
                        break
                results.append(found_match)
            
            return results
            
        except Exception as e:
            logger.error(f"Error validating entity matches: {e}")
            return [False] * len(entity_descriptions)

    def _simple_text_match(self, description: str, entity_name: str, entity_description: str) -> bool:
        """Simple text-based matching for validation"""
        description_words = set(description.split())
        entity_words = set(entity_name.split())
        
        if entity_description:
            entity_words.update(entity_description.lower().split())
        
        # Check for word overlap
        overlap = len(description_words.intersection(entity_words))
        return overlap >= 2  # At least 2 words in common
