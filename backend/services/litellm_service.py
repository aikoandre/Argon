# backend/services/litellm_service.py
"""
LiteLLM Service: Unified interface for all LLM providers
Supports OpenRouter, Mistral, and Google AI Studio through LiteLLM
"""
import os
import logging
from typing import List, Dict, Any, Optional, Union
import litellm
from litellm import acompletion, aembedding
import httpx

logger = logging.getLogger(__name__)

# Supported providers configuration
SUPPORTED_PROVIDERS = {
    "openrouter": {
        "name": "OpenRouter",
        "api_base": "https://openrouter.ai/api/v1",
        "api_key_env": "OPENROUTER_API_KEY",
        "models_endpoint": "/models",
        "prefix": "openrouter/",
        "headers": {
            "HTTP-Referer": "https://argon-ai.com",
            "X-Title": "Argon AI"
        }
    },
    "mistral": {
        "name": "Mistral",
        "api_base": "https://api.mistral.ai/v1", 
        "api_key_env": "MISTRAL_API_KEY",
        "models_endpoint": "/models",
        "prefix": "mistral/"
    },
    "google": {
        "name": "Google AI Studio",
        "api_base": "https://generativelanguage.googleapis.com/v1beta",
        "api_key_env": "GOOGLE_API_KEY",
        "models_endpoint": "/models",
        "prefix": "google/"
    }
}

