#!/usr/bin/env python3
"""
Quick backend startup test
"""
import sys
import os

def test_backend_startup():
    try:
        # Add parent directory to path for backend imports
        import sys
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        sys.path.insert(0, parent_dir)
        
        # Test imports
        from backend.models.prompt_preset import PromptPreset, PromptModule, UserPromptConfiguration
        print("✅ Models import successfully")
        
        from backend.utils.prompt_serialization import serialize_prompt_module, serialize_prompt_preset_with_modules
        print("✅ Serialization utils import successfully")
        
        from backend.routers.prompt_presets import router
        print("✅ Router imports successfully")
        
        # Test database connection
        from db.database import get_db
        db = next(get_db())
        
        # Test basic query
        presets = db.query(PromptPreset).all()
        print(f"✅ Database connection works - found {len(presets)} presets")
        
        db.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Backend test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 Testing Backend Startup Components")
    print("=" * 40)
    
    success = test_backend_startup()
    
    if success:
        print("\n🎉 Backend components are ready!")
        print("✅ All imports work")
        print("✅ Database connection successful")
        print("✅ Models and routers functional")
    else:
        print("\n💥 Backend has issues")
    
    sys.exit(0 if success else 1)
