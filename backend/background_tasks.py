# backend/background_tasks.py
import asyncio
import logging
from typing import Dict, Any, Optional
import os # Import os for environment variables

from db.database import get_db
from models.chat_session import ChatSession
from models.user_persona import UserPersona
from models.character_card import CharacterCard
from models.scenario_card import ScenarioCard

from db.database import get_db
from models.chat_session import ChatSession
from models.user_persona import UserPersona
from models.character_card import CharacterCard
from models.scenario_card import ScenarioCard
from sqlalchemy.orm import joinedload

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def embedding_worker():
    """Background worker that processes embedding requests from the queue.
    
    This worker continuously checks the embedding_queue for new embedding requests
    and processes them using the Mistral client.
    """
    from services.mistral_client import embedding_queue  # Keep only the queue
    # MistralClient removed - now using LiteLLM service for embeddings
    from db.database import get_db
    from models.lore_entry import LoreEntry as LoreEntryModel
    from models.extracted_knowledge import ExtractedKnowledge as ExtractedKnowledgeModel
    from services.faiss_service import get_faiss_index
    
    logger.info("Starting embedding worker...")
    
    # mistral_client removed - now using LiteLLM service for embeddings
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
            mistral_api_key = user_settings.mistral_api_key if user_settings else None

            if not mistral_api_key:
                logger.error(f"Mistral API key not found for embedding {item_type} ID: {item_id}. Skipping embedding.")
                embedding_queue.task_done()
                continue


            # Generate embeddings using LiteLLM service
            from backend.services.litellm_service import litellm_service
            
            # Convert user settings to dictionary format for LiteLLM
            user_settings_dict = {
                "embedding_llm_provider": getattr(user_settings, "embedding_llm_provider", "mistral"),
                "embedding_llm_model": getattr(user_settings, "embedding_llm_model", "mistral-embed"),
                "embedding_llm_api_key": getattr(user_settings, "embedding_llm_api_key", None) or mistral_api_key,
            }
            
            try:
                embeddings = await litellm_service.get_service_completion(
                    service_type="embedding",
                    messages=[],  # Not used for embedding
                    user_settings=user_settings_dict,
                    input_text=text_to_embed
                )
            except Exception as e:
                logger.error(f"Failed to generate embedding using LiteLLM service: {e}")
                embeddings = None
            
            if embeddings and len(embeddings) > 0:
                embedding_vector = embeddings[0]
                
                if item_type == "lore_entry":
                    lore_entry = db.query(LoreEntryModel).filter(LoreEntryModel.id == item_id).first()
                    if lore_entry:
                        lore_entry.embedding_vector = embedding_vector
                        logger.debug(f"LoreEntry ID: {item_id} - Before db.add")
                        db.add(lore_entry)
                        logger.debug(f"LoreEntry ID: {item_id} - Before db.commit")
                        db.commit()
                        logger.debug(f"LoreEntry ID: {item_id} - Before db.refresh")
                        db.refresh(lore_entry)
                        logger.debug(f"LoreEntry ID: {item_id} - Before faiss_index.add_embedding")
                        await faiss_index.add_embedding(item_id, embedding_vector) # Add or update in FAISS
                        logger.debug(f"LoreEntry ID: {item_id} - After faiss_index.add_embedding")
                        logger.info(f"LoreEntry ID: {item_id} embedding updated and added to FAISS. Attempting to mark task done.")
                    else:
                        logger.warning(f"LoreEntry with ID {item_id} not found for embedding update.")
                elif item_type == "extracted_knowledge":
                    extracted_knowledge = db.query(ExtractedKnowledgeModel).filter(ExtractedKnowledgeModel.id == item_id).first()
                    if extracted_knowledge:
                        extracted_knowledge.embedding_vector = embedding_vector
                        logger.debug(f"ExtractedKnowledge ID: {item_id} - Before db.add")
                        db.add(extracted_knowledge)
                        logger.debug(f"ExtractedKnowledge ID: {item_id} - Before db.commit")
                        db.commit()
                        logger.debug(f"ExtractedKnowledge ID: {item_id} - Before db.refresh")
                        db.refresh(extracted_knowledge)
                        # No FAISS for ExtractedKnowledge for now, but could be added if needed
                        logger.info(f"ExtractedKnowledge ID: {item_id} embedding updated. Attempting to mark task done.")
                    else:
                        logger.warning(f"ExtractedKnowledge with ID {item_id} not found for embedding update.")
                else:
                    logger.warning(f"Unknown item type '{item_type}' for embedding task ID: {item_id}.")
            else:
                logger.error(f"Failed to generate embedding for {item_type} ID: {item_id}.")
                
            # Mark the task as done
            logger.debug(f"LoreEntry ID: {item_id} - Before embedding_queue.task_done")
            embedding_queue.task_done()
            logger.debug(f"LoreEntry ID: {item_id} - After embedding_queue.task_done")
            
        except asyncio.CancelledError:
            logger.info("Embedding worker cancelled")
            break
        except Exception as e:
            logger.error(f"Error in embedding worker for task {task_data}: {e}")
            # Mark the task as done even if it failed
            logger.debug(f"LoreEntry ID: {item_id} - Before embedding_queue.task_done (in exception)")
            embedding_queue.task_done()
            logger.debug(f"LoreEntry ID: {item_id} - After embedding_queue.task_done (in exception)")
        finally:
            logger.debug(f"LoreEntry ID: {task_data.get('id') if task_data else 'N/A'} - Before db.close")
            db.close() # Close the DB session
            logger.debug(f"LoreEntry ID: {task_data.get('id') if task_data else 'N/A'} - After db.close")
            
    logger.info("Embedding worker stopped")

