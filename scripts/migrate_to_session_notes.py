#!/usr/bin/env python3
"""
Database migration script for SessionNotes system.

This script:
1. Drops old tables (session_lore_modifications, session_cache_facts)
2. Creates new session_notes table
3. Adds new columns to lore_entries table
4. Creates necessary indexes

Run with: python scripts/migrate_to_session_notes.py
"""
import os
import sys
import sqlite3
import logging
from pathlib import Path

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_database_path():
    """Get the path to the SQLite database"""
    # Check common locations
    possible_paths = [
        "are_database.db",
        "backend/are_database.db", 
        "../are_database.db"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    # Default to current directory
    return "are_database.db"


def backup_database(db_path):
    """Create a backup of the current database"""
    backup_path = f"{db_path}.backup_{int(__import__('time').time())}"
    
    try:
        import shutil
        shutil.copy2(db_path, backup_path)
        logger.info(f"Database backed up to: {backup_path}")
        return backup_path
    except Exception as e:
        logger.error(f"Failed to backup database: {e}")
        return None


def execute_migration(db_path):
    """Execute the migration steps"""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys = ON")
        
        logger.info("Starting migration to SessionNotes system...")
        
        # Step 1: Drop old tables (if they exist)
        logger.info("Dropping old tables...")
        
        # Check if tables exist before dropping
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='session_lore_modifications'")
        if cursor.fetchone():
            cursor.execute("DROP TABLE session_lore_modifications")
            logger.info("Dropped session_lore_modifications table")
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='session_cache_facts'")
        if cursor.fetchone():
            cursor.execute("DROP TABLE session_cache_facts")
            logger.info("Dropped session_cache_facts table")
        
        # Step 2: Create session_notes table
        logger.info("Creating session_notes table...")
        
        create_session_notes_sql = """
        CREATE TABLE IF NOT EXISTS session_notes (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            lore_entry_id TEXT REFERENCES lore_entries(id) ON DELETE CASCADE,
            note_content TEXT NOT NULL DEFAULT '',
            last_updated_turn INTEGER NOT NULL DEFAULT 0,
            entity_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Constraints
            UNIQUE(session_id, lore_entry_id),
            CHECK (lore_entry_id IS NOT NULL OR entity_name IS NOT NULL)
        )
        """
        
        cursor.execute(create_session_notes_sql)
        logger.info("Created session_notes table")
        
        # Step 3: Add new columns to lore_entries table (if not exist)
        logger.info("Adding new columns to lore_entries table...")
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(lore_entries)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'is_dynamically_generated' not in columns:
            cursor.execute("ALTER TABLE lore_entries ADD COLUMN is_dynamically_generated TEXT DEFAULT 'false'")
            logger.info("Added is_dynamically_generated column to lore_entries")
        
        if 'created_in_session_id' not in columns:
            cursor.execute("ALTER TABLE lore_entries ADD COLUMN created_in_session_id TEXT REFERENCES chat_sessions(id)")
            logger.info("Added created_in_session_id column to lore_entries")
        
        # Step 4: Create indexes for performance
        logger.info("Creating indexes...")
        
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_session_notes_session_id ON session_notes(session_id)",
            "CREATE INDEX IF NOT EXISTS idx_session_notes_lore_entry_id ON session_notes(lore_entry_id)",
            "CREATE INDEX IF NOT EXISTS idx_session_notes_entity_name ON session_notes(entity_name)",
            "CREATE INDEX IF NOT EXISTS idx_lore_entries_dynamic ON lore_entries(is_dynamically_generated)"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        logger.info("Created performance indexes")
        
        # Step 5: Create update trigger for session_notes
        logger.info("Creating update trigger...")
        
        trigger_sql = """
        CREATE TRIGGER IF NOT EXISTS update_session_notes_timestamp 
        AFTER UPDATE ON session_notes
        BEGIN
            UPDATE session_notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
        """
        
        cursor.execute(trigger_sql)
        logger.info("Created update timestamp trigger")
        
        # Commit all changes
        conn.commit()
        logger.info("✅ Migration completed successfully!")
        
        # Verify the migration
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='session_notes'")
        if cursor.fetchone():
            logger.info("✅ session_notes table verified")
        else:
            logger.error("❌ session_notes table not found after migration")
        
        return True
        
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Migration failed: {e}")
        return False
        
    finally:
        conn.close()


def main():
    """Main migration function"""
    print("=" * 60)
    print("SessionNotes Database Migration")
    print("=" * 60)
    
    # Get database path
    db_path = get_database_path()
    logger.info(f"Using database: {db_path}")
    
    if not os.path.exists(db_path):
        logger.warning(f"Database file {db_path} does not exist. Creating new database.")
    
    # Create backup
    backup_path = backup_database(db_path)
    if backup_path:
        print(f"✅ Database backed up to: {backup_path}")
    
    # Execute migration
    success = execute_migration(db_path)
    
    if success:
        print("\n✅ Migration completed successfully!")
        print("The SessionNotes system is now ready to use.")
        if backup_path:
            print(f"\n💾 Backup available at: {backup_path}")
    else:
        print("\n❌ Migration failed!")
        if backup_path:
            print(f"🔄 You can restore from backup: {backup_path}")
        sys.exit(1)


if __name__ == "__main__":
    main()
