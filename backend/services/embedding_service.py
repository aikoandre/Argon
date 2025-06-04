from typing import List
from backend.services.mistral_client import MistralClient

class EmbeddingService:
    def __init__(self, mistral_client: MistralClient):
        self.mistral_client = mistral_client

    async def generate_embedding(self, text: str, api_key: str) -> List[float]:
        """
        Generates a numerical embedding (vector) for the given text using Mistral Embed API.
        """
        if not api_key:
            raise ValueError("API key is required for generating embeddings")
        
        embeddings = await self.mistral_client.create_embeddings([text], api_key)
        if embeddings and len(embeddings) > 0:
            return embeddings[0]
        return []

    async def create_embedding(self, text: str, api_key: str = None) -> List[float]:
        """
        Alias for generate_embedding for compatibility.
        """
        if not api_key:
            raise ValueError("API key is required for creating embeddings")
        return await self.generate_embedding(text, api_key)