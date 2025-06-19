#!/usr/bin/env python3
"""
Script to run the service-specific fields migration
"""
import sys
import os
from alembic.config import Config
from alembic import command

def run_migration():
    try:
        # Get the current directory (should be backend/)
        current_dir = os.getcwd()
        print(f"Running migration from: {current_dir}")
        
        # Create alembic config
        alembic_cfg = Config("alembic.ini")
        
        # Check current revision
        print("Current revision:")
        command.current(alembic_cfg, verbose=True)
        
        # Run upgrade to head
        print("\nRunning upgrade to head...")
        command.upgrade(alembic_cfg, "head")
        
        print("\nMigration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
