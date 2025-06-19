import sqlite3
import os

# Connect to the database
db_path = os.path.join(os.path.dirname(__file__), '..', 'are_database.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all prompt modules with long names
cursor.execute("SELECT id, name FROM prompt_modules WHERE length(name) > 20")
modules = cursor.fetchall()

updated_count = 0
for module_id, name in modules:
    if len(name) > 20:
        old_name = name
        # Truncate to 17 characters and add "..."
        new_name = name[:17] + "..."
        cursor.execute("UPDATE prompt_modules SET name = ? WHERE id = ?", (new_name, module_id))
        print(f"Updated: '{old_name}' -> '{new_name}'")
        updated_count += 1

if updated_count > 0:
    conn.commit()
    print(f"\nUpdated {updated_count} module names to 20 characters max")
else:
    print("No names needed truncation")

conn.close()
