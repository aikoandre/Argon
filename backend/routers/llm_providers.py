# backend/routers/llm_providers.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel # Importe BaseModel
import httpx # Para fazer chamadas HTTP assíncronas
from typing import List, Optional # Importe List e Optional

router = APIRouter(
    prefix="/api/llm", # Prefixo para rotas relacionadas a LLM
    tags=["llm_providers"],
)

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

# Schema Pydantic para a resposta do modelo
class LLMModelInfo(BaseModel):
    id: str
    name: Optional[str] = None # OpenRouter geralmente fornece 'name'

@router.get("/models", response_model=List[LLMModelInfo])
async def get_available_llm_models():
    """
    Fetches available LLM models from OpenRouter.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(OPENROUTER_MODELS_URL)
            response.raise_for_status()  # Levanta exceção para códigos de erro HTTP
            
            data = response.json()
            models_data = data.get("data", []) # A lista de modelos está sob a chave "data"
            
            # Formata para o nosso schema LLMModelInfo
            formatted_models: List[LLMModelInfo] = []
            for model_dict in models_data:
                if isinstance(model_dict, dict) and "id" in model_dict:
                    formatted_models.append(
                        LLMModelInfo(id=model_dict["id"], name=model_dict.get("name", model_dict["id"]))
                    )
            return formatted_models
    except httpx.RequestError as exc:
        # Erro de rede/conexão
        print(f"An error occurred while requesting {exc.request.url!r}: {exc}")
        raise HTTPException(status_code=503, detail="Could not connect to OpenRouter to fetch models.")
    except httpx.HTTPStatusError as exc:
        # Erro HTTP (4xx, 5xx)
        print(f"Error response {exc.response.status_code} while requesting {exc.request.url!r}. Response: {exc.response.text}")
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error from OpenRouter: {exc.response.json().get('error', {}).get('message', 'Unknown error')}")
    except Exception as e:
        # Outros erros inesperados
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while fetching models: {str(e)}")
