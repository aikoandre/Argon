# backend/routers/llm_providers.py
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import httpx
from typing import List, Optional, Dict, Any
from services.litellm_service import litellm_service, SUPPORTED_PROVIDERS

router = APIRouter(
    prefix="/api/llm",
    tags=["llm_providers"],
)

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

# Pydantic schemas
class LLMModelInfo(BaseModel):
    id: str
    name: Optional[str] = None
    provider: str
    description: Optional[str] = None

class ProviderInfo(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

class APIKeyValidationRequest(BaseModel):
    provider: str
    api_key: str

class APIKeyValidationResponse(BaseModel):
    valid: bool
    message: Optional[str] = None

@router.get("/providers", response_model=List[ProviderInfo])
async def get_supported_providers():
    """Get list of supported LLM providers"""
    providers = []
    for provider_id, config in SUPPORTED_PROVIDERS.items():
        providers.append(ProviderInfo(
            id=provider_id,
            name=config["name"],
            description=f"Access models through {config['name']}"
        ))
    return providers

@router.get("/models/{provider}", response_model=List[LLMModelInfo])
async def get_provider_models(provider: str, api_key: str = Query(..., description="API key for the provider")):
    """Get available models for specific provider"""
    try:
        models = await litellm_service.get_available_models(provider, api_key)
        return [LLMModelInfo(**model) for model in models]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/validate-key", response_model=APIKeyValidationResponse)
async def validate_api_key(request: APIKeyValidationRequest):
    """Validate API key for specific provider"""
    try:
        is_valid = await litellm_service.validate_api_key(request.provider, request.api_key)
        return APIKeyValidationResponse(
            valid=is_valid,
            message="API key is valid" if is_valid else "API key is invalid"        )
    except Exception as e:
        return APIKeyValidationResponse(
            valid=False,
            message=str(e)
        )

@router.get("/models", response_model=List[LLMModelInfo])
async def get_available_llm_models():
    """
    Legacy endpoint: Fetches available LLM models from OpenRouter, Mistral, and Google AI Studio.
    Maintained for backward compatibility. Use /providers and /models/{provider} instead.
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
                            provider="OpenRouter",
                            description=model_dict.get("description", "")
                        )
                    )
    except httpx.RequestError as exc:
        print(f"An error occurred while requesting OpenRouter models {exc.request.url!r}: {exc}")
    except httpx.HTTPStatusError as exc:
        print(f"Error response {exc.response.status_code} from OpenRouter while fetching models: {exc.response.text}")
    except Exception as e:
        print(f"An unexpected error occurred fetching OpenRouter models: {e}")

    # Add Mistral models (hardcoded since we use LiteLLM now)
    mistral_models = [
        {
            "id": "mistral-large-latest",
            "name": "Mistral Large (Latest)",
            "provider": "Mistral",
            "description": "Mistral's most capable model"
        },
        {
            "id": "mistral-medium-latest", 
            "name": "Mistral Medium (Latest)",
            "provider": "Mistral",
            "description": "Balanced performance and efficiency"
        },
        {
            "id": "mistral-small-latest",
            "name": "Mistral Small (Latest)", 
            "provider": "Mistral",
            "description": "Fast and efficient model"
        },
        {
            "id": "mistral-embed",
            "name": "Mistral Embed",
            "provider": "Mistral",
            "description": "Mistral embedding model"
        }
    ]
    
    for model in mistral_models:
        all_models.append(LLMModelInfo(**model))    # Add Google AI Studio models (hardcoded since we use LiteLLM now)
    google_models = [
        {
            "id": "gemini-2.5-pro-preview-06-05",
            "name": "Gemini 2.5 Pro Preview (06-05)",
            "provider": "Google",
            "description": "Latest Gemini Pro model preview"
        },
        {
            "id": "gemini-2.5-flash-preview-05-20",
            "name": "Gemini 2.5 Flash Preview (05-20)",
            "provider": "Google", 
            "description": "Latest Gemini Flash model preview"
        },
        {
            "id": "gemini-2.0-flash",
            "name": "Gemini 2.0 Flash",
            "provider": "Google",
            "description": "Latest stable Gemini 2.0 Flash model"
        },
        {
            "id": "gemini-1.5-pro",
            "name": "Gemini 1.5 Pro",
            "provider": "Google",
            "description": "Google's most capable multimodal model"
        },
        {
            "id": "gemini-1.5-flash",
            "name": "Gemini 1.5 Flash",
            "provider": "Google", 
            "description": "Fast and efficient Gemini model"
        },
        {
            "id": "text-embedding-004",
            "name": "Text Embedding 004",
            "provider": "Google",
            "description": "Google's text embedding model"
        }
    ]
    
    for model in google_models:
        all_models.append(LLMModelInfo(**model))
    
    if not all_models:
        raise HTTPException(status_code=500, detail="Could not fetch any LLM models from available providers.")

    return all_models
