#!/usr/bin/env python3
"""
Script to verify the database schema has the service-specific fields
"""
import sys
import os
import sqlite3

def check_schema():
    try:
        # Connect to the database
        db_path = "../are_database.db"
        print(f"Checking database: {os.path.abspath(db_path)}")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get the prompt_modules table schema
        cursor.execute("PRAGMA table_info(prompt_modules)")
        columns = cursor.fetchall()
        
        print("\nColumns in prompt_modules table:")
        for column in columns:
            cid, name, type_name, notnull, default_value, pk = column
            print(f"  {name}: {type_name} (nullable: {not notnull}, default: {default_value})")
        
        # Check specifically for our new fields
        required_fields = ['applicable_services', 'is_core_module', 'service_priority']
        existing_fields = [col[1] for col in columns]
        
        missing_fields = [field for field in required_fields if field not in existing_fields]
        
        if missing_fields:
            print(f"\n❌ Missing fields: {missing_fields}")
            return False
        else:
            print(f"\n✅ All service-specific fields present: {required_fields}")
            return True
            
    except Exception as e:
        print(f"Error checking schema: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    success = check_schema()
    sys.exit(0 if success else 1)
