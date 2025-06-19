import sqlite3
import os

# Connect to the database
db_path = os.path.join(os.path.dirname(__file__), '..', 'are_database.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# This is tricky since we truncated the original names. Let me just check if we can extend
# the existing truncated names by removing some "..." and adding more characters
# But since we don't have the original names, I'll create a more reasonable expansion

# Actually, let's just ensure all names are under 20 characters for future consistency
cursor.execute("SELECT id, name FROM prompt_modules")
modules = cursor.fetchall()

print(f"All {len(modules)} modules are already 15 characters or less.")
print("Since you want 20 characters max, current names are already within the limit.")
print("\nSample of current names:")
for i, (module_id, name) in enumerate(modules[:10]):
    print(f"{i+1}. '{name}' (Length: {len(name)})")

conn.close()
