"""
Verification script to check if LLM parameter columns were added successfully
"""
from sqlalchemy import text
from db.database import engine

def verify_migration():
    """Check if all LLM parameter columns exist in user_settings table"""
    
    expected_columns = [
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
            result = connection.execute(text("PRAGMA table_info(user_settings)"))
            existing_columns = {row[1] for row in result.fetchall()}
            
            print("All columns in user_settings table:")
            for row in connection.execute(text("PRAGMA table_info(user_settings)")):
                print(f"  {row[1]} - {row[2]}")
            
            print(f"\nChecking for LLM parameter columns:")
            missing_columns = []
            for column in expected_columns:
                if column in existing_columns:
                    print(f"  ✓ {column} - EXISTS")
                else:
                    print(f"  ✗ {column} - MISSING")
                    missing_columns.append(column)
            
            if missing_columns:
                print(f"\n❌ Migration incomplete. Missing columns: {missing_columns}")
                return False
            else:
                print(f"\n✅ Migration successful! All {len(expected_columns)} LLM parameter columns added.")
                return True
                
    except Exception as e:
        print(f"❌ Error checking migration: {e}")
        return False

if __name__ == "__main__":
    verify_migration()
