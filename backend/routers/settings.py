from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db # Adjust import based on your project structure
from models.user_settings import UserSettings as UserSettingsModel
from schemas.user_settings import UserSettingsInDB, UserSettingsUpdate # Adjust import

router = APIRouter(
    tags=["User Settings"],
    responses={404: {"description": "Not found"}},
)

USER_SETTINGS_ID = 1 # Global ID for the single settings row

@router.get("/settings", response_model=UserSettingsInDB)
async def read_user_settings(db: Session = Depends(get_db)):
    """
    Retrieve user settings.
    If settings do not exist, they are created with default values.
    """
    db_settings = db.query(UserSettingsModel).filter(UserSettingsModel.id == USER_SETTINGS_ID).first()
    if db_settings is None:        # Create settings with default values from the model definition
        db_settings = UserSettingsModel(
            id=USER_SETTINGS_ID,
            llm_provider="OpenRouter",
            selected_llm_model="gpt-4o",
            primary_llm_api_key="",
            analysis_llm_api_key="",
            mistral_api_key="",
            analysis_llm_model="mistral/mistral-large-latest",
            
            # New LiteLLM Provider Configurations
            primary_llm_provider="openrouter",
            primary_llm_model="gpt-4o",
            primary_llm_api_key_new="",
            
            analysis_llm_provider="openrouter", 
            analysis_llm_model_new="gpt-4o",
            analysis_llm_api_key_new="",
            
            maintenance_llm_provider="openrouter",
            maintenance_llm_model="gpt-4o", 
            maintenance_llm_api_key="",
            
            embedding_llm_provider="mistral",
            embedding_llm_model="mistral-embed",
            embedding_llm_api_key="",
            
            generation_prompt_template=(
                "You are {{ai_instructions.name}}, {{ai_instructions.description}}. "
                "Your instructions on how to act are: {{ai_instructions.instructions}}.\n"
                "Examples of how you speak: {{ai_instructions.example_dialogues}}.\n"
                "Initial message (if applicable): {{ai_instructions.beginning_message}}\n\n"
                "You are interacting with {{user_persona_details.name}}, who is: {{user_persona_details.description}}.\n\n"
                "World Context (if applicable): {{world_context_name_and_description}}\n\n"
                "--- Recent Chat History ---\n"
                "{{chat_history}}\n"
                "--- End of History ---\n\n"
                "{{user_persona_details.name}}: {{user_input}}\n"
                "{{ai_instructions.name}}: "
                "**IMPORTANT**: Always complete your response and strictly adhere to your character's instructions and speaking style."
            ),
            language="English",
            temperature=1.0,
            top_p=1.0,
            max_response_tokens=2048,
            context_size=164000,
            active_persona_id=None,
            
            # Service Enable/Disable Toggles
            analysis_enabled=True,
            maintenance_enabled=True,
            embedding_enabled=True,
            
            # Primary LLM Parameters (defaults)
            primary_llm_temperature=1.0,
            primary_llm_top_p=1.0,
            primary_llm_max_tokens=None,
            primary_llm_reasoning_effort="Medium",
            primary_llm_custom_prompt="",
            
            # Analysis LLM Parameters (defaults)
            analysis_llm_temperature=1.0,
            analysis_llm_top_p=1.0,
            analysis_llm_max_tokens=None,
            analysis_llm_reasoning_effort="Medium",
            analysis_llm_custom_prompt="",
            
            # Maintenance LLM Parameters (defaults)
            maintenance_llm_temperature=1.0,
            maintenance_llm_top_p=1.0,
            maintenance_llm_max_tokens=None,
            maintenance_llm_reasoning_effort="Medium",
            maintenance_llm_custom_prompt=""
        )


        db.add(db_settings)
        db.commit()
        db.refresh(db_settings)
    return db_settings

@router.put("/settings", response_model=UserSettingsInDB)
async def update_user_settings(
    settings_update: UserSettingsUpdate,
    db: Session = Depends(get_db)
):
    """
    Update user settings.
    """
    db_settings = db.query(UserSettingsModel).filter(UserSettingsModel.id == USER_SETTINGS_ID).first()
    if db_settings is None:
        # Should ideally be created by a GET request first, or handle creation here too.
        # For simplicity, let's assume GET is called first or create if not found.
        db_settings = UserSettingsModel(id=USER_SETTINGS_ID)
        db.add(db_settings)
        # If creating new, you might want to apply initial defaults before updating

    update_data = settings_update.model_dump(exclude_unset=True) # Pydantic V2

    for key, value in update_data.items():
        setattr(db_settings, key, value)

    db.commit()
    db.refresh(db_settings)
    return db_settings
