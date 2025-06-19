import sqlite3

conn = sqlite3.connect('../are_database.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Existing tables:")
for table in tables:
    print(f"- {table[0]}")

# Check if modular prompt tables exist
modular_tables = ['prompt_presets', 'prompt_modules', 'user_prompt_configurations']
existing_modular_tables = [table[0] for table in tables if table[0] in modular_tables]

print(f"\nModular prompt tables found: {existing_modular_tables}")
print(f"Missing modular prompt tables: {[t for t in modular_tables if t not in existing_modular_tables]}")

conn.close()
