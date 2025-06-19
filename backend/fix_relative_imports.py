#!/usr/bin/env python3
"""Fix relative import issues in all model files"""

import os

# Files to fix
model_files = [
    "scenario_card.py",
    "user_persona.py",
    "master_world.py", 
    "session_relationship.py",
    "lore_entry.py",
    "extracted_knowledge.py",
    "character_card.py",
    "active_session_event.py"
]

backend_dir = "d:/Archives/VSCode/Argon/backend/models"

for filename in model_files:
    filepath = os.path.join(backend_dir, filename)
    if os.path.exists(filepath):
        print(f"Fixing {filename}...")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace the relative import
        updated_content = content.replace(
            "from ..database import Base",
            "from db.database import Base"
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        
        print(f"✅ Fixed {filename}")
    else:
        print(f"❌ File not found: {filename}")

print("✅ All relative imports fixed!")
