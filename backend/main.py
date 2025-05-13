# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import settings as settings_router
from .routers import llm_providers as llm_providers_router
from .routers import chat as chat_router
from .routers import personas as personas_router
from .routers import characters as characters_router
from .routers import world_cards as world_cards_router
from .routers import scenarios as scenarios_router

# Cria todas as tabelas definidas em Base (Alembic é preferível para produção)
# Base.metadata.create_all(bind=engine) # Comentado pois usaremos Alembic

app = FastAPI(title="Advanced Roleplay Engine API")

# Configuração do CORS
origins = [
    "http://localhost:5173", # URL do frontend Vite (padrão)
    "http://127.0.0.1:5173",
    # Adicione outras origens se necessário
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health", tags=["healthcheck"])
async def health_check():
    return {"status": "ok", "message": "API is healthy"}

app.include_router(settings_router.router)
app.include_router(llm_providers_router.router)
app.include_router(chat_router.router)
app.include_router(personas_router.router)
app.include_router(characters_router.router)
app.include_router(world_cards_router.router)
app.include_router(scenarios_router.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)