# backend/services/mistral_client.py
import os
import asyncio
import logging # New import
from typing import List, Dict, Any, Optional
from mistralai import Mistral

# Get logger instance
logger = logging.getLogger(__name__)

# Queue for embedding requests
embedding_queue = asyncio.Queue()

# Mistral API configuration
class MistralConfig:
    def __init__(self):
        self.api_key = os.getenv("MISTRAL_API_KEY", "")
        self.embedding_model = os.getenv("MISTRAL_EMBEDDING_MODEL", "mistral-embed")

config = MistralConfig()

# Mistral client class
class MistralClient:
    def __init__(self):
        # No API key in constructor, it will be passed per call
        pass
        
    def create_embeddings(self, texts: List[str], api_key: str) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        if not texts:
            return []
        
        if not api_key:
            logger.error("Mistral API key is missing for embedding creation.")
            return []

        try:
            client = Mistral(api_key=api_key) # Initialize client with provided API key
            logger.info(f"Embedding call: model='{config.embedding_model}', texts_count={len(texts)}") # New log
            embeddings_batch_response = client.embeddings.create(
                model=config.embedding_model,
                inputs=texts,
            )
            return [item.embedding for item in embeddings_batch_response.data]
        except Exception as e:
            logger.error(f"An unexpected error occurred creating embeddings: {e}")
            return []


# Remove global client instance and related functions, as API key is passed per call
# _client = None

# def initialize_mistral_client():
#     """Initialize the global Mistral client instance"""
#     global _client
#     if _client is None:
#         _client = MistralClient()
#     return _client

# async def get_client() -> MistralClient:
#     """Get or create the Mistral client"""
#     global _client
#     if _client is None:
#         _client = MistralClient()
#     return _client

# async def get_embedding_for_query(text: str) -> List[float]:
#     """Generate embedding for a single query text
    
#     This is a convenience function used for RAG queries.
#     """
#     client = await get_client()
#     embeddings = await client.create_embeddings([text])
#     if embeddings and len(embeddings) > 0:
#         return embeddings[0]
#     return []

async def add_embedding_task(task_data: Dict[str, Any]):
    """Add a task to the embedding queue
    
    Args:
        task_data: Dictionary containing 'id', 'type' (e.g., "lore_entry"), and 'text' to embed
    """
    if not task_data or 'id' not in task_data or 'type' not in task_data or 'text' not in task_data:
        logger.error(f"Invalid task data for embedding: {task_data}. Missing 'id', 'type', or 'text'.")
        return
        
    # The worker will process this and store the embedding in the database based on 'type'
    await embedding_queue.put(task_data)
    logger.info(f"Embedding task added to queue for {task_data['type']} with ID: {task_data['id']}")
    return True