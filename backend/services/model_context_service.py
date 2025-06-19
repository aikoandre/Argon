# backend/services/model_context_service.py
"""
Model Context Service: Provides context window information for different LLM models
Helps users understand how many messages they can include based on model capabilities
"""
from typing import Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class ModelContextService:
    """
    Service to provide context window information and calculate optimal message counts
    for different LLM models across various providers.
    """
    
    def __init__(self):
        # Model context window sizes (in tokens)
        # These are approximate values based on known model specifications
        self.model_context_windows = {
            # OpenAI Models
            "gpt-4": 8192,
            "gpt-4-32k": 32768,
            "gpt-4-turbo": 128000,
            "gpt-4o": 128000,
            "gpt-4o-mini": 128000,
            "gpt-3.5-turbo": 16385,
            "gpt-3.5-turbo-16k": 16385,
            
            # Anthropic Models
            "claude-3-opus": 200000,
            "claude-3-sonnet": 200000,
            "claude-3-haiku": 200000,
            "claude-3-5-sonnet": 200000,
            "claude-3-5-haiku": 200000,
            
            # Google Models
            "gemini-pro": 32768,
            "gemini-1.5-pro": 2000000,
            "gemini-1.5-flash": 1000000,
            
            # Mistral Models
            "mistral-tiny": 32768,
            "mistral-small": 32768,
            "mistral-medium": 32768,
            "mistral-large": 32768,
            "codestral": 32768,
            
            # Meta Models (via OpenRouter)
            "llama-2-70b": 4096,
            "llama-3-8b": 8192,
            "llama-3-70b": 8192,
            "llama-3.1-8b": 131072,
            "llama-3.1-70b": 131072,
            "llama-3.1-405b": 131072,
              # DeepSeek Models
            "deepseek-r1": 131072,
            "deepseek-r1-0528": 131072,  # Specific version
            "deepseek-chat": 32768,
            "deepseek-coder": 32768,
            
            # Other Models
            "grok-beta": 131072,
            "yi-34b": 4096,
            "mixtral-8x7b": 32768,
            "mixtral-8x22b": 65536,
        }
        
        # Average tokens per message (estimation for context calculation)
        self.avg_tokens_per_message = 75  # Conservative estimate
          # Reserve tokens for system prompt and response
        self.system_prompt_tokens = 1000  # Estimated system prompt size
        self.response_buffer_tokens = 1000  # Buffer for model response
    
    def get_model_context_window(self, model_name: str) -> int:
        """
        Get the context window size for a specific model.
        
        Args:
            model_name: Name of the model (with or without provider prefix)
            
        Returns:
            Context window size in tokens
        """
        # Remove provider prefixes and tags for lookup
        clean_model_name = model_name
        
        # Remove provider prefixes
        for prefix in ["openrouter/", "mistral/", "google/", "anthropic/", "openai/", "deepseek/"]:
            if clean_model_name.startswith(prefix):
                clean_model_name = clean_model_name[len(prefix):]
                break
        
        # Remove tag suffixes (e.g., ":free", ":beta")
        if ":" in clean_model_name:
            clean_model_name = clean_model_name.split(":")[0]
        
        # Try exact match first
        if clean_model_name in self.model_context_windows:
            return self.model_context_windows[clean_model_name]
        
        # Try partial matches for model families
        for model_key, context_size in self.model_context_windows.items():
            if model_key.lower() in clean_model_name.lower():
                return context_size
        
        # Default fallback for unknown models
        logger.warning(f"Unknown model context window for {model_name}, using default 8192 tokens")
        return 8192
    
    def calculate_max_messages(
        self, 
        model_name: str, 
        context_size_messages: Optional[int] = None
    ) -> Tuple[int, Dict[str, int]]:
        """
        Calculate the maximum number of messages that can fit in a model's context window.
        
        Args:
            model_name: Name of the model
            context_size_messages: User-requested message count (optional)
            
        Returns:
            Tuple of (recommended_messages, context_info)
        """
        total_context = self.get_model_context_window(model_name)
        
        # Calculate available tokens for chat history
        available_for_history = total_context - self.system_prompt_tokens - self.response_buffer_tokens
        
        # Calculate maximum possible messages
        max_possible_messages = max(1, available_for_history // self.avg_tokens_per_message)
        
        # Use user preference or model maximum
        if context_size_messages:
            recommended = min(context_size_messages, max_possible_messages)
        else:
            # Default to a reasonable number that works well for most conversations
            recommended = min(20, max_possible_messages)
        
        context_info = {
            "total_context_tokens": total_context,
            "system_prompt_tokens": self.system_prompt_tokens,
            "response_buffer_tokens": self.response_buffer_tokens,
            "available_for_history": available_for_history,
            "max_possible_messages": max_possible_messages,
            "avg_tokens_per_message": self.avg_tokens_per_message
        }
        
        return recommended, context_info
    
    def get_context_recommendations(self, model_name: str) -> Dict[str, int]:
        """
        Get context size recommendations for different use cases.
        
        Args:
            model_name: Name of the model
            
        Returns:
            Dictionary with recommended message counts for different scenarios
        """
        max_messages, _ = self.calculate_max_messages(model_name)
        
        return {
            "short_conversation": min(10, max_messages),
            "normal_conversation": min(20, max_messages), 
            "long_conversation": min(50, max_messages),
            "maximum_context": max_messages
        }
    
    def validate_context_size(self, model_name: str, requested_messages: int) -> Tuple[bool, str]:
        """
        Validate if the requested context size is feasible for the model.
        
        Args:
            model_name: Name of the model
            requested_messages: Number of messages requested by user
            
        Returns:
            Tuple of (is_valid, message)
        """
        max_messages, context_info = self.calculate_max_messages(model_name)
        
        if requested_messages <= max_messages:
            return True, f"Context size of {requested_messages} messages is valid for {model_name}"
        else:
            return False, f"Requested {requested_messages} messages exceeds maximum of {max_messages} for {model_name}"

# Global service instance
model_context_service = ModelContextService()
