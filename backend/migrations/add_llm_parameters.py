"""
Database migration to add LLM parameter configuration fields
"""
import sys
import os

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from db.database import engine

def upgrade():
    """Add new LLM parameter columns to user_settings table"""
    
    # SQLite doesn't support IF NOT EXISTS in ALTER TABLE, so we'll check and add individually
    columns_to_add = [
        ("analysis_enabled", "BOOLEAN DEFAULT TRUE"),
        ("maintenance_enabled", "BOOLEAN DEFAULT TRUE"),
        ("embedding_enabled", "BOOLEAN DEFAULT TRUE"),
        ("primary_llm_temperature", "FLOAT DEFAULT 1.0"),
        ("primary_llm_top_p", "FLOAT DEFAULT 1.0"),
        ("primary_llm_max_tokens", "INTEGER"),
        ("primary_llm_reasoning_effort", "VARCHAR(20) DEFAULT 'Medium'"),
        ("primary_llm_custom_prompt", "TEXT"),
        ("analysis_llm_temperature", "FLOAT DEFAULT 1.0"),
        ("analysis_llm_top_p", "FLOAT DEFAULT 1.0"),
        ("analysis_llm_max_tokens", "INTEGER"),
        ("analysis_llm_reasoning_effort", "VARCHAR(20) DEFAULT 'Medium'"),
        ("analysis_llm_custom_prompt", "TEXT"),
        ("maintenance_llm_temperature", "FLOAT DEFAULT 1.0"),
        ("maintenance_llm_top_p", "FLOAT DEFAULT 1.0"),
        ("maintenance_llm_max_tokens", "INTEGER"),
        ("maintenance_llm_reasoning_effort", "VARCHAR(20) DEFAULT 'Medium'"),
        ("maintenance_llm_custom_prompt", "TEXT"),
    ]
    
    try:
        with engine.begin() as connection:
            # Check which columns already exist
            result = connection.execute(text("PRAGMA table_info(user_settings)"))
            existing_columns = {row[1] for row in result.fetchall()}
            
            # Add each column that doesn't exist
            for column_name, column_def in columns_to_add:
                if column_name not in existing_columns:
                    sql = f"ALTER TABLE user_settings ADD COLUMN {column_name} {column_def}"
                    print(f"Adding column: {column_name}")
                    connection.execute(text(sql))
                else:
                    print(f"Column {column_name} already exists, skipping")
            
            print("LLM Parameters migration completed successfully")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        raise

def downgrade():
    """Remove LLM parameter columns (for rollback)"""
    
    columns_to_remove = [
        "analysis_enabled", "maintenance_enabled", "embedding_enabled",
        "primary_llm_temperature", "primary_llm_top_p", "primary_llm_max_tokens",
        "primary_llm_reasoning_effort", "primary_llm_custom_prompt",
        "analysis_llm_temperature", "analysis_llm_top_p", "analysis_llm_max_tokens",
        "analysis_llm_reasoning_effort", "analysis_llm_custom_prompt",
        "maintenance_llm_temperature", "maintenance_llm_top_p", "maintenance_llm_max_tokens",
        "maintenance_llm_reasoning_effort", "maintenance_llm_custom_prompt"
    ]
    
    try:
        with engine.begin() as connection:
            # Check which columns exist
            result = connection.execute(text("PRAGMA table_info(user_settings)"))
            existing_columns = {row[1] for row in result.fetchall()}
            
            # Note: SQLite doesn't support DROP COLUMN easily, so we'll recreate the table
            print("Warning: SQLite doesn't support DROP COLUMN easily.")
            print("Manual intervention may be required to remove columns.")
            print("Columns that would be removed:", columns_to_remove)
            
            print("LLM Parameters rollback noted (manual intervention required)")
            
    except Exception as e:
        print(f"Rollback failed: {e}")
        raise

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()