#!/usr/bin/env python3
"""Check database status and tables"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db.database import engine, DATABASE_URL
from sqlalchemy import text

print(f"Database URL: {DATABASE_URL}")
print(f"Database path: {os.path.abspath('are_database.db')}")

print("\n=== AVAILABLE TABLES ===")
with engine.connect() as conn:
    tables = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    print("Found tables:")
    for table in tables:
        print(f"  - {table[0]}")
    
    if not tables:
        print("  No tables found!")
    
    # Check if prompt_presets table exists
    if any('prompt' in table[0] for table in tables):
        print("\n=== PROMPT TABLES INFO ===")
        for table in tables:
            if 'prompt' in table[0]:
                print(f"\nTable: {table[0]}")
                schema = conn.execute(text(f"PRAGMA table_info({table[0]})")).fetchall()
                for col in schema:
                    print(f"  {col[1]}: {col[2]}")
    
    # Check migration history
    if any('alembic' in table[0] for table in tables):
        print("\n=== MIGRATION HISTORY ===")
        migrations = conn.execute(text("SELECT * FROM alembic_version")).fetchall()
        for migration in migrations:
            print(f"  Version: {migration[0]}")

print("\n✅ Database check complete!")
