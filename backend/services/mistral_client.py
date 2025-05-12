# backend-python/services/mistral_client.py
import asyncio
import os
import time
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from mistralai import Mistral

# --- Configuração Inicial ---
load_dotenv()
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_EMBED_MODEL = "mistral-embed" # Modelo de embedding recomendado

# --- Globais ---
mistral_client: Optional[Mistral] = None
embedding_queue = asyncio.Queue() # Fila para tarefas de embedding (background)
# Simples lock para garantir o rate limit de 1 chamada por segundo no worker
# Poderia ser mais sofisticado (ex: token bucket), mas serve para começar
worker_rate_limit_lock = asyncio.Lock()
last_api_call_time = 0.0

# --- Inicialização ---
def initialize_mistral_client():
    """Inicializa o cliente Mistral. Deve ser chamado na inicialização do FastAPI."""
    global mistral_client
    if not MISTRAL_API_KEY:
        print("ERRO CRÍTICO: MISTRAL_API_KEY não encontrada no ambiente/arquivo .env.")
        # Em uma aplicação real, você pode querer lançar uma exceção aqui
        # ou desabilitar funcionalidades que dependem da API.
        mistral_client = None
        return

    try:
        mistral_client = Mistral(api_key=MISTRAL_API_KEY)
        print("Cliente Mistral inicializado com sucesso.")
    except Exception as e:
        print(f"Erro ao inicializar o cliente Mistral: {e}")
        mistral_client = None

# --- Funções de Embedding ---

async def _call_mistral_embed_api_with_rate_limit(texts: List[str]) -> Optional[Dict[str, Any]]:
    """
    Função interna para chamar a API de embeddings com rate limiting.
    Usada principalmente pelo worker da fila.
    """
    global mistral_client, last_api_call_time

    if not mistral_client:
        print("Erro: Cliente Mistral não inicializado.")
        return None

    async with worker_rate_limit_lock:
        # Calcula o tempo necessário para esperar desde a última chamada
        current_time = time.monotonic()
        time_since_last_call = current_time - last_api_call_time
        wait_time = max(0, 1.05 - time_since_last_call) # Espera 1.05s para segurança

        if wait_time > 0:
            # print(f"Rate limit: esperando {wait_time:.2f}s")
            await asyncio.sleep(wait_time)

        try:
            # print(f"Chamando API Mistral Embed para {len(texts)} texto(s)...")
            response = mistral_client.embeddings(
                model=MISTRAL_EMBED_MODEL,
                input=texts # A API aceita uma lista de strings
            )
            last_api_call_time = time.monotonic() # Atualiza o tempo da última chamada BEM SUCEDIDA
            # print("API Mistral Embed chamada com sucesso.")
            return response.model_dump()
        except Exception as e:
            print(f"Erro durante a chamada da API Mistral Embed: {e}")
            # Não atualiza last_api_call_time em caso de erro para tentar novamente logo
            return None

async def add_embedding_task(task_data: Dict[str, Any]):
    """Adiciona uma tarefa à fila de embedding."""
    # task_data deve conter pelo menos 'card_id' e 'text'
    if not all(k in task_data for k in ('card_id', 'text')):
         print(f"Erro: Task data inválido para fila de embedding: {task_data}")
         return
    await embedding_queue.put(task_data)
    # print(f"Task para card {task_data['card_id']} adicionada à fila.")

# --- Worker da Fila de Embedding ---

async def embedding_worker(queue: asyncio.Queue):
    """Worker que processa tarefas da fila de embedding em background."""
    print("Worker de Embedding iniciado.")
    while True:
        try:
            # Espera por uma tarefa na fila
            task_data = await queue.get()
            card_id = task_data.get('card_id')
            text = task_data.get('text')

            if not card_id or not text:
                print(f"Worker: Task inválida recebida: {task_data}")
                queue.task_done()
                continue

            print(f"Worker: Processando embedding para card {card_id}...")

            # Chama a API (com rate limit interno)
            # Enviamos um texto por vez, mas a função aceita lista
            response = await _call_mistral_embed_api_with_rate_limit(texts=[text])

            if response and response['data']:
                embedding_vector: List[float] = response['data'][0]['embedding']
                print(f"Worker: Embedding recebido para card {card_id} (Dim: {len(embedding_vector)}).")

                # TODO: PASSO FUTURO - Salvar o embedding_vector
                # Aqui você chamaria a função para salvar o vetor no FAISS ou DB
                # Ex: await save_embedding_to_storage(card_id, embedding_vector)
                print(f"Worker: [Placeholder] Salvaria embedding para card {card_id}.")

            else:
                # TODO: Lidar com falha - talvez colocar a task de volta na fila?
                print(f"Worker: Falha ao obter embedding para card {card_id}. A task será descartada por enquanto.")


            # Marca a tarefa como concluída na fila
            queue.task_done()

        except asyncio.CancelledError:
            print("Worker de Embedding cancelado.")
            break
        except Exception as e:
            # Loga o erro mas continua rodando para processar outras tasks
            print(f"Worker de Embedding encontrou um erro inesperado: {e}")
            # Garante que task_done seja chamado mesmo em erro inesperado após get()
            if 'task_data' in locals() and not queue.empty():
                 queue.task_done()
            await asyncio.sleep(5) # Evita loop de erro muito rápido


# --- Função para Embedding de Query (Chamada Direta - CUIDADO com Rate Limit!) ---

async def get_embedding_for_query(text: str) -> Optional[List[float]]:
    """
    Obtém embedding para um texto de query (ex: input do usuário para RAG).
    ATENÇÃO: Esta função chama a API diretamente e NÃO usa a fila principal.
    Se chamada frequentemente junto com o worker, PODE estourar o rate limit global.
    Uma solução mais robusta seria um rate limiter global ou usar a fila.
    Por enquanto, ela compartilha o lock para evitar chamadas simultâneas, mas
    não coordena perfeitamente com o worker.
    """
    print(f"Query Embedding: Solicitado para texto: '{text[:50]}...'")
    response = await _call_mistral_embed_api_with_rate_limit(texts=[text])
    if response and response['data']:
        print("Query Embedding: Recebido.")
        return response['data'][0]['embedding']
    else:
        print("Query Embedding: Falha ao obter.")
        return None
