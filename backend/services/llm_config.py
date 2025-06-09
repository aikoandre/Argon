"""
LLM Service Configuration for Unified LLM Services Architecture.

This module configures the four core LLM services:
1. Generation Service - Direct user responses with RAG
2. Analysis Service - Turn analysis and intent extraction  
3. Maintenance Service - Background tasks and world simulation
4. Embedding Service - Vector embeddings for semantic search
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel
import os


class LLMServiceConfig(BaseModel):
    """Configuration for a single LLM service"""
    name: str
    provider: str  # e.g., "openai", "anthropic", "ollama"
    model: str
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    timeout: int = 30
    retry_attempts: int = 3
    system_prompt: Optional[str] = None


class UnifiedLLMConfig:
    """Unified configuration for all LLM services"""
    
    def __init__(self):
        # Default configurations - can be overridden by environment variables
        self.services = {
            "generation": LLMServiceConfig(
                name="Generation Service",
                provider=os.getenv("GENERATION_LLM_PROVIDER", "openai"),
                model=os.getenv("GENERATION_LLM_MODEL", "gpt-4o"),
                temperature=float(os.getenv("GENERATION_LLM_TEMPERATURE", "0.7")),
                max_tokens=int(os.getenv("GENERATION_LLM_MAX_TOKENS", "4000")),
                timeout=int(os.getenv("GENERATION_LLM_TIMEOUT", "60")),
                system_prompt="""You are a skilled narrative AI assistant. Your role is to:
1. Generate engaging, contextually appropriate responses
2. Maintain character consistency and world coherence
3. Provide rich, immersive storytelling
4. Use the provided RAG context to enhance responses with relevant lore and memories"""
            ),
            
            "analysis": LLMServiceConfig(
                name="Analysis Service",
                provider=os.getenv("ANALYSIS_LLM_PROVIDER", "openai"),
                model=os.getenv("ANALYSIS_LLM_MODEL", "gpt-4o-mini"),
                temperature=float(os.getenv("ANALYSIS_LLM_TEMPERATURE", "0.3")),
                max_tokens=int(os.getenv("ANALYSIS_LLM_MAX_TOKENS", "2000")),
                timeout=int(os.getenv("ANALYSIS_LLM_TIMEOUT", "30")),
                system_prompt="""You are an analytical AI that processes conversation turns to extract actionable insights.
Your task is to analyze the last turn (user input + AI response) and identify:
1. Key events that occurred
2. Character developments or changes
3. World state modifications
4. Information that should be remembered or updated
Return structured JSON with specific update intentions."""
            ),
            
            "maintenance": LLMServiceConfig(
                name="Maintenance Service",
                provider=os.getenv("MAINTENANCE_LLM_PROVIDER", "openai"),
                model=os.getenv("MAINTENANCE_LLM_MODEL", "gpt-4o-mini"),
                temperature=float(os.getenv("MAINTENANCE_LLM_TEMPERATURE", "0.5")),
                max_tokens=int(os.getenv("MAINTENANCE_LLM_MAX_TOKENS", "1500")),
                timeout=int(os.getenv("MAINTENANCE_LLM_TIMEOUT", "30")),
                system_prompt="""You are a maintenance AI responsible for background world updates and content rewriting.
Your tasks include:
1. UPDATE_NOTE: Rewrite and update lore entries, character notes, and world information
2. SIMULATE_WORLD: Simulate off-scene NPCs and world events
3. CREATE_ENTITY: Generate new characters, locations, or items as needed
Focus on consistency, brevity, and maintaining narrative coherence."""
            ),
            
            "embedding": LLMServiceConfig(
                name="Embedding Service",
                provider=os.getenv("EMBEDDING_LLM_PROVIDER", "openai"),
                model=os.getenv("EMBEDDING_LLM_MODEL", "text-embedding-3-small"),
                temperature=0.0,  # Embeddings don't use temperature
                max_tokens=None,  # Embeddings don't use max_tokens
                timeout=int(os.getenv("EMBEDDING_LLM_TIMEOUT", "15")),
                system_prompt=None  # Embeddings don't use system prompts
            )
        }
    
    def get_service_config(self, service_name: str) -> LLMServiceConfig:
        """Get configuration for a specific service"""
        if service_name not in self.services:
            raise ValueError(f"Unknown service: {service_name}. Available: {list(self.services.keys())}")
        return self.services[service_name]
    
    def update_service_config(self, service_name: str, **kwargs) -> None:
        """Update configuration for a specific service"""
        if service_name not in self.services:
            raise ValueError(f"Unknown service: {service_name}")
        
        config = self.services[service_name]
        for key, value in kwargs.items():
            if hasattr(config, key):
                setattr(config, key, value)
            else:
                raise ValueError(f"Invalid config key: {key}")
    
    def get_all_configs(self) -> Dict[str, LLMServiceConfig]:
        """Get all service configurations"""
        return self.services.copy()


# Global instance
llm_config = UnifiedLLMConfig()


def get_llm_config() -> UnifiedLLMConfig:
    """Get the global LLM configuration instance"""
    return llm_config
