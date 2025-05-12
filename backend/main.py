# backend-python/main.py
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio

# Importações dos nossos módulos
from services import mistral_client # Importa o módulo todo
from background_tasks import embedding_worker # Importa a função worker específica
# Importa a fila do módulo mistral_client para referência
from services.mistral_client import embedding_queue, initialize_mistral_client

# Placeholder models (serão definidos depois)
from pydantic import BaseModel
class CardInput(BaseModel):
    card_id: str
    text_content: str


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
    # 1. Inicializa o cliente Mistral (carrega API Key, etc.)
    initialize_mistral_client()

    # 2. Inicia o worker de embedding em uma tarefa de background
    #    Passamos a fila definida no módulo mistral_client para ele
    print("Iniciando worker de embedding...")
    loop = asyncio.get_running_loop()
    background_worker_task = loop.create_task(embedding_worker(embedding_queue))
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

# Rota de teste para adicionar tarefa à fila de embedding
@app.post("/test-add-embedding-task")
async def test_add_task(card_input: CardInput, background_tasks: BackgroundTasks):
    """
    Rota de teste para simular a adição de uma tarefa de embedding
    quando um 'card' é criado/atualizado.
    """
    task_data = {"card_id": card_input.card_id, "text": card_input.text_content}

    # Adiciona a tarefa à fila usando a função do nosso serviço
    # Usamos background_tasks.add_task para garantir que a adição à fila
    # não bloqueie a resposta HTTP, embora a adição à asyncio.Queue seja rápida.
    background_tasks.add_task(mistral_client.add_embedding_task, task_data)

    print(f"Endpoint: Tarefa para card {card_input.card_id} enviada para a fila.")
    return {"message": f"Tarefa de embedding para card {card_input.card_id} adicionada à fila."}

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


# --- Adicione outros routers aqui ---
# Ex: app.include_router(settings_router, prefix="/api")

# (O if __name__ == "__main__": uvicorn.run(...) não é mais necessário
#  pois rodamos com o comando uvicorn diretamente)