#!/usr/bin/env python3
"""
Truncate prompt module names more aggressively, especially OPTIONAL STYLE ones
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, func
from models.prompt_preset import PromptModule
from database import get_db

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
    # Get database session
    db = next(get_db())
    
    try:
        # Get all modules with names longer than 35 characters or containing "OPTIONAL STYLE"
        modules = db.query(PromptModule).filter(
            (PromptModule.name.ilike('%OPTIONAL STYLE%')) |
            (func.length(PromptModule.name) > 35)
        ).all()
        
        print(f"Found {len(modules)} modules to truncate")
        
        updated_count = 0
        for module in modules:
            old_name = module.name
            new_name = truncate_name_aggressively(old_name, max_length=35)
            
            if old_name != new_name:
                print(f"'{old_name}' -> '{new_name}'")
                module.name = new_name
                updated_count += 1
        
        if updated_count > 0:
            db.commit()
            print(f"\nSuccessfully truncated {updated_count} module names")
        else:
            print("No names needed truncation")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
