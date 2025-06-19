#!/usr/bin/env python3
"""
Truncate prompt module names directly using SQL to avoid model relationship issues
"""
import sqlite3
import os

def truncate_name_aggressively(name, max_length=35):
    """Truncate name more aggressively with smart word breaking"""
    if len(name) <= max_length:
        return name
    
    # Try to truncate at word boundaries first
    words = name.split()
    truncated = ""
    
    for word in words:
        if len(truncated + " " + word) <= max_length - 3:  # Leave room for "..."
            if truncated:
                truncated += " " + word
            else:
                truncated = word
        else:
            break
    
    # If we couldn't fit any complete words, just truncate hard
    if not truncated:
        truncated = name[:max_length-3]
    
    return truncated + "..."

def main():
    # Connect to the database directly
    db_path = os.path.join(os.path.dirname(__file__), '..', 'are_database.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get all modules with names longer than 35 characters or containing "OPTIONAL STYLE"
        cursor.execute("""
            SELECT id, name FROM prompt_modules 
            WHERE length(name) > 35 OR name LIKE '%OPTIONAL STYLE%'
        """)
        
        modules = cursor.fetchall()
        print(f"Found {len(modules)} modules to truncate")
        
        updated_count = 0
        for module_id, old_name in modules:
            new_name = truncate_name_aggressively(old_name, max_length=35)
            
            if old_name != new_name:
                print(f"'{old_name}' -> '{new_name}'")
                cursor.execute(
                    "UPDATE prompt_modules SET name = ? WHERE id = ?",
                    (new_name, module_id)
                )
                updated_count += 1
        
        if updated_count > 0:
            conn.commit()
            print(f"\nSuccessfully truncated {updated_count} module names")
        else:
            print("No names needed truncation")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()