class LiteLLMService:
    def __init__(self):
        self.supported_providers = SUPPORTED_PROVIDERS
        # Configure LiteLLM settings
        litellm.drop_params = True
        litellm.set_verbose = False
        
    async def get_completion(
        self, 
        provider: str, 
        model: str, 
        messages: List[Dict[str, str]], 
        api_key: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Unified completion interface for all providers
        
        Args:
            provider: Provider name (openrouter, mistral, google)
            model: Model name without provider prefix
            messages: List of message dictionaries
            api_key: API key for the provider
            **kwargs: Additional parameters like temperature, max_tokens, etc.
        
        Returns:
            Completion response in OpenAI format
        """
        if provider not in self.supported_providers:
            raise ValueError(f"Unsupported provider: {provider}")
        
        provider_config = self.supported_providers[provider]
        
        # Format model name with provider prefix if needed
        if not model.startswith(provider_config["prefix"]):
            formatted_model = f"{provider_config['prefix']}{model}"
        else:
            formatted_model = model
        
        try:
            # Set up provider-specific headers
            extra_headers = {}
            if provider == "openrouter" and "headers" in provider_config:
                extra_headers.update(provider_config["headers"])
            
            logger.info(f"LiteLLM completion: provider={provider}, model={formatted_model}")
            
            response = await acompletion(
                model=formatted_model,
                messages=messages,
                api_key=api_key,
                api_base=provider_config.get("api_base"),
                extra_headers=extra_headers,
                **kwargs
            )
            
            return response.model_dump() if hasattr(response, 'model_dump') else dict(response)
            
        except Exception as e:
            logger.error(f"LiteLLM completion error for {provider}/{model}: {e}")
            raise self._format_provider_error(provider, e)
    
    async def get_embedding(
        self, 
        provider: str, 
        model: str, 
        texts: Union[str, List[str]], 
        api_key: str,
        **kwargs
    ) -> List[List[float]]:
        """
        Unified embedding interface for all providers
        
        Args:
            provider: Provider name (openrouter, mistral, google)
            model: Model name without provider prefix
            texts: Text string or list of texts to embed
            api_key: API key for the provider
            **kwargs: Additional parameters
        
        Returns:
            List of embeddings (each embedding is a list of floats)
        """
        if provider not in self.supported_providers:
            raise ValueError(f"Unsupported provider: {provider}")
        
        provider_config = self.supported_providers[provider]
        
        # Format model name with provider prefix if needed
        if not model.startswith(provider_config["prefix"]):
            formatted_model = f"{provider_config['prefix']}{model}"
        else:
            formatted_model = model
        
        # Ensure texts is a list
        if isinstance(texts, str):
            texts = [texts]
        
        try:
            logger.info(f"LiteLLM embedding: provider={provider}, model={formatted_model}, texts_count={len(texts)}")
            
            response = await aembedding(
                model=formatted_model,
                input=texts,
                api_key=api_key,
                api_base=provider_config.get("api_base"),
                **kwargs
            )
            
            # Extract embeddings from response
            if hasattr(response, 'data'):
                return [item.embedding for item in response.data]
            else:
                return [item['embedding'] for item in response['data']]
            
        except Exception as e:
            logger.error(f"LiteLLM embedding error for {provider}/{model}: {e}")
            raise self._format_provider_error(provider, e)
    
    async def get_available_models(self, provider: str, api_key: str) -> List[Dict[str, Any]]:
        """
        Get available models for a specific provider
        
        Args:
            provider: Provider name
            api_key: API key for the provider
        
        Returns:
            List of model information dictionaries
        """
        if provider not in self.supported_providers:
            raise ValueError(f"Unsupported provider: {provider}")
        
        provider_config = self.supported_providers[provider]
        
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                
                # Add provider-specific headers
                if provider == "openrouter" and "headers" in provider_config:
                    headers.update(provider_config["headers"])
                
                url = f"{provider_config['api_base']}{provider_config['models_endpoint']}"
                
                logger.info(f"Fetching models for {provider} from {url}")
                
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                
                data = response.json()
                
                # Handle different response formats
                if "data" in data:
                    models = data["data"]
                else:
                    models = data
                
                # Standardize model format
                standardized_models = []
                for model in models:
                    if isinstance(model, dict):
                        standardized_models.append({
                            "id": model.get("id", ""),
                            "name": model.get("name", model.get("id", "")),
                            "description": model.get("description", ""),
                            "provider": provider
                        })
                
                return standardized_models
                
        except Exception as e:
            logger.error(f"Error fetching models for {provider}: {e}")
            raise self._format_provider_error(provider, e)
    
    async def get_service_completion(
        self, 
        service_type: str, 
        messages: List[Dict[str, str]], 
        user_settings: Dict[str, Any],
        **kwargs
    ) -> Dict[str, Any]:
        """
        Get completion for specific service type (primary, analysis, maintenance, embedding)
        
        Args:
            service_type: Type of service (primary, analysis, maintenance, embedding)
            messages: List of message dictionaries
            user_settings: User settings containing LLM configurations
            **kwargs: Additional parameters
        
        Returns:
            Completion response
        """
        # Map service types to settings fields
        service_mapping = {
            "primary": {
                "provider_field": "llm_provider",
                "model_field": "selected_llm_model", 
                "api_key_field": "primary_llm_api_key"
            },
            "analysis": {
                "provider_field": "llm_provider",  # Using same provider for now
                "model_field": "analysis_llm_model",
                "api_key_field": "analysis_llm_api_key"
            },
            "maintenance": {
                "provider_field": "llm_provider",  # Using same provider for now
                "model_field": "analysis_llm_model",  # Fallback to analysis model
                "api_key_field": "analysis_llm_api_key"  # Fallback to analysis key
            },
            "embedding": {
                "provider_field": "llm_provider",
                "model_field": "selected_llm_model",  # Will be updated when embedding settings are added
                "api_key_field": "mistral_api_key"  # Current embedding provider
            }
        }
        
        if service_type not in service_mapping:
            raise ValueError(f"Unsupported service type: {service_type}")
        
        config = service_mapping[service_type]
        
        # Extract configuration from user settings
        provider = user_settings.get(config["provider_field"], "openrouter").lower()
        model = user_settings.get(config["model_field"])
        api_key = user_settings.get(config["api_key_field"])
        
        if not model or not api_key:
            raise ValueError(f"Missing configuration for {service_type} service")
        
        # For embedding service, use embedding method
        if service_type == "embedding":
            # This is a special case - embeddings typically need text input, not messages
            if "input_text" in kwargs:
                return await self.get_embedding(provider, model, kwargs["input_text"], api_key)
            else:
                raise ValueError("Embedding service requires 'input_text' parameter")
        
        return await self.get_completion(provider, model, messages, api_key, **kwargs)
    
    async def validate_api_key(self, provider: str, api_key: str) -> bool:
        """
        Validate API key for specific provider by making a test call
        
        Args:
            provider: Provider name
            api_key: API key to validate
        
        Returns:
            True if valid, False otherwise
        """
        try:
            # Get available models as a test - this is usually a lightweight call
            models = await self.get_available_models(provider, api_key)
            return len(models) > 0
        except Exception as e:
            logger.warning(f"API key validation failed for {provider}: {e}")
            return False
    
    async def validate_model_availability(
        self, 
        provider: str, 
        model: str, 
        api_key: str
    ) -> bool:
        """
        Check if model is available for provider
        
        Args:
            provider: Provider name
            model: Model name
            api_key: API key for the provider
        
        Returns:
            True if model is available, False otherwise
        """
        try:
            available_models = await self.get_available_models(provider, api_key)
            model_ids = [m["id"] for m in available_models]
            
            # Check both with and without provider prefix
            provider_config = self.supported_providers.get(provider, {})
            prefix = provider_config.get("prefix", "")
            
            return (model in model_ids or 
                    f"{prefix}{model}" in model_ids or
                    model.replace(prefix, "") in model_ids)
        except Exception as e:
            logger.warning(f"Model availability check failed for {provider}/{model}: {e}")
            return False
    
    def _format_provider_error(self, provider: str, error: Exception) -> Exception:
        """
        Format provider-specific error messages
        
        Args:
            provider: Provider name
            error: Original exception
        
        Returns:
            Formatted exception with user-friendly message
        """
        error_messages = {
            "openrouter": {
                "invalid_key": "Invalid OpenRouter API key. Please check your key in the OpenRouter dashboard.",
                "model_not_found": "Model not available in OpenRouter. Please select a different model.",
                "rate_limit": "OpenRouter rate limit exceeded. Please try again later."
            },
            "mistral": {
                "invalid_key": "Invalid Mistral API key. Please verify your key in the Mistral console.",
                "model_not_found": "Model not available in Mistral. Please select a different model.",
                "rate_limit": "Mistral rate limit exceeded. Please try again later."
            },
            "google": {
                "invalid_key": "Invalid Google AI Studio API key. Please check your Google Cloud console.",
                "model_not_found": "Model not available in Google AI Studio. Please select a different model.",
                "rate_limit": "Google AI Studio quota exceeded. Please check your usage limits."
            }
        }
        
        error_str = str(error).lower()
        provider_errors = error_messages.get(provider, {})
        
        if "unauthorized" in error_str or "invalid" in error_str or "401" in error_str:
            message = provider_errors.get("invalid_key", f"Invalid API key for {provider}")
        elif "not found" in error_str or "404" in error_str:
            message = provider_errors.get("model_not_found", f"Model not found for {provider}")
        elif "rate limit" in error_str or "429" in error_str:
            message = provider_errors.get("rate_limit", f"Rate limit exceeded for {provider}")
        else:
            message = f"{provider} API error: {str(error)}"
        
        return Exception(message)

# Global instance
litellm_service = LiteLLMService()
