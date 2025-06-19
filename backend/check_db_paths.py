#!/usr/bin/env python3
"""Check backend database tables"""

import sqlite3
import os

# Check backend local database
backend_db = "./are_database.db"
if os.path.exists(backend_db):
    print(f"Backend database: {os.path.abspath(backend_db)}")
    conn = sqlite3.connect(backend_db)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print("Backend database tables:")
    for table in tables:
        print(f"  - {table[0]}")
    conn.close()
else:
    print("Backend database not found")

# Check root database path
root_db = "../are_database.db"
if os.path.exists(root_db):
    print(f"\nRoot database: {os.path.abspath(root_db)}")
    conn = sqlite3.connect(root_db)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    prompt_tables = [t[0] for t in tables if 'prompt' in t[0]]
    print(f"Root database prompt tables: {prompt_tables}")
    conn.close()
else:
    print("Root database not found")
