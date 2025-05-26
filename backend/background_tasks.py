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
    from backend.services.mistral_client import embedding_queue, MistralClient
    from backend.database import get_db
    from backend.models.lore_entry import LoreEntry as LoreEntryModel
    from backend.models.extracted_knowledge import ExtractedKnowledge as ExtractedKnowledgeModel
    from backend.services.faiss_service import get_faiss_index
    
    logger.info("Starting embedding worker...")
    
    mistral_client = MistralClient()
    faiss_index = get_faiss_index()

    while True:
        db = next(get_db()) # Get a new DB session for each task
        try:
            # Get the next item from the queue
            task_data = await embedding_queue.get()
            
            if task_data is None:
                # None is used as a signal to stop the worker
                logger.info("Received stop signal, shutting down embedding worker")
                break
                
            item_id = task_data.get("id")
            item_type = task_data.get("type")
            text_to_embed = task_data.get("text")
            
            if not item_id or not item_type or not text_to_embed:
                logger.error(f"Invalid task data received: {task_data}")
                embedding_queue.task_done()
                continue

            logger.info(f"Processing embedding for {item_type} ID: {item_id}")

            # Generate embeddings
            # Assuming api_key is retrieved from UserSettings, but for background tasks,
            # we might need a more robust way to get it or use a default if not critical.
            # For now, let's assume it's available or handled upstream.
            # For simplicity, we'll use a placeholder for api_key. In a real scenario,
            # you'd fetch it from UserSettings based on a user ID associated with the LoreEntry.
            # For now, we'll use a dummy API key or fetch it from env if available for background processing.
            
            # TODO: Fetch actual Mistral API key from UserSettings for the relevant user.
            # For now, using a placeholder or environment variable.
            from backend.models.user_settings import UserSettings as UserSettingsModel
            user_settings = db.query(UserSettingsModel).first() # Assuming a single user or default settings
            mistral_api_key = user_settings.mistral_api_key if user_settings else os.getenv("MISTRAL_API_KEY")

            if not mistral_api_key:
                logger.error(f"Mistral API key not found for embedding {item_type} ID: {item_id}. Skipping embedding.")
                embedding_queue.task_done()
                continue


            embeddings = mistral_client.create_embeddings([text_to_embed], api_key=mistral_api_key)
            
            if embeddings and len(embeddings) > 0:
                embedding_vector = embeddings[0]
                
                if item_type == "lore_entry":
                    lore_entry = db.query(LoreEntryModel).filter(LoreEntryModel.id == item_id).first()
                    if lore_entry:
                        lore_entry.embedding_vector = embedding_vector
                        db.add(lore_entry)
                        db.commit()
                        db.refresh(lore_entry)
                        faiss_index.add_embedding(item_id, embedding_vector) # Add or update in FAISS
                        logger.info(f"LoreEntry ID: {item_id} embedding updated and added to FAISS.")
                    else:
                        logger.warning(f"LoreEntry with ID {item_id} not found for embedding update.")
                elif item_type == "extracted_knowledge":
                    extracted_knowledge = db.query(ExtractedKnowledgeModel).filter(ExtractedKnowledgeModel.id == item_id).first()
                    if extracted_knowledge:
                        extracted_knowledge.embedding_vector = embedding_vector
                        db.add(extracted_knowledge)
                        db.commit()
                        db.refresh(extracted_knowledge)
                        # No FAISS for ExtractedKnowledge for now, but could be added if needed
                        logger.info(f"ExtractedKnowledge ID: {item_id} embedding updated.")
                    else:
                        logger.warning(f"ExtractedKnowledge with ID {item_id} not found for embedding update.")
                else:
                    logger.warning(f"Unknown item type '{item_type}' for embedding task ID: {item_id}.")
            else:
                logger.error(f"Failed to generate embedding for {item_type} ID: {item_id}.")
                
            # Mark the task as done
            embedding_queue.task_done()
            
        except asyncio.CancelledError:
            logger.info("Embedding worker cancelled")
            break
        except Exception as e:
            logger.error(f"Error in embedding worker for task {task_data}: {e}")
            # Mark the task as done even if it failed
            embedding_queue.task_done()
        finally:
            db.close() # Close the DB session
            
    logger.info("Embedding worker stopped")