from typing import List, Dict, Any
from backend.services.litellm_service import litellm_service

class EmbeddingService:
    def __init__(self):
        self.litellm_service = litellm_service

    async def generate_embedding(
        self, 
        text: str, 
        user_settings: Dict[str, Any] = None,
        api_key: str = None,
        provider: str = None,
        model: str = None
    ) -> List[float]:
        """
        Generates a numerical embedding (vector) for the given text using LiteLLM.
        
        Args:
            text: Text to embed
            user_settings: User settings containing LLM configurations
            api_key: API key (legacy parameter for backward compatibility)
            provider: Provider name (legacy parameter)
            model: Model name (legacy parameter)
        
        Returns:
            List of floats representing the embedding vector
        """
        # Use new LiteLLM configuration if available
        if user_settings:
            embedding_provider = user_settings.get('embedding_llm_provider', 'mistral')
            embedding_model = user_settings.get('embedding_llm_model', 'mistral-embed')
            embedding_api_key = user_settings.get('embedding_llm_api_key')
            
            if not embedding_api_key:
                # Fallback to legacy Mistral API key
                embedding_api_key = user_settings.get('mistral_api_key')
            
            if not embedding_api_key:
                raise ValueError("API key is required for generating embeddings")
            
            try:
                embeddings = await self.litellm_service.get_embedding(
                    provider=embedding_provider,
                    model=embedding_model,
                    texts=[text],
                    api_key=embedding_api_key
                )
                if embeddings and len(embeddings) > 0:
                    return embeddings[0]
                return []
            except Exception as e:
                # Fallback to legacy method if new configuration fails
                if embedding_provider == 'mistral' and api_key:
                    return await self._legacy_mistral_embedding(text, api_key)
                raise e
        
        # Legacy fallback method
        elif api_key:
            return await self._legacy_mistral_embedding(text, api_key)
        else:
            raise ValueError("Either user_settings or api_key is required for generating embeddings")

    async def _legacy_mistral_embedding(self, text: str, api_key: str) -> List[float]:
        """Legacy Mistral embedding method for backward compatibility"""
        try:
            embeddings = await self.litellm_service.get_embedding(
                provider='mistral',
                model='mistral-embed',
                texts=[text],
                api_key=api_key
            )
            if embeddings and len(embeddings) > 0:
                return embeddings[0]
            return []
        except Exception as e:
            raise ValueError(f"Failed to generate embedding: {str(e)}")

    async def create_embedding(
        self, 
        text: str, 
        user_settings: Dict[str, Any] = None,
        api_key: str = None
    ) -> List[float]:
        """
        Alias for generate_embedding for compatibility.
        """
        return await self.generate_embedding(text, user_settings, api_key)