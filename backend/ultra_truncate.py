import sqlite3

# Connect directly to the database to avoid import issues
conn = sqlite3.connect('../are_database.db')
cursor = conn.cursor()

# Get all modules with names longer than 15 characters
cursor.execute("SELECT id, name FROM prompt_modules WHERE length(name) > 15")
modules = cursor.fetchall()

updated_count = 0
for module_id, name in modules:
    old_name = name
    # Truncate to 12 characters and add "..."
    new_name = name[:12] + "..."
    
    cursor.execute("UPDATE prompt_modules SET name = ? WHERE id = ?", (new_name, module_id))
    print(f"Updated: '{old_name}' -> '{new_name}'")
    updated_count += 1

conn.commit()
conn.close()

print(f"\nUpdated {updated_count} module names to 15 characters max")
