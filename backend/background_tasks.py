# backend/background_tasks.py
import asyncio
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def embedding_worker():
    """Background worker that processes embedding requests from the queue.
    
    This worker continuously checks the embedding_queue for new embedding requests
    and processes them using the Mistral client.
    """
    from backend.services.mistral_client import embedding_queue, get_client
    
    logger.info("Starting embedding worker...")
    
    while True:
        try:
            # Get the next item from the queue
            item = await embedding_queue.get()
            
            if item is None:
                # None is used as a signal to stop the worker
                logger.info("Received stop signal, shutting down embedding worker")
                break
                
            # Process the embedding request
            text, callback = item
            
            # Get the Mistral client
            client = await get_client()
            
            # Generate embeddings
            embeddings = await client.create_embeddings([text])
            
            # Call the callback with the result if provided
            if callback and embeddings:
                await callback(embeddings[0])
                
            # Mark the task as done
            embedding_queue.task_done()
            
        except asyncio.CancelledError:
            logger.info("Embedding worker cancelled")
            break
        except Exception as e:
            logger.error(f"Error in embedding worker: {e}")
            # Mark the task as done even if it failed
            embedding_queue.task_done()
            
    logger.info("Embedding worker stopped")