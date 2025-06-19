import logging
from fastapi import APIRouter, Depends, HTTPException, Body, Form, Path
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, cast, String # Import or_, and_, cast, String for OR conditions and database functions
from typing import List, Dict
import json # Import json for parsing the data string
import os # Import os for path manipulation
from services.faiss_service import get_faiss_index # New import for FAISS
from services.litellm_service import litellm_service # LiteLLM service for embeddings

logger = logging.getLogger(__name__)

# Adjust these imports based on your actual project structure
from db.database import get_db
from models.user_settings import UserSettings as UserSettingsModel # Ensure this is imported
from models.lore_entry import LoreEntry as LoreEntryModel
from schemas.lore_entry import LoreEntryCreate, LoreEntryUpdate, LoreEntryInDB

router = APIRouter(
    prefix="/api/master_worlds/{master_world_id}/lore_entries", # Corrected to match frontend
    tags=["Lore Entries"],
    responses={404: {"description": "Not found"}},
)

# Additional router for getting all lore entries across all master worlds
all_lore_router = APIRouter(
    prefix="/api/lore_entries",
    tags=["Lore Entries"],
    responses={404: {"description": "Not found"}},
)

USER_SETTINGS_ID = 1 # Assuming global settings for UserSettings

# The following functions and imports are related to embedding generation and FAISS,
# which are no longer needed for the direct string search functionality.
# They are commented out or removed as per the revised plan.

def get_text_to_embed_from_lore_entry(lore_entry: LoreEntryModel) -> str:
    """
    Helper function to construct the text that will be embedded from a LoreEntry.
    Customize this based on which fields are most important for semantic search.
    """
    parts = [f"Name: {lore_entry.name}"]
    if lore_entry.description:
        parts.append(f"Description: {lore_entry.description}")
    if lore_entry.entry_type:
        parts.append(f"Type: {lore_entry.entry_type}")
    if lore_entry.tags and isinstance(lore_entry.tags, list):
        parts.append("Tags: " + ", ".join(lore_entry.tags))
    if lore_entry.aliases and isinstance(lore_entry.aliases, list):
        parts.append("Aliases: " + ", ".join(lore_entry.aliases))
    
    # Combine parts with a clear separator, e.g., newline or period and space
    return "\n".join(parts)


@router.post("/", response_model=LoreEntryInDB)
async def create_lore_entry( # Renamed for clarity
    master_world_id: str,
    data: str = Form(...), # Expect JSON string for LoreEntryCreate
    db: Session = Depends(get_db)
):
    try:
        lore_entry_create = LoreEntryCreate.model_validate(json.loads(data))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for 'data' field.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid data format: {e}")

    # Ensure master_world_id from path is used in the object if not in schema
    # Or that lore_entry_create.master_world_id matches path master_world_id
    if lore_entry_create.master_world_id != master_world_id:
        raise HTTPException(status_code=400, detail="Path master_world_id does not match payload master_world_id.")

    # Create the LoreEntry object
    db_lore_entry = LoreEntryModel(**lore_entry_create.model_dump())
    
    db.add(db_lore_entry)
    db.commit()
    db.refresh(db_lore_entry)

    # Generate text for embedding and add to FAISS
    text_to_embed = get_text_to_embed_from_lore_entry(db_lore_entry)
    
    print(f"LoreEntry '{db_lore_entry.name}' (ID: {db_lore_entry.id}) created. Generating embedding...")
    try:
        # Get user settings for embedding generation
        db_settings = db.query(UserSettingsModel).filter(UserSettingsModel.id == USER_SETTINGS_ID).first()
        if db_settings:
            user_settings_dict = {
                "embedding_llm_provider": getattr(db_settings, "embedding_llm_provider", "mistral"),
                "embedding_llm_model": getattr(db_settings, "embedding_llm_model", "mistral-embed"),
                "embedding_llm_api_key": getattr(db_settings, "embedding_llm_api_key", None) or db_settings.mistral_api_key,
            }
            
            # Generate embedding using LiteLLM service
            embeddings = await litellm_service.get_service_completion(
                service_type="embedding",
                messages=[],  # Not used for embedding
                user_settings=user_settings_dict,
                input_text=text_to_embed
            )
            
            if embeddings and len(embeddings) > 0:
                embedding_vector = embeddings[0]
                
                # Store embedding in database
                db_lore_entry.embedding_vector = embedding_vector
                db.add(db_lore_entry)
                db.commit()
                db.refresh(db_lore_entry)
                
                # Add to FAISS index
                faiss_index = get_faiss_index()
                await faiss_index.add_embedding(str(db_lore_entry.id), embedding_vector)
                
                print(f"Embedding generated and added to FAISS for LoreEntry '{db_lore_entry.name}'.")
            else:
                print(f"Failed to generate embedding for LoreEntry '{db_lore_entry.name}'.")
        else:
            print(f"User settings not found. Skipping embedding for LoreEntry '{db_lore_entry.name}'.")
    except Exception as e:
        print(f"Error generating embedding for new LoreEntry '{db_lore_entry.name}': {e}")
        # For now, we'll let the LoreEntry be created without its embedding in case of error.

    return db_lore_entry


