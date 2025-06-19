#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text

def check_tables():
    try:
        # Use the same database path that the backend uses
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "are_database.db")
        print(f"Checking database: {db_path}")
        
        # Create engine with the correct path
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        
        conn = engine.connect()
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        tables = [row[0] for row in result]
        conn.close()
        
        print("Available tables:")
        for table in sorted(tables):
            print(f"  - {table}")
        
        # Check specifically for user_prompt_instructions
        if 'user_prompt_instructions' in tables:
            print("\n✅ user_prompt_instructions table exists")
        else:
            print("\n❌ user_prompt_instructions table missing")
            
        return tables
    except Exception as e:
        print(f"Error checking tables: {e}")
        return []

if __name__ == "__main__":
    check_tables()
