#!/usr/bin/env python3
"""
Direct migration runner for modular prompt system tables
Bypasses Alembic and creates tables directly using SQLAlchemy
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    db_path = '../are_database.db'
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Creating modular prompt system tables...")
        
        # Create prompt_presets table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prompt_presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                is_default BOOLEAN DEFAULT FALSE,
                is_sillytavern_compatible BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """)
        
        # Create prompt_modules table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prompt_modules (
                id TEXT PRIMARY KEY,
                preset_id TEXT NOT NULL,
                identifier TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                content TEXT NOT NULL,
                enabled BOOLEAN DEFAULT TRUE,
                injection_position TEXT,
                injection_depth INTEGER DEFAULT 0,
                injection_order INTEGER DEFAULT 0,
                forbid_overrides BOOLEAN DEFAULT FALSE,
                role TEXT DEFAULT 'system',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME,
                FOREIGN KEY (preset_id) REFERENCES prompt_presets(id) ON DELETE CASCADE
            )
        """)
        
        # Create user_prompt_configurations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_prompt_configurations (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                active_preset_id TEXT,
                temperature REAL DEFAULT 1.0,
                top_p REAL DEFAULT 1.0,
                reasoning_effort TEXT DEFAULT 'Medium',
                context_size INTEGER DEFAULT 20,
                top_k INTEGER,
                top_a REAL,
                min_p REAL,
                max_tokens INTEGER,
                frequency_penalty REAL DEFAULT 0.0,
                presence_penalty REAL DEFAULT 0.0,
                repetition_penalty REAL DEFAULT 1.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME,
                FOREIGN KEY (active_preset_id) REFERENCES prompt_presets(id) ON DELETE SET NULL
            )
        """)
        
        # Add new columns to user_settings table if they don't exist
        # First check what columns exist
        cursor.execute("PRAGMA table_info(user_settings)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        
        new_columns = [
            ('max_messages_for_context', 'INTEGER DEFAULT 20'),
            ('max_lore_entries_for_rag', 'INTEGER DEFAULT 3'),
            ('primary_llm_top_k', 'INTEGER'),
            ('primary_llm_top_a', 'REAL'),
            ('primary_llm_min_p', 'REAL'),
            ('primary_llm_frequency_penalty', 'REAL DEFAULT 0.0'),
            ('primary_llm_presence_penalty', 'REAL DEFAULT 0.0'),
            ('primary_llm_repetition_penalty', 'REAL DEFAULT 1.0')
        ]
        
        for column_name, column_def in new_columns:
            if column_name not in existing_columns:
                cursor.execute(f"ALTER TABLE user_settings ADD COLUMN {column_name} {column_def}")
                print(f"Added column {column_name} to user_settings")
        
        # Create indexes for performance
        indexes = [
            ("ix_prompt_modules_preset_id", "prompt_modules", "preset_id"),
            ("ix_prompt_modules_category", "prompt_modules", "category"),
            ("ix_prompt_modules_enabled", "prompt_modules", "enabled"),
            ("ix_user_prompt_configurations_user_id", "user_prompt_configurations", "user_id"),
            ("ix_user_prompt_configurations_preset_id", "user_prompt_configurations", "active_preset_id")
        ]
        
        for index_name, table_name, column_name in indexes:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name}({column_name})")
        
        conn.commit()
        print("✅ Migration completed successfully!")
        
        # Verify tables were created
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'prompt_%'")
        tables = cursor.fetchall()
        print(f"Created tables: {[table[0] for table in tables]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
