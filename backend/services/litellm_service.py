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
            embeddings = []
            
            # Handle different response formats
            if hasattr(response, 'data'):
                # OpenAI-style response with object attributes
                for item in response.data:
                    if hasattr(item, 'embedding'):
                        embeddings.append(item.embedding)
                    elif isinstance(item, dict) and 'embedding' in item:
                        embeddings.append(item['embedding'])
                    else:
                        # Log the actual structure for debugging
                        logger.warning(f"Unexpected embedding item format: {type(item)}, content: {item}")
                        # Try to extract embedding from any available field
                        if isinstance(item, dict):
                            for key in ['embedding', 'vector', 'data']:
                                if key in item:
                                    embeddings.append(item[key])
                                    break
                        continue
                return embeddings
            elif isinstance(response, dict) and 'data' in response:
                # Dictionary-style response
                for item in response['data']:
                    if isinstance(item, dict) and 'embedding' in item:
                        embeddings.append(item['embedding'])
                    elif hasattr(item, 'embedding'):
                        embeddings.append(item.embedding)
                    else:
                        # Log the actual structure for debugging
                        logger.warning(f"Unexpected embedding item format: {type(item)}, content: {item}")
                        # Try to extract embedding from any available field
                        if isinstance(item, dict):
                            for key in ['embedding', 'vector', 'data']:
                                if key in item:
                                    embeddings.append(item[key])
                                    break
                        continue
                return embeddings
            else:
                # Log the full response structure for debugging
                logger.error(f"Unexpected response format: {type(response)}, content: {response}")
                # Try to handle direct embedding response
                if isinstance(response, dict):
                    # Check if this is a direct embedding response
                    if 'embedding' in response:
                        return [response['embedding']]
                    elif 'embeddings' in response:
                        return response['embeddings']
                    # Check for other common patterns
                    for key in ['data', 'result', 'output']:
                        if key in response and isinstance(response[key], list):
                            return response[key]
                
                raise Exception(f"Unexpected embedding response format: {type(response)}")
            
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
        Get completion for specific service type with parameter configuration and custom prompts
        
        Args:
            service_type: Type of service (primary, analysis, maintenance, embedding)
            messages: List of message dictionaries
            user_settings: User settings containing LLM configurations
            **kwargs: Additional parameters
        
        Returns:
            Completion response
        """
        # Check if service is enabled
        enabled_field = f"{service_type}_enabled"
        if service_type in ["analysis", "maintenance", "embedding"]:
            if not user_settings.get(enabled_field, True):
                raise ValueError(f"{service_type.title()} service is disabled")
        
        # Map service types to new settings fields
        service_mapping = {
            "primary": {
                "provider_field": "primary_llm_provider",
                "model_field": "primary_llm_model",
                "api_key_field": "primary_llm_api_key_new",
                "temperature_field": "primary_llm_temperature",
                "top_p_field": "primary_llm_top_p",
                "max_tokens_field": "primary_llm_max_tokens",
                "reasoning_effort_field": "primary_llm_reasoning_effort",
                "custom_prompt_field": "primary_llm_custom_prompt",
                # Expanded parameters
                "top_k_field": "primary_llm_top_k",
                "top_a_field": "primary_llm_top_a",
                "min_p_field": "primary_llm_min_p",
                "frequency_penalty_field": "primary_llm_frequency_penalty",
                "presence_penalty_field": "primary_llm_presence_penalty",
                "repetition_penalty_field": "primary_llm_repetition_penalty"
            },
            "analysis": {
                "provider_field": "primary_llm_provider",  # Analysis uses Primary LLM provider/key
                "model_field": "primary_llm_model",
                "api_key_field": "primary_llm_api_key_new",
                "temperature_field": "analysis_llm_temperature",
                "top_p_field": "analysis_llm_top_p",
                "max_tokens_field": "analysis_llm_max_tokens",
                "reasoning_effort_field": "analysis_llm_reasoning_effort",
                "custom_prompt_field": "analysis_llm_custom_prompt"
            },
            "maintenance": {
                "provider_field": "primary_llm_provider",  # Maintenance uses Primary LLM provider/key
                "model_field": "primary_llm_model",
                "api_key_field": "primary_llm_api_key_new",
                "temperature_field": "maintenance_llm_temperature",
                "top_p_field": "maintenance_llm_top_p",
                "max_tokens_field": "maintenance_llm_max_tokens",
                "reasoning_effort_field": "maintenance_llm_reasoning_effort",
                "custom_prompt_field": "maintenance_llm_custom_prompt"
            },
            "embedding": {
                "provider_field": "embedding_llm_provider",
                "model_field": "embedding_llm_model",
                "api_key_field": "embedding_llm_api_key",
                "temperature_field": None,  # Embeddings don't use temperature
                "top_p_field": None,
                "max_tokens_field": None,
                "reasoning_effort_field": None,
                "custom_prompt_field": None
            }
        }
        
        if service_type not in service_mapping:
            raise ValueError(f"Unsupported service type: {service_type}")
        
        config = service_mapping[service_type]
        
        # Extract configuration from user settings
        provider = user_settings.get(config["provider_field"], "openrouter")
        model = user_settings.get(config["model_field"])
        api_key = user_settings.get(config["api_key_field"])
        
        if not model or not api_key:
            raise ValueError(f"Missing configuration for {service_type} service")
        
        # For embedding service, use embedding method
        if service_type == "embedding":
            if "input_text" in kwargs:
                return await self.get_embedding(provider, model, kwargs["input_text"], api_key)
            else:
                raise ValueError("Embedding service requires 'input_text' parameter")
        
        # Build LLM parameters from user settings
        llm_params = {}
        
        # Add temperature if configured and supported
        if config["temperature_field"]:
            temperature = user_settings.get(config["temperature_field"])
            if temperature is not None:
                llm_params["temperature"] = temperature
        
        # Add top_p if configured and supported
        if config["top_p_field"]:
            top_p = user_settings.get(config["top_p_field"])
            if top_p is not None:
                llm_params["top_p"] = top_p
        
        # Add max_tokens if configured and supported
        if config["max_tokens_field"]:
            max_tokens = user_settings.get(config["max_tokens_field"])
            if max_tokens is not None and max_tokens > 0:
                llm_params["max_tokens"] = max_tokens
        
        # Add expanded parameter support for Primary LLM service
        if service_type == "primary":
            # Advanced sampling parameters
            top_k = user_settings.get("primary_llm_top_k")
            if top_k is not None:
                llm_params["top_k"] = top_k
            
            top_a = user_settings.get("primary_llm_top_a")
            if top_a is not None:
                llm_params["top_a"] = top_a
            
            min_p = user_settings.get("primary_llm_min_p")
            if min_p is not None:
                llm_params["min_p"] = min_p
            
            # Penalty controls
            frequency_penalty = user_settings.get("primary_llm_frequency_penalty")
            if frequency_penalty is not None:
                llm_params["frequency_penalty"] = frequency_penalty
            
            presence_penalty = user_settings.get("primary_llm_presence_penalty")
            if presence_penalty is not None:
                llm_params["presence_penalty"] = presence_penalty
            
            repetition_penalty = user_settings.get("primary_llm_repetition_penalty")
            if repetition_penalty is not None and repetition_penalty != 1.0:
                llm_params["repetition_penalty"] = repetition_penalty
        
        # Check for UserPromptConfiguration parameters (higher priority)
        user_prompt_config = kwargs.get("user_prompt_config")
        if user_prompt_config and service_type == "primary":
            # Override with user prompt configuration if available
            if user_prompt_config.temperature is not None:
                llm_params["temperature"] = user_prompt_config.temperature
            if user_prompt_config.top_p is not None:
                llm_params["top_p"] = user_prompt_config.top_p
            if user_prompt_config.max_tokens is not None:
                llm_params["max_tokens"] = user_prompt_config.max_tokens
            if user_prompt_config.top_k is not None:
                llm_params["top_k"] = user_prompt_config.top_k
            if user_prompt_config.top_a is not None:
                llm_params["top_a"] = user_prompt_config.top_a
            if user_prompt_config.min_p is not None:
                llm_params["min_p"] = user_prompt_config.min_p
            if user_prompt_config.frequency_penalty is not None:
                llm_params["frequency_penalty"] = user_prompt_config.frequency_penalty
            if user_prompt_config.presence_penalty is not None:
                llm_params["presence_penalty"] = user_prompt_config.presence_penalty
            if user_prompt_config.repetition_penalty is not None:
                llm_params["repetition_penalty"] = user_prompt_config.repetition_penalty
        
        # Add reasoning_effort if configured and supported
        if config["reasoning_effort_field"]:
            reasoning_effort = user_settings.get(config["reasoning_effort_field"])
            if reasoning_effort and reasoning_effort != "Medium":
                # Map reasoning effort to provider-specific parameter
                effort_mapping = {
                    "Low": "low",
                    "Medium": "medium",
                    "High": "high"
                }
                llm_params["reasoning_effort"] = effort_mapping.get(reasoning_effort, "medium")
        
        # Handle custom prompt (additional instructions)
        if config["custom_prompt_field"]:
            custom_prompt = user_settings.get(config["custom_prompt_field"])
            if custom_prompt and custom_prompt.strip():
                # Add custom prompt as additional instructions to the last message
                messages = self._apply_custom_prompt(messages, custom_prompt)
        
        # Merge with any additional kwargs
        llm_params.update(kwargs)
        
        return await self.get_completion(provider, model, messages, api_key, **llm_params)
    
    def _apply_custom_prompt(self, messages: List[Dict[str, str]], custom_prompt: str) -> List[Dict[str, str]]:
        """
        Apply custom prompt as additional instructions to messages
        
        Args:
            messages: Original message list
            custom_prompt: Custom prompt to append
        
        Returns:
            Modified message list with custom prompt instructions
        """
        if not messages or not custom_prompt.strip():
            return messages
        
        # Create a copy of messages to avoid modifying the original
        modified_messages = messages.copy()
        
        # Find the last user or system message to append instructions
        for i in range(len(modified_messages) - 1, -1, -1):
            if modified_messages[i]["role"] in ["user", "system"]:
                # Append custom prompt as additional instructions
                original_content = modified_messages[i]["content"]
                modified_messages[i]["content"] = f"{original_content}\n\nAdditional Instructions: {custom_prompt}"
                break
        
        return modified_messages
    
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
