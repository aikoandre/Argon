import sqlite3
import json

# Load the original full names from the JSON file
with open('NemoEngine v5.8 (Experimental) (Deepseek) V3.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Extract the module name mapping
module_mapping = {}
if 'prompts' in data:
    for prompt in data['prompts']:
        if 'identifier' in prompt and 'name' in prompt:
            module_mapping[prompt['identifier']] = prompt['name']

print(f"Found {len(module_mapping)} modules in JSON file")

# Connect to database
conn = sqlite3.connect('are_database.db')
cursor = conn.cursor()

# Get all modules that need full name restoration
cursor.execute('SELECT id, identifier, name FROM prompt_modules')
modules = cursor.fetchall()

updated_count = 0
for module_id, identifier, current_name in modules:
    if identifier in module_mapping:
        full_name = module_mapping[identifier]
        if current_name != full_name:
            print(f"Updating module {identifier}:")
            print(f"  From: '{current_name}' (length: {len(current_name)})")
            print(f"  To: '{full_name}' (length: {len(full_name)})")
            
            cursor.execute('UPDATE prompt_modules SET name = ? WHERE id = ?', (full_name, module_id))
            updated_count += 1

conn.commit()
conn.close()

print(f"\nUpdated {updated_count} modules with full names")
