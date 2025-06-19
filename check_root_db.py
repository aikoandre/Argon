#!/usr/bin/env python3
"""Check root database for prompt tables"""

import sqlite3
import os

# Check root database
db_path = "are_database.db"
if os.path.exists(db_path):
    print(f"Checking root database: {os.path.abspath(db_path)}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    print("All tables:")
    for table in tables:
        print(f"  - {table[0]}")
    
    prompt_tables = [t[0] for t in tables if 'prompt' in t[0]]
    if prompt_tables:
        print(f"\nPrompt tables found: {prompt_tables}")
        
        for table in prompt_tables:
            print(f"\nTable: {table}")
            cursor.execute(f"PRAGMA table_info({table})")
            schema = cursor.fetchall()
            for col in schema:
                print(f"  {col[1]}: {col[2]}")
                
            # Sample data
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"  Records: {count}")
    else:
        print("\nNo prompt tables found!")
    
    conn.close()
else:
    print(f"Database not found: {db_path}")
