import sys
import os

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, PROJECT_ROOT)

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
from backend.services import mistral_client
from backend.background_tasks import embedding_worker
from backend.services.mistral_client import embedding_queue, initialize_mistral_client
from backend.routers.lore_entries import router as lore_entries_router, master_world_router as master_world_lore_router
from backend.routers.chat import router as chat_router
from backend.routers.scenarios import router as scenarios_router
from backend.routers.personas import router as personas_router
from backend.routers.characters import router as characters_router
from backend.routers.master_worlds import router as master_worlds_router
from backend.routers.settings import router as settings_router
from backend.routers.llm_providers import router as llm_providers_router
from backend import database
from backend import models as db_models


app = FastAPI(title="Advanced Roleplay Engine API")

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

    # --- TEMPORÁRIO: Cria as tabelas do banco de dados se não existirem ---
    # REMOVA esta parte e use Alembic para migrações em produção!
    print("Criando tabelas do banco de dados (se não existirem)...")
    from backend.database import Base
    from backend import database as db_database
    Base.metadata.create_all(bind=db_database.engine)
    print("Verificação/Criação de tabelas concluída.")
    # --- FIM TEMPORÁRIO ---


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

# REMOVIDO: Este endpoint usava o modelo CardInput que não existe mais.
# A funcionalidade de adicionar tarefa de embedding ao criar um card
# agora é tratada nos endpoints específicos dos routers (ex: /api/cards/lore POST).
# @app.post("/test-add-embedding-task")
# async def test_add_task(card_input: CardInput, background_tasks: BackgroundTasks):
#     """
#     Rota de teste para simular a adição de uma tarefa de embedding
#     quando um 'card' é criado/atualizado.
#     """
#     # Usa card_input.text agora que o modelo foi atualizado
#     task_data = {"card_id": card_input.card_id, "text": card_input.text}

#     # Adiciona a tarefa à fila usando a função do nosso serviço
#     # Usamos background_tasks.add_task para garantir que a adição à fila
#     # não bloqueie a resposta HTTP, embora a adição à asyncio.Queue seja rápida.
#     background_tasks.add_task(mistral_client.add_embedding_task, task_data)

#     print(f"Endpoint: Tarefa para card {card_input.card_id} enviada para a fila.")
#     return {"message": f"Tarefa de embedding para card {card_input.card_id} adicionada à fila."}

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

# --- Adicione outros routers aqui ---
# Ex: app.include_router(settings_router, prefix="/api")

# Inclui os routers de lore entries
app.include_router(lore_entries_router)
app.include_router(master_world_lore_router)
app.include_router(chat_router)
app.include_router(scenarios_router)
app.include_router(personas_router)
app.include_router(characters_router)
app.include_router(master_worlds_router)
app.include_router(settings_router)
app.include_router(llm_providers_router)


# (O if __name__ == "__main__": uvicorn.run(...) não é mais necessário
#  pois rodamos com o comando uvicorn diretamente)
