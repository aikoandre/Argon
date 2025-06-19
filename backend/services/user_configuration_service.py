# backend/services/user_configuration_service.py
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from models.prompt_preset import UserPromptConfiguration, PromptPreset
from models.user_settings import UserSettings
import logging

logger = logging.getLogger(__name__)

class UserConfigurationService:
    """
    Service to manage user prompt configuration and integrate it with existing user settings
    """
    
    @staticmethod
    async def get_user_prompt_configuration(
        db: Session, 
        user_id: int = 1
    ) -> Optional[UserPromptConfiguration]:
        """Get the user's active prompt configuration"""
        config = db.query(UserPromptConfiguration).filter(
            UserPromptConfiguration.user_id == user_id
        ).first()
        return config
    
    @staticmethod
    async def get_or_create_user_configuration(
        db: Session, 
        user_id: int = 1
    ) -> UserPromptConfiguration:
        """Get or create user prompt configuration with defaults"""
        config = await UserConfigurationService.get_user_prompt_configuration(db, user_id)
        
        if not config:
            # Create default configuration
            config = UserPromptConfiguration(
                user_id=user_id,
                active_preset_id=None,  # Will use default preset
                temperature=1.0,
                top_p=1.0,
                reasoning_effort="Medium",
                context_size=20,
                frequency_penalty=0.0,
                presence_penalty=0.0,
                repetition_penalty=1.0
            )
            db.add(config)
            db.commit()
            db.refresh(config)
            logger.info(f"Created default prompt configuration for user {user_id}")
        
        return config
    
    @staticmethod
    async def get_merged_user_settings(
        db: Session, 
        user_id: int = 1
    ) -> Dict[str, Any]:
        """
        Get merged user settings combining traditional settings with prompt configuration.
        This provides a single source of truth for all LLM parameters.
        """
        # Get traditional user settings
        user_settings = db.query(UserSettings).filter(UserSettings.id == user_id).first()
        if not user_settings:
            raise ValueError(f"User settings not found for user {user_id}")
        
        # Convert to dict
        settings_dict = {
            column.name: getattr(user_settings, column.name)
            for column in user_settings.__table__.columns
        }
        
        # Get prompt configuration
        prompt_config = await UserConfigurationService.get_or_create_user_configuration(db, user_id)
        
        # Override/add prompt-specific parameters
        # Primary LLM parameters from prompt configuration
        settings_dict.update({
            "primary_llm_temperature": prompt_config.temperature,
            "primary_llm_top_p": prompt_config.top_p,
            "primary_llm_reasoning_effort": prompt_config.reasoning_effort,
            "max_messages_for_context": prompt_config.context_size,
            
            # Advanced sampling parameters
            "primary_llm_top_k": prompt_config.top_k,
            "primary_llm_top_a": prompt_config.top_a,
            "primary_llm_min_p": prompt_config.min_p,
            "primary_llm_max_tokens": prompt_config.max_tokens,
            
            # Penalty parameters
            "primary_llm_frequency_penalty": prompt_config.frequency_penalty,
            "primary_llm_presence_penalty": prompt_config.presence_penalty,
            "primary_llm_repetition_penalty": prompt_config.repetition_penalty,
            
            # Active preset information
            "active_preset_id": prompt_config.active_preset_id
        })
        
        return settings_dict
    
    @staticmethod
    async def update_user_configuration(
        db: Session,
        user_id: int,
        updates: Dict[str, Any]
    ) -> UserPromptConfiguration:
        """Update user prompt configuration with new parameters"""
        config = await UserConfigurationService.get_or_create_user_configuration(db, user_id)
        
        # Update allowed fields
        allowed_fields = {
            'active_preset_id', 'temperature', 'top_p', 'top_k', 'top_a', 'min_p',
            'max_tokens', 'frequency_penalty', 'presence_penalty', 'repetition_penalty',
            'reasoning_effort', 'context_size'
        }
        
        for field, value in updates.items():
            if field in allowed_fields and hasattr(config, field):
                setattr(config, field, value)
        
        db.commit()
        db.refresh(config)
        logger.info(f"Updated prompt configuration for user {user_id}: {updates}")
        
        return config

user_configuration_service = UserConfigurationService()
