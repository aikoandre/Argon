import sys
import os
import logging # Import logging early

# Configure basic logging to show DEBUG messages as early as possible
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    stream=sys.stdout) # Ensure output goes to console

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, PROJECT_ROOT)

from starlette.responses import FileResponse, JSONResponse # Import FileResponse and JSONResponse
from fastapi import FastAPI, BackgroundTasks, UploadFile, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
from backend.services import mistral_client
from backend.background_tasks import embedding_worker
from backend.services.mistral_client import embedding_queue, initialize_mistral_client
from backend.routers.lore_entries import lore_entry_ops_router, master_world_router as master_world_lore_router
from backend.routers.chat import router as chat_router
from backend.routers.scenarios import router as scenarios_router
from backend.routers.personas import router as personas_router
from backend.routers.images import router as images_router
from backend.routers import images
from backend.routers.characters import router as characters_router
from backend.routers.master_worlds import router as master_worlds_router
from backend.routers.settings import router as settings_router
from backend.routers.llm_providers import router as llm_providers_router
from backend import database

# Import all models to register them with the SQLAlchemy engine
from backend.models.user_persona import UserPersona
from backend.models.master_world import MasterWorld
from backend.models.character_card import CharacterCard
from backend.models.scenario_card import ScenarioCard
from backend.models.chat_message import ChatMessage
from backend.models.chat_session import ChatSession
from backend.models.lore_entry import LoreEntry
from backend.models.user_settings import UserSettings

app = FastAPI(title="Advanced Roleplay Engine API")

import pathlib
import mimetypes  # Import mimetypes for proper content type handling

logger = logging.getLogger(__name__) # Get logger instance

# Initialize mimetypes
mimetypes.init()
# Add any missing image types
mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('image/jpeg', '.jpg')
mimetypes.add_type('image/jpeg', '.jpeg')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/gif', '.gif')
mimetypes.add_type('image/svg+xml', '.svg')

# Serve static files (including uploaded images)
# CORRECTED: Ensure static_dir is always relative to the project root
# by using the previously defined PROJECT_ROOT.
static_dir = pathlib.Path(PROJECT_ROOT) / "static"
logger.info(f"Mounting static files from directory: {static_dir}")

# Create custom StaticFiles instance with strict content type handling
static_files = StaticFiles(
    directory=str(static_dir)
)

# Mount static files under /static (This is where /static/images/... will be served)
# REMOVE THE MOUNT LINE FOR "/api/images"
app.mount("/static", static_files, name="static")

# Add middleware to set default content types
from starlette.middleware.base import BaseHTTPMiddleware

class ContentTypeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        try:
            response = await call_next(request)
            path = request.url.path.lower()
            # Only set content-type for API endpoints if not already set, not a 204 response, and not multipart/form-data
            content_type = request.headers.get("content-type", "").lower()
            if (
                path.startswith("/api/")
                and "content-type" not in response.headers
                and not path.startswith("/api/images/serve")
                and response.status_code != 204
                and not content_type.startswith("multipart/form-data")
            ):
                response.headers["content-type"] = "application/json"
            # Ensure CORS headers are set
            if request.headers.get("origin") in origins:
                response.headers["Access-Control-Allow-Origin"] = request.headers["origin"]
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "*"
                response.headers["Access-Control-Allow-Headers"] = "*"
            return response
        except Exception as e:
            print(f"Error in middleware: {str(e)}")
            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": str(e)}
            )
            # Ensure CORS headers are set even for errors
            if request.headers.get("origin") in origins:
                response.headers["Access-Control-Allow-Origin"] = request.headers["origin"]
                response.headers["Access-Control-Allow-Credentials"] = "true"
            return response

app.add_middleware(ContentTypeMiddleware)

# --- CORS Configuration ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Background Task Management ---
background_worker_task = None

@app.on_event("startup")
async def startup_event():
    """Função executada quando o FastAPI inicia."""
    global background_worker_task
    print("API Iniciando...")

    # Ensure static directories exist
    (pathlib.Path("static/images")).mkdir(parents=True, exist_ok=True) # Ensure images dir exists within root static

    # Create database tables if they don't exist
    print("Creating database tables if they don't exist...")
    from backend.db.database import engine, Base
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")

    # 1. Inicializa o cliente Mistral (carrega API Key, etc.)
    from backend.services import mistral_client as local_mistral_client
    local_mistral_client.initialize_mistral_client()

    # 2. Inicia o worker de embedding em uma tarefa de background
    #    A fila é acessada diretamente pelo worker no módulo background_tasks
    print("Iniciando worker de embedding...")
    loop = asyncio.get_running_loop()
    # O worker acessa a fila internamente
    background_worker_task = loop.create_task(embedding_worker())
    print("Worker de embedding agendado para execução.")

@app.on_event("shutdown")
async def shutdown_event():
    """Função executada quando o FastAPI encerra."""
    global background_worker_task
    print("API Encerrando...")
    if background_worker_task:
        print("Cancelando worker de embedding...")
        background_worker_task.cancel()
        try:
            # Dá uma chance para o worker terminar limpamente
            await asyncio.wait_for(background_worker_task, timeout=5.0)
        except asyncio.CancelledError:
            print("Worker de embedding cancelado com sucesso.")
        except asyncio.TimeoutError:
            print("Timeout ao esperar o worker de embedding encerrar.")
        except Exception as e:
            print(f"Erro durante o cancelamento do worker: {e}")
    print("API Encerrada.")

# --- Test Routes ---
@app.get("/")
async def read_root():
    return {"message": "Olá do Backend ARE! Cliente Mistral e Worker configurados."}

# Rota de teste para obter embedding de query diretamente
@app.get("/test-get-query-embedding")
async def test_get_query(text: str):
    """
    Rota de teste para simular a obtenção de embedding para uma query RAG.
    """
    embedding = await mistral_client.get_embedding_for_query(text)
    if embedding:
        return {"text": text, "embedding_preview": embedding[:5], "embedding_dim": len(embedding)}
    else:
        return {"error": "Falha ao obter embedding para a query."}

# --- Health Check Endpoint ---
@app.get("/api/health")
async def health_check():
    """
    Basic health check endpoint.
    """
    return {"status": "ok", "message": "API is healthy"}

@app.get("/test-serve-image")
async def test_serve_image():
    """TEMPORARY: Test serving a specific image file using FileResponse."""
    # Use the static_dir defined globally for consistency
    image_path = static_dir / "images" / "personas" / "Anlow_30e1b8e2.jpg" # Use the image we know exists
    if not image_path.exists() or not image_path.is_file():
        logger.error(f"Test image file not found: {image_path.resolve()}")
        raise HTTPException(status_code=404, detail="Test image file not found")
    logger.info(f"Attempting to serve test image using FileResponse: {image_path.resolve()}")
    return FileResponse(image_path)

# Include other routers
app.include_router(lore_entry_ops_router)
app.include_router(master_world_lore_router)
app.include_router(chat_router, prefix="/api/chat")
app.include_router(scenarios_router)
app.include_router(personas_router)
# The images_router now handles all /api/images/* routes, including /api/images/serve/
app.include_router(images_router, prefix="/api/images")

app.include_router(characters_router)
app.include_router(master_worlds_router)
app.include_router(settings_router)
app.include_router(llm_providers_router)