from backend.services.interaction_analysis_service import InteractionAnalysisService
from backend.schemas.ai_analysis_result import InteractionAnalysisResult
# OpenRouterClient import removed - now using LiteLLM service

async def run_full_interaction_analysis(
    db, # Pass the SQLAlchemy session directly
    chat_id: str,
    user_message: str,
    ai_response: str,
    rag_results: list[Dict[str, Any]],
    ai_plan: Optional[Dict[str, Any]],
    ai_persona_card_data: Dict[str, Any],
    user_persona_data: Dict[str, Any],
    active_event_details: Optional[Dict[str, Any]],
    analysis_llm_api_key: str, # Kept for backward compatibility but will be extracted from user_settings
    analysis_llm_model: str # Kept for backward compatibility but will be extracted from user_settings
):
    """
    Runs the full interaction analysis LLM and updates session state synchronously.
    This function is designed to be awaited directly.
    """
    if not analysis_llm_api_key:
        logger.error("Analysis LLM API key not provided for full interaction analysis. Skipping analysis.")
        return

    try:
        # Re-fetch ChatSession and related objects within this new session
        db_chat_session = db.query(ChatSession).options(joinedload(ChatSession.user_persona)).filter(ChatSession.id == chat_id).first()
        if not db_chat_session:
            logger.error(f"Chat session {chat_id} not found for full analysis.")
            return

        user_persona = db_chat_session.user_persona
        if not user_persona:
            user_persona = db.query(UserPersona).filter(UserPersona.name == "User").first()
            if not user_persona:
                logger.warning("Default 'User' persona not found for full analysis. Using placeholder.")
                class PlaceholderUserPersona:
                    name = "User"
                    description = "A generic user."
                    image_url = None
                user_persona = PlaceholderUserPersona()

        ai_persona_card = None
        if db_chat_session.card_type == "character":
            ai_persona_card = db.query(CharacterCard).filter(CharacterCard.id == db_chat_session.card_id).first()
        elif db_chat_session.card_type == "scenario":
            ai_persona_card = db.query(ScenarioCard).filter(ScenarioCard.id == db_chat_session.card_id).first()
        
        if not ai_persona_card:
            logger.error(f"{db_chat_session.card_type.capitalize()} card not found for session {chat_id} during full analysis.")
            return

        # Get user settings for LiteLLM service
        from backend.models.user_settings import UserSettings
        USER_SETTINGS_ID = 1  # Global ID for the single settings row
        user_settings_obj = db.query(UserSettings).filter(UserSettings.id == USER_SETTINGS_ID).first()
        
        if not user_settings_obj:
            logger.error("User settings not found for full interaction analysis. Skipping analysis.")
            return
            
        # Convert to dictionary for LiteLLM service
        user_settings = {
            # Analysis LLM configuration
            "analysis_llm_provider": getattr(user_settings_obj, "analysis_llm_provider", "openrouter"),
            "analysis_llm_model": getattr(user_settings_obj, "analysis_llm_model_new", None) or getattr(user_settings_obj, "analysis_llm_model", analysis_llm_model),
            "analysis_llm_api_key": getattr(user_settings_obj, "analysis_llm_api_key_new", None) or getattr(user_settings_obj, "analysis_llm_api_key", analysis_llm_api_key),
            "analysis_llm_model_new": getattr(user_settings_obj, "analysis_llm_model_new", None),
            "analysis_llm_api_key_new": getattr(user_settings_obj, "analysis_llm_api_key_new", None),
        }

        # Use updated InteractionAnalysisService with LiteLLM
        analysis_service = InteractionAnalysisService()
        
        context = {
            "user_message": user_message,
            "ai_response": ai_response,
            "rag_results": rag_results,
            "ai_plan": ai_plan,
            "ai_persona_card": {
                "name": ai_persona_card.name,
                "description": ai_persona_card.description,
                "instructions": getattr(ai_persona_card, 'instructions', None)
            },
            "user_persona": {
                "name": user_persona.name,
                "description": user_persona.description
            },
            "active_event_details": active_event_details,
        }
        
        analysis_result = await analysis_service.perform_full_analysis(
            context=context,
            user_settings=user_settings
        )
        
        from backend.services.session_state_update_service import SessionStateUpdateService
        # These services are typically initialized with dependencies.
        # For a synchronous call, they might need to be passed or initialized differently
        # if they rely on a specific event loop or session management.
        # For now, assuming they can be initialized without specific event_manager_service, etc.
        event_manager_service = None
        session_lore_service = None
        embedding_service = None
        faiss_service = None
        update_service = SessionStateUpdateService(
            event_manager_service,
            session_lore_service,
            embedding_service,
            faiss_service
        )
        await update_service.apply_analysis_results(db, chat_id, analysis_result)
        logger.info(f"Full interaction analysis and state update complete for chat_id: {chat_id}")
    except Exception as e:
        logger.error(f"Error in full interaction analysis for chat_id {chat_id}: {e}")
    finally:
        # The DB session is managed by the caller (FastAPI dependency injection)
        # so we don't close it here.
        pass
