import sqlite3

conn = sqlite3.connect('are_database.db')
cursor = conn.cursor()

# Check if table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_prompt_instructions';")
result = cursor.fetchone()

if result:
    print(f"Table exists: {result[0]}")
    
    # Check table structure
    cursor.execute("PRAGMA table_info(user_prompt_instructions);")
    columns = cursor.fetchall()
    print("\nTable structure:")
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
        
    # Check if there are any records
    cursor.execute("SELECT COUNT(*) FROM user_prompt_instructions;")
    count = cursor.fetchone()[0]
    print(f"\nNumber of records: {count}")
else:
    print("Table does not exist")

conn.close()
