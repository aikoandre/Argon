import sqlite3
import os

# Check the root database (where the tables actually are)
db_path = '../are_database.db'

print(f"Checking database at: {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check prompt modules
cursor.execute("SELECT COUNT(*) FROM prompt_modules")
count = cursor.fetchone()[0]
print(f"Total prompt modules: {count}")

if count > 0:
    # Show sample modules with full names
    cursor.execute("SELECT id, name, enabled FROM prompt_modules ORDER BY LENGTH(name) DESC LIMIT 5")
    rows = cursor.fetchall()
    
    print("\nTop 5 longest module names:")
    for i, row in enumerate(rows, 1):
        print(f"{i}. Name: \"{row[1]}\" (Length: {len(row[1])}, Enabled: {row[2]})")
    
    # Show some with shorter names too
    cursor.execute("SELECT id, name, enabled FROM prompt_modules WHERE LENGTH(name) < 30 ORDER BY name LIMIT 5")
    short_rows = cursor.fetchall()
    
    print("\nSample shorter module names:")
    for row in short_rows:
        print(f"Name: \"{row[1]}\" (Length: {len(row[1])}, Enabled: {row[2]})")

conn.close()
