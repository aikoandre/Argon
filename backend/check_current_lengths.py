import sqlite3
import os

# Connect to the database
db_path = os.path.join(os.path.dirname(__file__), '..', 'are_database.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all prompt modules to see current lengths
cursor.execute("SELECT name FROM prompt_modules ORDER BY length(name) DESC LIMIT 10")
modules = cursor.fetchall()

print("Current longest prompt names:")
for i, (name,) in enumerate(modules, 1):
    print(f"{i}. '{name}' (Length: {len(name)})")

conn.close()
