import sys
import os
import logging

# Configure basic logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    stream=sys.stdout)

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, PROJECT_ROOT)

logger = logging.getLogger(__name__)
logger.info(f"PROJECT_ROOT resolved to: {PROJECT_ROOT}")

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import only the prompt preset router to avoid conflicts
from routers.prompt_presets import router as prompt_presets_router

app = FastAPI(title="Argon Backend - Prompt System Only", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include only the prompt preset router
app.include_router(prompt_presets_router, prefix="/api", tags=["prompt-presets"])

# Serve static files
STATIC_DIR = os.path.join(PROJECT_ROOT, "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    logger.info(f"STATIC_DIR resolved to: {STATIC_DIR}")

@app.get("/")
async def read_root():
    return {"message": "Argon Backend - Prompt System", "status": "operational"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
