#!/usr/bin/env python3
"""Fix all backend imports in router files"""

import os
import glob

# Get all router files
router_dir = "d:/Archives/VSCode/Argon/backend/routers"
router_files = glob.glob(os.path.join(router_dir, "*.py"))

# Also fix other backend files that might have imports
other_dirs = [
    "d:/Archives/VSCode/Argon/backend/services",
    "d:/Archives/VSCode/Argon/backend/schemas", 
    "d:/Archives/VSCode/Argon/backend/utils"
]

all_files = router_files
for dir_path in other_dirs:
    if os.path.exists(dir_path):
        all_files.extend(glob.glob(os.path.join(dir_path, "*.py")))

replacements = [
    ("from backend.database import", "from db.database import"),
    ("from backend.db.database import", "from db.database import"),
    ("from backend.models.", "from models."),
    ("from backend.schemas.", "from schemas."),
    ("from backend.services.", "from services."),
    ("from backend.utils.", "from utils."),
    ("from backend.routers.", "from routers.")
]

for filepath in all_files:
    if os.path.exists(filepath):
        filename = os.path.basename(filepath)
        print(f"Processing {filename}...")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply all replacements
        for old_import, new_import in replacements:
            content = content.replace(old_import, new_import)
        
        # Only write if content changed
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Fixed {filename}")
        else:
            print(f"➖ No changes needed for {filename}")

print("✅ All backend imports fixed!")
