"""
Unified LLM Service for the Unified LLM Services Architecture.

This service provides a single interface to all four LLM services:
- Generation Service: Direct user responses with RAG
- Analysis Service: Turn analysis and intent extraction
- Maintenance Service: Background tasks and world simulation  
- Embedding Service: Vector embeddings for semantic search
"""
import asyncio
import json
import logging
from typing import Dict, Any, List, Optional, Union
from datetime import datetime

from litellm import acompletion, aembedding
from .llm_config import get_llm_config, LLMServiceConfig

logger = logging.getLogger(__name__)


class UnifiedLLMService:
    """Unified service for all LLM operations"""
    
    def __init__(self):
        self.config = get_llm_config()
        self._service_stats = {
            "generation": {"calls": 0, "errors": 0, "total_tokens": 0},
            "analysis": {"calls": 0, "errors": 0, "total_tokens": 0},
            "maintenance": {"calls": 0, "errors": 0, "total_tokens": 0},
            "embedding": {"calls": 0, "errors": 0, "total_tokens": 0}
        }
    
    async def _make_llm_call(
        self,
        service_name: str,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> Dict[str, Any]:
        """Make an LLM call with retry logic and error handling"""
        service_config = self.config.get_service_config(service_name)
        self._service_stats[service_name]["calls"] += 1
        
        # Prepare the call parameters
        call_params = {
            "model": f"{service_config.provider}/{service_config.model}",
            "messages": messages,
            "temperature": service_config.temperature,
            "timeout": service_config.timeout,
            **kwargs
        }
        
        # Add max_tokens if specified
        if service_config.max_tokens:
            call_params["max_tokens"] = service_config.max_tokens
        
        # Retry logic
        for attempt in range(service_config.retry_attempts):
            try:
                response = await acompletion(**call_params)
                
                # Track token usage
                if hasattr(response, 'usage') and response.usage:
                    total_tokens = getattr(response.usage, 'total_tokens', 0)
                    self._service_stats[service_name]["total_tokens"] += total_tokens
                
                return {
                    "success": True,
                    "response": response,
                    "content": response.choices[0].message.content,
                    "service": service_name,
                    "timestamp": datetime.now().isoformat()
                }
                
            except Exception as e:
                logger.warning(f"LLM call attempt {attempt + 1} failed for {service_name}: {str(e)}")
                if attempt == service_config.retry_attempts - 1:
                    self._service_stats[service_name]["errors"] += 1
                    return {
                        "success": False,
                        "error": str(e),
                        "service": service_name,
                        "timestamp": datetime.now().isoformat()
                    }
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
    
    async def _make_embedding_call(
        self,
        texts: Union[str, List[str]],
        **kwargs
    ) -> Dict[str, Any]:
        """Make an embedding call with retry logic"""
        service_config = self.config.get_service_config("embedding")
        self._service_stats["embedding"]["calls"] += 1
        
        call_params = {
            "model": f"{service_config.provider}/{service_config.model}",
            "input": texts,
            "timeout": service_config.timeout,
            **kwargs
        }
        
        # Retry logic
        for attempt in range(service_config.retry_attempts):
            try:
                response = await aembedding(**call_params)
                
                # Track token usage
                if hasattr(response, 'usage') and response.usage:
                    total_tokens = getattr(response.usage, 'total_tokens', 0)
                    self._service_stats["embedding"]["total_tokens"] += total_tokens
                
                return {
                    "success": True,
                    "response": response,
                    "embeddings": [item.embedding for item in response.data],
                    "service": "embedding",
                    "timestamp": datetime.now().isoformat()
                }
                
            except Exception as e:
                logger.warning(f"Embedding call attempt {attempt + 1} failed: {str(e)}")
                if attempt == service_config.retry_attempts - 1:
                    self._service_stats["embedding"]["errors"] += 1
                    return {
                        "success": False,
                        "error": str(e),
                        "service": "embedding",
                        "timestamp": datetime.now().isoformat()
                    }
                await asyncio.sleep(2 ** attempt)
    
    # Generation Service Methods
    async def generate_response(
        self,
        user_input: str,
        context: Optional[str] = None,
        character_info: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate a response using the Generation Service"""
        service_config = self.config.get_service_config("generation")
        
        messages = []
        if service_config.system_prompt:
            messages.append({"role": "system", "content": service_config.system_prompt})
        
        # Build the user message with context
        user_message = user_input
        if context:
            user_message = f"Context: {context}\n\nUser: {user_input}"
        if character_info:
            user_message = f"Character Info: {character_info}\n\n{user_message}"
        
        messages.append({"role": "user", "content": user_message})
        
        return await self._make_llm_call("generation", messages, **kwargs)
    
    # Analysis Service Methods
    async def analyze_turn(
        self,
        user_input: str,
        ai_response: str,
        context: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Analyze a conversation turn using the Analysis Service"""
        service_config = self.config.get_service_config("analysis")
        
        messages = []
        if service_config.system_prompt:
            messages.append({"role": "system", "content": service_config.system_prompt})
        
        analysis_prompt = f"""
        Analyze this conversation turn and identify actionable insights:
        
        User Input: {user_input}
        AI Response: {ai_response}
        {f"Context: {context}" if context else ""}
        
        Return a JSON object with the following structure:
        {{
            "key_events": ["list of significant events that occurred"],
            "character_updates": ["list of character developments or changes"],
            "world_updates": ["list of world state modifications"],
            "update_intentions": [
                {{
                    "type": "UPDATE_NOTE|CREATE_ENTITY",
                    "entity_id": "id_of_entity_to_update",
                    "update_summary": "what needs to be updated",
                    "priority": 1-10
                }}
            ]
        }}
        """
        
        messages.append({"role": "user", "content": analysis_prompt})
        
        return await self._make_llm_call("analysis", messages, **kwargs)
    
    # Maintenance Service Methods
    async def update_note(
        self,
        entity_id: str,
        current_content: str,
        update_summary: str,
        context: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Update a note/lore entry using the Maintenance Service"""
        service_config = self.config.get_service_config("maintenance")
        
        messages = []
        if service_config.system_prompt:
            messages.append({"role": "system", "content": service_config.system_prompt})
        
        update_prompt = f"""
        UPDATE_NOTE Task:
        Entity ID: {entity_id}
        Current Content: {current_content}
        Update Summary: {update_summary}
        {f"Context: {context}" if context else ""}
        
        Rewrite and update the content based on the update summary. 
        Maintain consistency and narrative coherence.
        Return only the updated content, no additional formatting.
        """
        
        messages.append({"role": "user", "content": update_prompt})
        
        return await self._make_llm_call("maintenance", messages, **kwargs)
    
    async def simulate_world(
        self,
        world_id: str,
        simulation_scope: str,
        context: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Simulate world events using the Maintenance Service"""
        service_config = self.config.get_service_config("maintenance")
        
        messages = []
        if service_config.system_prompt:
            messages.append({"role": "system", "content": service_config.system_prompt})
        
        simulation_prompt = f"""
        SIMULATE_WORLD Task:
        World ID: {world_id}
        Simulation Scope: {simulation_scope}
        {f"Context: {context}" if context else ""}
        
        Simulate events and changes in the world based on the scope.
        Return a JSON array of update_summary objects:
        [
            {{
                "entity_id": "id_of_affected_entity",
                "update_summary": "what changed",
                "priority": 1-10
            }}
        ]
        """
        
        messages.append({"role": "user", "content": simulation_prompt})
        
        return await self._make_llm_call("maintenance", messages, **kwargs)
    
    # Embedding Service Methods
    async def generate_embeddings(
        self,
        texts: Union[str, List[str]],
        **kwargs
    ) -> Dict[str, Any]:
        """Generate embeddings using the Embedding Service"""
        return await self._make_embedding_call(texts, **kwargs)
    
    # Utility Methods
    def get_service_stats(self) -> Dict[str, Any]:
        """Get statistics for all services"""
        return self._service_stats.copy()
    
    def reset_service_stats(self) -> None:
        """Reset all service statistics"""
        for service in self._service_stats:
            self._service_stats[service] = {"calls": 0, "errors": 0, "total_tokens": 0}


# Global instance
unified_llm_service = UnifiedLLMService()


def get_llm_service() -> UnifiedLLMService:
    """Get the global unified LLM service instance"""
    return unified_llm_service
