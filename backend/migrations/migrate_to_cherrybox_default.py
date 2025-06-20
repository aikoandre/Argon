#!/usr/bin/env python3
"""
Migration Script: Replace NemoEngine with CherryBox as Default Preset
Created: June 19, 2025
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from db.database import get_db
from services.sillytavern_import_service import sillytavern_import_service
from models.prompt_preset import PromptPreset, UserPromptConfiguration

# Import all models to resolve SQLAlchemy relationships
from models.active_session_event import ActiveSessionEvent
from models.chat_session import ChatSession
from models.user_settings import UserSettings
from models.lore_entry import LoreEntry
from models.session_note import SessionNote
from models.character_card import CharacterCard
from models.scenario_card import ScenarioCard
from models.user_persona import UserPersona
from models.chat_message import ChatMessage
from models.maintenance_queue import MaintenanceQueue

import uuid
from datetime import datetime

def migrate_to_cherrybox():
    """
    Main migration function to replace NemoEngine with CherryBox as default preset
    """
    
    db = next(get_db())
    
    try:
        print("🚀 Starting CherryBox Migration...")
        print("=" * 60)
        
        # Step 1: Remove default flag from existing presets
        print("\n📋 Step 1: Removing default flag from existing presets...")
        existing_defaults = db.query(PromptPreset).filter(PromptPreset.is_default == True).all()
        for preset in existing_defaults:
            preset.is_default = False
            print(f"   Removed default flag from: {preset.name}")
        
        db.commit()
        
        # Step 2: Check if CherryBox already exists
        print("\n📋 Step 2: Checking for existing CherryBox preset...")
        existing_cherrybox = db.query(PromptPreset).filter(
            PromptPreset.name == "CherryBox Argon Edition"
        ).first()
        
        if existing_cherrybox:
            print(f"   ✅ Found existing CherryBox preset: {existing_cherrybox.id}")
            cherrybox_preset = existing_cherrybox
            cherrybox_preset.is_default = True
        else:
            # Step 3: Create new CherryBox preset
            print("\n📋 Step 3: Creating new CherryBox preset...")
            cherrybox_preset = sillytavern_import_service.create_cherrybox_preset(db)
            print(f"   ✅ Created CherryBox preset: {cherrybox_preset.id}")
            print(f"   📋 Preset contains {len(cherrybox_preset.modules)} modules")
        
        db.commit()
        
        # Step 4: Update CherryBox parameters (from original CherryBox_1.4.json)
        print("\n📋 Step 4: Applying CherryBox parameter defaults...")
        cherrybox_parameters = {
            'temperature': 0.6,
            'top_p': 0.98,
            'top_k': 28,
            'frequency_penalty': 0.15,
            'presence_penalty': 0.17,
            'max_tokens': 5000,
            'context_size': 51200
        }
        
        print("   📊 CherryBox Parameters:")
        for param, value in cherrybox_parameters.items():
            print(f"     {param}: {value}")
        
        # Step 5: Migrate all existing users to CherryBox
        print("\n📋 Step 5: Migrating existing users to CherryBox...")
        user_configs = db.query(UserPromptConfiguration).all()
        
        migrated_count = 0
        for config in user_configs:
            old_preset_id = config.active_preset_id
            config.active_preset_id = cherrybox_preset.id
            
            # Apply CherryBox parameters
            config.temperature = cherrybox_parameters['temperature']
            config.top_p = cherrybox_parameters['top_p']
            config.top_k = cherrybox_parameters['top_k']
            config.frequency_penalty = cherrybox_parameters['frequency_penalty']
            config.presence_penalty = cherrybox_parameters['presence_penalty']
            config.max_tokens = cherrybox_parameters['max_tokens']
            
            # Note: context_size is for messages, not tokens - keep reasonable default
            if not config.context_size or config.context_size < 20:
                config.context_size = 20
            
            config.updated_at = datetime.utcnow()
            
            migrated_count += 1
            print(f"   👤 Migrated user {config.user_id}: {old_preset_id} → {cherrybox_preset.id}")
        
        db.commit()
        
        # Step 6: Create default user configuration if none exists
        print("\n📋 Step 6: Ensuring default user configuration exists...")
        default_config = db.query(UserPromptConfiguration).filter(
            UserPromptConfiguration.user_id == 1
        ).first()
        
        if not default_config:
            default_config = UserPromptConfiguration(
                id=str(uuid.uuid4()),
                user_id=1,
                active_preset_id=cherrybox_preset.id,
                **cherrybox_parameters,
                reasoning_effort="Medium",
                context_size=20
            )
            db.add(default_config)
            db.commit()
            print("   ✅ Created default user configuration with CherryBox")
        else:
            print("   ✅ Default user configuration already exists")
        
        # Step 7: Summary
        print("\n" + "=" * 60)
        print("🎉 CherryBox Migration Complete!")
        print(f"✅ CherryBox preset ID: {cherrybox_preset.id}")
        print(f"✅ Migrated {migrated_count} user configurations")
        print(f"✅ Applied CherryBox parameter defaults")
        print(f"✅ Module breakdown:")
        
        # Count modules by service
        module_counts = {}
        for module in cherrybox_preset.modules:
            services = []
            if module.applicable_services:
                try:
                    import json
                    services = json.loads(module.applicable_services)
                except:
                    services = [module.applicable_services] if module.applicable_services else []
            
            for service in services:
                module_counts[service] = module_counts.get(service, 0) + 1
        
        for service, count in module_counts.items():
            print(f"     {service.title()}: {count} modules")
        
        print("\n🔧 Next Steps:")
        print("   1. Restart the backend server")
        print("   2. Refresh the frontend to see CherryBox as default")
        print("   3. Test roleplay functionality with new modules")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

def rollback_migration():
    """
    Rollback function to restore NemoEngine as default (if needed)
    """
    
    db = next(get_db())
    
    try:
        print("🔄 Rolling back CherryBox migration...")
        
        # Find NemoEngine preset
        nemo_preset = db.query(PromptPreset).filter(
            PromptPreset.name.like("%NemoEngine%")
        ).first()
        
        if nemo_preset:
            # Remove default from CherryBox
            cherrybox_preset = db.query(PromptPreset).filter(
                PromptPreset.name == "CherryBox Argon Edition"
            ).first()
            
            if cherrybox_preset:
                cherrybox_preset.is_default = False
            
            # Set NemoEngine as default
            nemo_preset.is_default = True
            
            # Optionally migrate users back (would need to store original parameters)
            print(f"✅ Restored NemoEngine as default: {nemo_preset.id}")
        else:
            print("❌ No NemoEngine preset found for rollback")
        
        db.commit()
        return True
        
    except Exception as e:
        print(f"❌ Rollback failed: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="CherryBox Migration Tool")
    parser.add_argument("--rollback", action="store_true", help="Rollback to NemoEngine")
    args = parser.parse_args()
    
    if args.rollback:
        success = rollback_migration()
    else:
        success = migrate_to_cherrybox()
    
    exit(0 if success else 1)
