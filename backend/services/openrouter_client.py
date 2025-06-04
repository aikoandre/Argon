# backend/services/openrouter_client.py
"""
OpenRouterClient: Simple wrapper for OpenRouter API usage in this project.
This class is used by services that need to interact with OpenRouter-compatible LLM endpoints.
"""
import os
import httpx
from typing import List, Dict, Any, Optional

class OpenRouterClient:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.base_url = base_url or os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        if not self.api_key:
            raise ValueError("OpenRouter API key not set.")

    async def chat_completion(self, messages: List[Dict[str, Any]], model: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": messages
        }
        payload.update(kwargs)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    async def embeddings(self, input_texts: List[str], model: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "input": input_texts
        }
        payload.update(kwargs)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
