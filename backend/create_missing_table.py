#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
import sqlite3

def create_user_prompt_instructions_table():
    try:
        # Use the same database path that the backend uses
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "are_database.db")
        print(f"Using database: {db_path}")
        
        # Create engine with the correct path
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        
        conn = engine.connect()
        
        # Create the user_prompt_instructions table
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS user_prompt_instructions (
            id INTEGER PRIMARY KEY,
            primary_instructions TEXT DEFAULT '',
            extraction_instructions TEXT DEFAULT '',
            analysis_instructions TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
        
        conn.execute(text(create_table_sql))
        conn.commit()
        conn.close()
        
        print("✅ user_prompt_instructions table created successfully")
        
        # Verify the table was created
        conn = engine.connect()
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='user_prompt_instructions'"))
        if result.fetchone():
            print("✅ Table verification successful")
        else:
            print("❌ Table verification failed")
        conn.close()
        
    except Exception as e:
        print(f"❌ Error creating table: {e}")

if __name__ == "__main__":
    create_user_prompt_instructions_table()
