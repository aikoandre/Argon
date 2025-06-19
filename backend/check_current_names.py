import sqlite3

# Check current prompt module names
conn = sqlite3.connect('are_database.db')
cursor = conn.cursor()

cursor.execute('SELECT id, name, preset_id FROM prompt_modules ORDER BY name LIMIT 10')
rows = cursor.fetchall()

print("Current prompt module names in database:")
for row in rows:
    print(f'ID: {row[0]}, Name: "{row[1]}", Length: {len(row[1])}, Preset: {row[2]}')

conn.close()
