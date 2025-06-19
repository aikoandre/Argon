# Initialize Default NemoEngine Preset
# Run after database migration to set up default preset

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from db.database import get_db
from backend.services.sillytavern_import_service import SillyTavernImportService
import json
import uuid
from datetime import datetime

def create_default_nemo_engine_preset():
    """Create the default NemoEngine v5.8 preset in the database"""
    
    # Get database session
    db = next(get_db())
    
    try:
        # Initialize the import service
        import_service = SillyTavernImportService()
        
        # Create default NemoEngine preset using the service
        print("Creating default NemoEngine v5.8 preset...")
        
        preset = import_service.create_default_nemo_engine_preset()
        
        # Save to database
        db.add(preset)
        
        # Add all modules to database
        for module in preset.modules:
            db.add(module)
        
        db.commit()
        
        print(f"✅ Successfully created NemoEngine v5.8 preset with ID: {preset.id}")
        print(f"   Created {len(preset.modules)} prompt modules:")
        
        for module in preset.modules:
            print(f"   - {module.category.upper()}: {module.name}")
        
        print("\n🎯 Default preset is now ready for use!")
        
    except Exception as e:
        print(f"❌ Error creating default preset: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

def create_example_user_configuration(user_id: str = "default"):
    """Create example user configuration with optimal parameters"""
    
    from backend.models.prompt_preset import UserPromptConfiguration
    
    db = next(get_db())
    
    try:
        # Check if configuration already exists
        existing = db.query(UserPromptConfiguration).filter(
            UserPromptConfiguration.user_id == user_id
        ).first()
        
        if existing:
            print(f"User configuration already exists for user: {user_id}")
            return
        
        # Get the default preset
        from backend.models.prompt_preset import PromptPreset
        default_preset = db.query(PromptPreset).filter(PromptPreset.is_default == True).first()
        
        if not default_preset:
            print("⚠️ No default preset found. Creating user config without preset.")
        
        # Create user configuration with optimal parameters
        user_config = UserPromptConfiguration(
            id=str(uuid.uuid4()),
            user_id=user_id,
            active_preset_id=default_preset.id if default_preset else None,
            
            # Core parameters with optimal defaults
            temperature=0.9,
            top_p=0.95,
            reasoning_effort="Medium",
            context_size=20,
            
            # Advanced sampling (disabled by default)
            top_k=None,  # Disabled
            top_a=None,  # Disabled
            min_p=None,  # Disabled
            max_tokens=None,  # Auto
            
            # Penalty controls (minimal by default)
            frequency_penalty=0.0,
            presence_penalty=0.0,
            repetition_penalty=1.0
        )
        
        db.add(user_config)
        db.commit()
        
        print(f"✅ Created user configuration for user: {user_id}")
        print("   Parameters set to optimal defaults:")
        print(f"   - Temperature: {user_config.temperature}")
        print(f"   - Top-P: {user_config.top_p}")
        print(f"   - Context Size: {user_config.context_size} messages")
        print(f"   - Active Preset: {default_preset.name if default_preset else 'None'}")
        
    except Exception as e:
        print(f"❌ Error creating user configuration: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Initializing Modular Prompt System...")
    print("=" * 50)
    
    # Step 1: Create default NemoEngine preset
    create_default_nemo_engine_preset()
    
    print("\n" + "=" * 50)
    
    # Step 2: Create example user configuration
    create_example_user_configuration()
    
    print("\n" + "=" * 50)
    print("🎉 Initialization complete!")
    print("\nNext steps:")
    print("1. Start the Argon application")
    print("2. Navigate to a chat session")
    print("3. Check the left panel for NemoEngine v5.8 preset")
    print("4. Adjust parameters and toggle modules as desired")
