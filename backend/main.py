import sys
import os
import logging # Import logging early
logger = logging.getLogger(__name__) # Get logger instance for this module

# Configure basic logging to show DEBUG messages as early as possible
logging.basicConfig(level=logging.INFO, # Changed to INFO
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    stream=sys.stdout) # Ensure output goes to console

# Custom filter to allow only specific httpx INFO messages
class HTTPXFilter(logging.Filter):
    def filter(self, record):
        if record.name == 'httpx' and record.levelname == 'INFO':
            # Allow only HTTP Request POST messages
            return "HTTP Request: POST" in record.getMessage()
        return True # Allow all other messages

# Add the custom filter to the root logger
for handler in logging.getLogger().handlers:
    handler.addFilter(HTTPXFilter())

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, PROJECT_ROOT)

# Print PROJECT_ROOT and STATIC_DIR for immediate verification
logger.info(f"PROJECT_ROOT resolved to: {PROJECT_ROOT}");
import pathlib;
STATIC_DIR_TEST = pathlib.Path(PROJECT_ROOT) / "static";
logger.info(f"STATIC_DIR resolved to: {STATIC_DIR_TEST}");

from starlette.responses import FileResponse, JSONResponse # Import FileResponse and JSONResponse
from fastapi import FastAPI, BackgroundTasks, UploadFile, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
from backend.background_tasks import embedding_worker
from backend.routers.lore_entries import router as lore_entries_router, all_lore_router
from backend.routers.chat import router as chat_router
from backend.routers.scenarios import router as scenarios_router
from backend.routers.personas import router as personas_router
from backend.routers.images import router as images_router
from backend.routers.characters import router as characters_router
from backend.routers.master_worlds import router as master_worlds_router
from backend.routers.settings import router as settings_router
from backend.routers.llm_providers import router as llm_providers_router
from backend.routers.maintenance import router as maintenance_router
from backend.routers.faiss_management import router as faiss_management_router
from backend import database
from sqlalchemy.orm import Session # Import Session
from backend.database import get_db # Import get_db

# Import all models to register them with the SQLAlchemy engine
from backend.models.user_persona import UserPersona
from backend.models.master_world import MasterWorld
from backend.models.character_card import CharacterCard
from backend.models.scenario_card import ScenarioCard
from backend.models.chat_message import ChatMessage
from backend.models.chat_session import ChatSession
from backend.models.lore_entry import LoreEntry
from backend.models.session_relationship import SessionRelationship # Import the new model
from backend.models.user_settings import UserSettings
from backend.models.maintenance_queue import MaintenanceQueue
from fastapi.responses import StreamingResponse

app = FastAPI(title="Advanced Roleplay Engine API")

import pathlib
import mimetypes  # Import mimetypes for proper content type handling

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
# IMPORTANT: Mount static files *before* any middleware or other routes that might interfere.
app.mount("/static", static_files, name="static")

# Add middleware to set default content types
from starlette.middleware.base import BaseHTTPMiddleware

class ContentTypeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.logger = logging.getLogger(__name__) # Get logger instance for the middleware

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
                and not isinstance(response, StreamingResponse) # Skip for StreamingResponse
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
        except NameError as e:
            self.logger.error(f"Error in middleware: A NameError occurred. Details: {e}")
            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "An internal server error occurred due to an undefined variable."}
            )
        except Exception as e:
            self.logger.error(f"Error in middleware: {str(e)}")
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

    # 1. Ensure default user persona exists
    print("Ensuring default user persona exists...")
    with next(get_db()) as db: # Use get_db to get a session
        create_default_user_persona(db)
    print("Default user persona check complete.")

    # 3. Inicia o worker de embedding em uma tarefa de background
    #    A fila é acessada diretamente pelo worker no módulo background_tasks
    print("Iniciando worker de embedding...")
    loop = asyncio.get_running_loop()
    # O worker acessa a fila internamente
    background_worker_task = loop.create_task(embedding_worker())
    print("Worker de embedding agendado para execução.")
    
    # 4. Start the maintenance worker for the Unified LLM Services Architecture
    print("Starting maintenance worker...")
    from backend.services.maintenance_worker import get_maintenance_worker
    maintenance_worker = get_maintenance_worker()
    loop.create_task(maintenance_worker.start())
    print("Maintenance worker started.")

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


# --- Health Check Endpoint ---
@app.get("/api/health")
async def health_check():
    """
    Basic health check endpoint.
    """
    return {"status": "ok", "message": "API is healthy"}

# --- Favicon Handler ---
@app.get("/favicon.ico")
async def favicon():
    """Handle favicon requests to prevent 404 errors."""
    return {"status": "ok", "message": "No favicon configured"}

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
app.include_router(lore_entries_router)
app.include_router(all_lore_router)
app.include_router(chat_router, prefix="/api/chat")
app.include_router(scenarios_router)
app.include_router(personas_router)

app.include_router(characters_router)
app.include_router(master_worlds_router)
app.include_router(settings_router, prefix="/api")
app.include_router(llm_providers_router)
app.include_router(maintenance_router, prefix="/api")
app.include_router(faiss_management_router, prefix="/api")

def create_default_user_persona(db: Session):
    """
    Ensures a default 'User' persona exists in the database.
    If it doesn't exist, it creates one.
    """
    default_persona_name = "User"
    default_persona = db.query(UserPersona).filter(UserPersona.name == default_persona_name).first()

    if not default_persona:
        print(f"Creating default user persona: {default_persona_name}")
        new_persona = UserPersona(
            name=default_persona_name,
            description="A default persona representing the user.",
            image_url=None # Or a path to a default user image if available
        )
        db.add(new_persona)
        db.commit()
        db.refresh(new_persona)
        print(f"Default user persona '{default_persona_name}' created with ID: {new_persona.id}")
    else:
        print(f"Default user persona '{default_persona_name}' already exists with ID: {default_persona.id}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
