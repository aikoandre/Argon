from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db # Adjust import based on your project structure
from backend.models.user_settings import UserSettings as UserSettingsModel
from backend.schemas.user_settings import UserSettingsInDB, UserSettingsUpdate # Adjust import

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
    if db_settings is None:
        # Create settings with default values from the model definition
        db_settings = UserSettingsModel(
            id=USER_SETTINGS_ID,
            llm_provider="OpenRouter",
            selected_llm_model="gpt-4o",
            llm_api_key="",
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
            temperature=1.0, # Ensure float consistency
            top_p=1.0,
            max_response_tokens=2048,
            context_size=164000,
            active_persona_id=None
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
