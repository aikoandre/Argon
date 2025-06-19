import sqlite3

# Connect directly to the database to avoid import issues
conn = sqlite3.connect('../are_database.db')
cursor = conn.cursor()

# Get all modules with names ending in "..." (truncated names)
cursor.execute("SELECT id, name FROM prompt_modules WHERE name LIKE '%...'")
modules = cursor.fetchall()

# We need to get the original names from the database backup or reconstruct them
# For now, let's just expand the existing truncated names to 22 characters max
print(f"Found {len(modules)} truncated module names")

# Since we don't have the original names, let's just check current lengths
cursor.execute("SELECT id, name, length(name) FROM prompt_modules")
all_modules = cursor.fetchall()

count_over_22 = 0
for module_id, name, length in all_modules:
    if length > 22:
        print(f"Name longer than 22: '{name}' (length: {length})")
        count_over_22 += 1

print(f"\nCurrent status:")
print(f"Total modules: {len(all_modules)}")
print(f"Modules longer than 22 chars: {count_over_22}")

if count_over_22 == 0:
    print("All module names are already 22 characters or less!")
    print("No changes needed.")
else:
    # Truncate any names longer than 22 characters
    for module_id, name, length in all_modules:
        if length > 22:
            new_name = name[:19] + "..."
            cursor.execute("UPDATE prompt_modules SET name = ? WHERE id = ?", (new_name, module_id))
            print(f"Truncated: '{name}' -> '{new_name}'")
    
    conn.commit()
    print(f"Updated {count_over_22} module names")

conn.close()
