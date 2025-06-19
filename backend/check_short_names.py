import sqlite3

# Connect directly to the database
conn = sqlite3.connect('../are_database.db')
cursor = conn.cursor()

# Get all modules with names shorter than 22 characters
cursor.execute("SELECT id, name FROM prompt_modules WHERE length(name) < 22")
modules = cursor.fetchall()

print(f"Found {len(modules)} modules with names shorter than 22 characters")

# Sample of current short names
for i, (module_id, name) in enumerate(modules[:10]):
    print(f"{i+1}. '{name}' (Length: {len(name)})")

conn.close()

print("\nTo expand to 22 characters minimum, we need to restore original names.")
print("The current names are truncated with '...' and can't be intelligently expanded.")
