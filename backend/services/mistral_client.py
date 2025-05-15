# backend/services/mistral_client.py
import os
import asyncio
from typing import List, Dict, Any, Optional
import httpx

# Queue for embedding requests
embedding_queue = asyncio.Queue()

# Mistral API configuration
class MistralConfig:
    def __init__(self):
        self.api_key = os.getenv("MISTRAL_API_KEY", "")
        self.api_base = os.getenv("MISTRAL_API_BASE", "https://api.mistral.ai/v1")
        self.embedding_model = os.getenv("MISTRAL_EMBEDDING_MODEL", "mistral-embed")
        self.chat_model = os.getenv("MISTRAL_CHAT_MODEL", "mistral-large-latest")
        self.max_tokens = int(os.getenv("MISTRAL_MAX_TOKENS", "4096"))
        self.temperature = float(os.getenv("MISTRAL_TEMPERATURE", "0.7"))

config = MistralConfig()

# Mistral client class
class MistralClient:
    def __init__(self, api_key: Optional[str] = None, api_base: Optional[str] = None):
        self.api_key = api_key or config.api_key
        self.api_base = api_base or config.api_base
        self.client = httpx.AsyncClient()
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
    async def close(self):
        await self.client.aclose()
        
    async def create_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        if not texts:
            return []
            
        url = f"{self.api_base}/embeddings"
        payload = {
            "model": config.embedding_model,
            "input": texts
        }
        
        try:
            response = await self.client.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return [item["embedding"] for item in data["data"]]
        except Exception as e:
            print(f"Error creating embeddings: {e}")
            return []
    
    async def chat_completion(self, messages: List[Dict[str, str]], stream: bool = False) -> Dict[str, Any]:
        """Generate a chat completion response"""
        url = f"{self.api_base}/chat/completions"
        payload = {
            "model": config.chat_model,
            "messages": messages,
            "temperature": config.temperature,
            "max_tokens": config.max_tokens,
            "stream": stream
        }
        
        try:
            response = await self.client.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error in chat completion: {e}")
            return {"error": str(e)}

# Global client instance
_client = None

def initialize_mistral_client():
    """Initialize the global Mistral client instance"""
    global _client
    if _client is None:
        _client = MistralClient()
    return _client

async def get_client() -> MistralClient:
    """Get or create the Mistral client"""
    global _client
    if _client is None:
        _client = MistralClient()
    return _client

async def get_embedding_for_query(text: str) -> List[float]:
    """Generate embedding for a single query text
    
    This is a convenience function used for RAG queries.
    """
    client = await get_client()
    embeddings = await client.create_embeddings([text])
    if embeddings and len(embeddings) > 0:
        return embeddings[0]
    return []

async def add_embedding_task(task_data: Dict[str, Any]):
    """Add a task to the embedding queue
    
    Args:
        task_data: Dictionary containing card_id and text to embed
    """
    if not task_data or 'text' not in task_data:
        print("Error: Invalid task data for embedding")
        return
        
    # We'll use a simple tuple of (text, callback) where callback is None
    # The worker will process this and store the embedding in the database
    await embedding_queue.put((task_data['text'], None))
    print(f"Task for text added to embedding queue: {task_data.get('card_id', 'unknown')}")
    return True