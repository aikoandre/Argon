import json
import sqlite3
import uuid
from datetime import datetime

# Load the original NemoEngine file
with open('../NemoEngine v5.8 (Experimental) (Deepseek) V3.json', 'r', encoding='utf-8') as f:
    original_data = json.load(f)

# Connect to database
conn = sqlite3.connect('../are_database.db')
cursor = conn.cursor()

# Create a default preset first
preset_id = str(uuid.uuid4())
cursor.execute("""
    INSERT OR REPLACE INTO prompt_presets (id, name, description, is_sillytavern_compatible, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
""", (
    preset_id,
    "NemoEngine v5.8",
    "Default NemoEngine preset with full module names",
    True,
    True,
    datetime.now().isoformat(),
    datetime.now().isoformat()
))

# Extract and insert modules from the JSON
modules_added = 0
if 'prompts' in original_data:
    for prompt in original_data['prompts']:
        module_id = str(uuid.uuid4())
        
        # Map SillyTavern structure to our structure
        identifier = prompt.get('identifier', f'module_{modules_added}')
        name = prompt.get('name', f'Module {modules_added}')
        content = prompt.get('content', '')
        role = prompt.get('role', 'system')
        injection_position = prompt.get('injection_position', 0)
        injection_depth = prompt.get('injection_depth', 4)
        injection_order = prompt.get('injection_order', 0)
        forbid_overrides = prompt.get('forbid_overrides', False)
        
        # Determine category based on content/name
        category = 'utility'  # default
        if 'core' in name.lower() or 'main' in identifier.lower() or 'system' in name.lower():
            category = 'core'
        elif 'style' in name.lower() or 'narrative' in name.lower():
            category = 'style'
        elif 'instruction' in name.lower() or 'constraint' in name.lower():
            category = 'stance'
        
        # Determine applicable services based on content/purpose
        applicable_services = ['generation']  # default to generation
        if 'analysis' in name.lower() or 'interpret' in name.lower():
            applicable_services.append('analysis')
        if 'maintenance' in name.lower():
            applicable_services.append('maintenance')
        if 'embedding' in name.lower():
            applicable_services.append('embedding')
        
        # Insert the module
        cursor.execute("""
            INSERT OR REPLACE INTO prompt_modules (
                id, preset_id, identifier, name, category, content, enabled,
                injection_position, injection_depth, injection_order, forbid_overrides, role,
                applicable_services, is_core_module, service_priority, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            module_id, preset_id, identifier, name, category, content, True,
            injection_position, injection_depth, injection_order, forbid_overrides, role,
            json.dumps(applicable_services), identifier == 'main', injection_order,
            datetime.now().isoformat(), datetime.now().isoformat()
        ))
        
        modules_added += 1
        print(f"Added module: {name} (length: {len(name)})")

conn.commit()
conn.close()

print(f"\nCreated preset '{preset_id}' with {modules_added} modules")
print("All module names are stored in full length in the database.")
