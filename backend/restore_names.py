import sqlite3
import json

# Load the original NemoEngine file
with open('../NemoEngine v5.8 (Experimental) (Deepseek) V3.json', 'r', encoding='utf-8') as f:
    original_data = json.load(f)

# Connect to database
conn = sqlite3.connect('../are_database.db')
cursor = conn.cursor()

# Extract the original module names from the JSON
original_modules = {}
if 'prompts' in original_data:
    for prompt in original_data['prompts']:
        if 'identifier' in prompt and 'name' in prompt:
            original_modules[prompt['identifier']] = prompt['name']

print(f"Found {len(original_modules)} original modules in JSON file")

# Get current modules from database
cursor.execute("SELECT id, identifier, name FROM prompt_modules")
current_modules = cursor.fetchall()

updated_count = 0
for module_id, identifier, current_name in current_modules:
    if identifier in original_modules:
        original_name = original_modules[identifier]
        
        # If original name is longer than 22 chars, truncate to 19 + "..."
        if len(original_name) > 22:
            new_name = original_name[:19] + "..."
        else:
            new_name = original_name
        
        # Only update if the name changed
        if new_name != current_name:
            cursor.execute("UPDATE prompt_modules SET name = ? WHERE id = ?", (new_name, module_id))
            print(f"Updated '{current_name}' -> '{new_name}'")
            updated_count += 1

conn.commit()
conn.close()

print(f"\nRestored {updated_count} module names to original (max 22 chars)")
