#!/usr/bin/env python3
"""
Argon Project Cleanup Script
Removes unused development, testing, and migration files
Created: 2025-06-19
"""

import os
import shutil
from pathlib import Path

def remove_file_safe(file_path):
    """Safely remove a file if it exists"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"✅ Removed: {file_path}")
            return True
        else:
            print(f"⚠️  Not found: {file_path}")
            return False
    except Exception as e:
        print(f"❌ Error removing {file_path}: {e}")
        return False

def main():
    print("🧹 ARGON PROJECT CLEANUP")
    print("=" * 50)
    
    # Base directory
    base_dir = Path(__file__).parent
    backend_dir = base_dir / "backend"
    
    # Files to remove
    files_to_remove = [
        # Test files
        "test_modular_system.py",
        "backend/test_router_imports.py",
        "backend/test_prompt_functionality.py", 
        "backend/test_minimal_startup.py",
        "backend/test_components_fixed.py",
        "backend/test_components.py",
        "backend/test_backend_startup.py",
        "backend/test_api_endpoints.py",
        
        # Database check/debug files
        "check_root_db.py",
        "backend/check_tables.py",
        "backend/check_table.py", 
        "backend/check_short_names.py",
        "backend/check_schema.py",
        "backend/check_names.py",
        "backend/check_module_names.py",
        "backend/check_db_paths.py",
        "backend/check_db.py",
        "backend/check_current_names.py",
        "backend/check_current_lengths.py",
        "backend/check_actual_db.py",
        "backend/check_20char_status.py",
        
        # Fix/migration utility files
        "backend/fix_relative_imports.py",
        "backend/fix_imports.py", 
        "backend/fix_all_imports.py",
        
        # Name truncation files
        "backend/truncate_names_sql.py",
        "backend/truncate_names_aggressive.py",
        "backend/truncate_names.py",
        "backend/truncate_20chars.py",
        "backend/ultra_truncate.py",
        
        # Legacy creation files
        "backend/create_prompt_tables.py",
        "backend/create_missing_table.py",
        "backend/create_full_nemo_preset.py", 
        "backend/create_nemo_argon_preset.py",
        
        # Restore/migration files
        "backend/restore_names.py",
        "backend/restore_full_names.py",
        "backend/run_service_migration.py",
        "backend/run_migration.py",
        "backend/verify_migration.py",
        "backend/extend_to_22.py",
        
        # Verification files
        "backend/verify_nemo_preset.py",
        "backend/verify_schema.py",
        "verify_services.py",
        
        # Alternative main files
        "backend/main_prompt_only.py",
        "backend/main_minimal.py",
        "backend/init_default_preset.py",
        
        # Database backup files
        "backend/are_database.db.backup_before_lore_fix",
        "are_database.db.backup",
        "backend/are_database.db.bak-1750026970",
    ]
    
    removed_count = 0
    not_found_count = 0
    error_count = 0
    
    print(f"\n📋 Removing {len(files_to_remove)} unused files...\n")
    
    for file_path in files_to_remove:
        full_path = base_dir / file_path
        result = remove_file_safe(str(full_path))
        if result:
            removed_count += 1
        elif os.path.exists(str(full_path)):
            error_count += 1
        else:
            not_found_count += 1
    
    print("\n" + "=" * 50)
    print("🎯 CLEANUP SUMMARY")
    print(f"✅ Files removed: {removed_count}")
    print(f"⚠️  Files not found: {not_found_count}")
    print(f"❌ Errors: {error_count}")
    print(f"📊 Total processed: {len(files_to_remove)}")
    
    if removed_count > 0:
        print(f"\n🎉 Successfully cleaned up {removed_count} unused files!")
        print("💾 Your project is now cleaner and more maintainable.")
    
    print("\n🔍 REMAINING IMPORTANT FILES:")
    print("✅ backend/main.py - Main application")
    print("✅ backend/check_database.py - Database status checker")
    print("✅ backend/models.py - Database models")
    print("✅ Backend routers/ - API endpoints")
    print("✅ Frontend src/ - React application")

if __name__ == "__main__":
    main()
