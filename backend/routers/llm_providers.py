# backend/routers/llm_providers.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from typing import List, Optional
from backend.services.mistral_client import MistralClient, config as mistral_config

router = APIRouter(
    prefix="/api/llm", # Prefixo para rotas relacionadas a LLM
    tags=["llm_providers"],
)

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
MISTRAL_CHAT_MODELS_URL = "https://api.mistral.ai/v1/models" # This URL is not actually used for listing models, but kept for consistency if a listing API becomes available.

# Schema Pydantic para a resposta do modelo
class LLMModelInfo(BaseModel):
    id: str
    name: Optional[str] = None
    provider: str

@router.get("/models", response_model=List[LLMModelInfo])

async def get_available_llm_models():
    """
    Fetches available LLM models from OpenRouter and Mistral.
    """
    all_models: List[LLMModelInfo] = []

    # Fetch OpenRouter models
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(OPENROUTER_MODELS_URL)
            response.raise_for_status()
            data = response.json()
            openrouter_models_data = data.get("data", [])
            for model_dict in openrouter_models_data:
                if isinstance(model_dict, dict) and "id" in model_dict:
                    all_models.append(
                        LLMModelInfo(
                            id=model_dict["id"],
                            name=model_dict.get("name", model_dict["id"]),
                            provider="OpenRouter"
                        )
                    )
    except httpx.RequestError as exc:
        print(f"An error occurred while requesting OpenRouter models {exc.request.url!r}: {exc}")
        # Do not raise HTTPException here, just log and continue to try other providers
    except httpx.HTTPStatusError as exc:
        print(f"Error response {exc.response.status_code} from OpenRouter while fetching models: {exc.response.text}")
    except Exception as e:
        print(f"An unexpected error occurred fetching OpenRouter models: {e}")

    # Fetch Mistral models
    # Note: Mistral API does not have a public endpoint to list all models.
    # We will hardcode the embedding model and chat model from mistral_client.py config.
    # If a future Mistral API allows listing, this can be updated.
    if mistral_config.embedding_model:
        all_models.append(
            LLMModelInfo(
                id=mistral_config.embedding_model,
                name=mistral_config.embedding_model, # Mistral models often use ID as name
                provider="Mistral"
            )
        )
    
    # You might want to add a check if all_models is empty and raise an error,
    # or return an empty list if no models could be fetched from any provider.
    if not all_models:
        raise HTTPException(status_code=500, detail="Could not fetch any LLM models from available providers.")

    return all_models
