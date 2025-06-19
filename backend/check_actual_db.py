#!/usr/bin/env python3
"""Check actual database URL being used"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from db.database import DATABASE_URL, engine

print(f"DATABASE_URL: {DATABASE_URL}")
print(f"Database path resolved: {engine.url}")

# Test actual connection
with engine.connect() as conn:
    from sqlalchemy import text
    result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    tables = [row[0] for row in result.fetchall()]
    
    print(f"Tables found: {len(tables)}")
    prompt_tables = [t for t in tables if 'prompt' in t]
    print(f"Prompt tables: {prompt_tables}")
    
    if prompt_tables:
        print("✅ Prompt tables found!")
        for table in prompt_tables:
            count_result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = count_result.fetchone()[0]
            print(f"  {table}: {count} records")
    else:
        print("❌ No prompt tables found!")
