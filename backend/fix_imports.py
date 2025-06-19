#!/usr/bin/env python3
"""Fix import issues in all model files"""

import os
import glob

# Files to fix
model_files = [
    "user_prompt_instructions.py",
    "temp_variant_memory.py", 
    "temp_variant_analysis.py",
    "temp_message_variant.py",
    "session_note.py",
    "full_analysis_result.py",
    "chat_message.py"
]

backend_dir = "d:/Archives/VSCode/Argon/backend/models"

for filename in model_files:
    filepath = os.path.join(backend_dir, filename)
    if os.path.exists(filepath):
        print(f"Fixing {filename}...")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace the import
        updated_content = content.replace(
            "from backend.database import Base",
            "from db.database import Base"
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        
        print(f"✅ Fixed {filename}")
    else:
        print(f"❌ File not found: {filename}")

print("✅ All imports fixed!")