@router.get("/", response_model=List[LoreEntryInDB])
async def get_all_lore_entries_for_master_world(
    master_world_id: str = Path(..., title="The ID of the master world"),
    entry_type: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(LoreEntryModel).filter(LoreEntryModel.master_world_id == master_world_id)
    if entry_type:
        query = query.filter(LoreEntryModel.entry_type == entry_type)
    
    lore_entries = query.all()
    return lore_entries


@router.put("/{lore_entry_id}", response_model=LoreEntryInDB)
async def update_lore_entry( # Renamed for clarity
    master_world_id: str,
    lore_entry_id: str,
    data: str = Form(...), # Expect JSON string for LoreEntryUpdate
    db: Session = Depends(get_db)
):
    try:
        lore_entry_update = LoreEntryUpdate.model_validate(json.loads(data))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for 'data' field.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid data format: {e}")

    db_lore_entry = db.query(LoreEntryModel).filter(LoreEntryModel.id == lore_entry_id, LoreEntryModel.master_world_id == master_world_id).first()
    if not db_lore_entry:
        raise HTTPException(status_code=404, detail="LoreEntry not found")

    # Update the LoreEntry fields
    update_data = lore_entry_update.model_dump(exclude_unset=True)
    text_content_changed = False
    for key, value in update_data.items():
        if hasattr(db_lore_entry, key) and getattr(db_lore_entry, key) != value:
            if key in ["name", "description", "entry_type", "tags", "aliases"]: # Fields relevant for embedding
                text_content_changed = True
            setattr(db_lore_entry, key, value)
    
    db.commit()
    db.refresh(db_lore_entry)

    if text_content_changed:
        text_to_embed = get_text_to_embed_from_lore_entry(db_lore_entry)
        print(f"LoreEntry '{db_lore_entry.name}' (ID: {db_lore_entry.id}) updated with text changes. Generating embedding...")
        try:
            # Get user settings for embedding generation
            db_settings = db.query(UserSettingsModel).filter(UserSettingsModel.id == USER_SETTINGS_ID).first()
            if db_settings:
                user_settings_dict = {
                    "embedding_llm_provider": getattr(db_settings, "embedding_llm_provider", "mistral"),
                    "embedding_llm_model": getattr(db_settings, "embedding_llm_model", "mistral-embed"),
                    "embedding_llm_api_key": getattr(db_settings, "embedding_llm_api_key", None) or db_settings.mistral_api_key,
                }
                
                # Generate embedding using LiteLLM service
                embeddings = await litellm_service.get_service_completion(
                    service_type="embedding",
                    messages=[],  # Not used for embedding
                    user_settings=user_settings_dict,
                    input_text=text_to_embed
                )
                
                if embeddings and len(embeddings) > 0:
                    embedding_vector = embeddings[0]
                    
                    # Store embedding in database
                    db_lore_entry.embedding_vector = embedding_vector
                    db.add(db_lore_entry)
                    db.commit()
                    db.refresh(db_lore_entry)
                    
                    # Update in FAISS index
                    faiss_index = get_faiss_index()
                    await faiss_index.update_embedding(str(db_lore_entry.id), embedding_vector)
                    
                    print(f"Embedding updated in FAISS for LoreEntry '{db_lore_entry.name}'.")
                else:
                    print(f"Failed to generate embedding for updated LoreEntry '{db_lore_entry.name}'.")
            else:
                print(f"User settings not found. Skipping embedding for updated LoreEntry '{db_lore_entry.name}'.")
        except Exception as e:
            print(f"Error generating embedding for updated LoreEntry '{db_lore_entry.name}': {e}")
    else:
        print(f"LoreEntry '{db_lore_entry.name}' updated. Skipping embedding regeneration.")

    logger.info(f"LoreEntry '{db_lore_entry.name}' (ID: {db_lore_entry.id}) update process completed. Returning response.")
    return db_lore_entry


@router.delete("/{lore_entry_id}", status_code=204)
async def delete_lore_entry(
    lore_entry_id: str,
    master_world_id: str, # Ensure master_world_id is passed for context
    db: Session = Depends(get_db)
):
    db_lore_entry = db.query(LoreEntryModel).filter(LoreEntryModel.id == lore_entry_id, LoreEntryModel.master_world_id == master_world_id).first()
    if not db_lore_entry:
        raise HTTPException(status_code=404, detail="LoreEntry not found")
    
    # Remove embedding from FAISS index
    faiss_index = get_faiss_index()
    faiss_index.remove_embedding(db_lore_entry.id)
    print(f"Embedding for lore_entry_id: {db_lore_entry.id} removed from FAISS.")

    db.delete(db_lore_entry)
    db.commit()
    return {"message": "LoreEntry deleted successfully"}


@router.post("/search", response_model=List[LoreEntryInDB])
async def search_lore_entries(
    master_world_id: str,
    query: Dict[str, str] = Body(..., embed=True), # Expects {"query_text": "your search query"}
    db: Session = Depends(get_db)
):
    query_text = query.get("query_text")
    if not query_text:
        raise HTTPException(status_code=400, detail="Query text is required for search.")

    # Get user settings for embedding generation
    db_settings = db.query(UserSettingsModel).filter(UserSettingsModel.id == USER_SETTINGS_ID).first()
    if not db_settings:
        raise HTTPException(status_code=500, detail="User settings not configured.")

    # Generate embedding for the query using LiteLLM service
    user_settings_dict = {
        "embedding_llm_provider": getattr(db_settings, "embedding_llm_provider", "mistral"),
        "embedding_llm_model": getattr(db_settings, "embedding_llm_model", "mistral-embed"),
        "embedding_llm_api_key": getattr(db_settings, "embedding_llm_api_key", None) or db_settings.mistral_api_key,
    }
    
    try:
        query_embeddings = await litellm_service.get_service_completion(
            service_type="embedding",
            messages=[],  # Not used for embedding
            user_settings=user_settings_dict,
            input_text=query_text
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate embedding for the query: {str(e)}")
    
    if not query_embeddings:
        raise HTTPException(status_code=500, detail="Failed to generate embedding for the query.")
    
    query_embedding = query_embeddings[0]

    # Perform semantic search using FAISS
    faiss_index = get_faiss_index()
    # You might want to make 'k' configurable, e.g., as a query parameter
    similar_lore_entries_faiss = faiss_index.search_similar(query_embedding, k=10)

    # Extract lore_entry_ids from FAISS results
    lore_entry_ids = [lore_id for lore_id, _ in similar_lore_entries_faiss]

    if not lore_entry_ids:
        return []

    # Retrieve full LoreEntry objects from the database, filtered by master_world_id
    # and ordered by similarity (if needed, requires more complex query or manual sorting)
    lore_entries = db.query(LoreEntryModel).filter(
        LoreEntryModel.master_world_id == master_world_id,
        LoreEntryModel.id.in_(lore_entry_ids)
    ).all()

    # Optional: Reorder results based on FAISS similarity if necessary
    # Create a dictionary for quick lookup and then sort
    lore_entry_map = {entry.id: entry for entry in lore_entries}
    sorted_lore_entries = []
    for lore_id, _ in similar_lore_entries_faiss:
        if lore_id in lore_entry_map:
            sorted_lore_entries.append(lore_entry_map[lore_id])

    return sorted_lore_entries


# New endpoint to get all lore entries across all master worlds
@all_lore_router.get("/", response_model=List[LoreEntryInDB])
async def get_all_lore_entries(
    entry_type: str | None = None,
    db: Session = Depends(get_db)
):
    """Get all lore entries across all master worlds, optionally filtered by entry_type."""
    query = db.query(LoreEntryModel)
    
    if entry_type:
        query = query.filter(LoreEntryModel.entry_type == entry_type)
    
    lore_entries = query.all()
    return lore_entries
