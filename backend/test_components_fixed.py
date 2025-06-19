#!/usr/bin/env python3
"""Test backend components for prompt system"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    # Test individual components first
    print("=== TESTING DATABASE CONNECTION ===")
    from db.database import engine, SessionLocal
    print("✅ Database imports successful")
    
    # Test session
    db = SessionLocal()
    print("✅ Database session created")
    db.close()
    print("✅ Database session closed")
    
    print("\n=== TESTING MODELS ===")
    from models.prompt_preset import PromptPreset, PromptModule
    print("✅ Model imports successful")
    
    print("\n=== TESTING SCHEMAS ===") 
    from schemas.prompt_presets import PromptPresetResponse
    print("✅ Schema imports successful")
    
    print("\n=== TESTING ROUTERS ===")
    from routers.prompt_presets import router
    print("✅ Router imports successful")
    
    print("\n=== TESTING ROUTER FUNCTIONS ===")
    # Test a simple database query using the SessionLocal that connects to root DB
    with SessionLocal() as db:
        from sqlalchemy import text
        result = db.execute(text("SELECT COUNT(*) FROM prompt_presets")).fetchone()
        print(f"✅ Preset count: {result[0]}")
        
        result = db.execute(text("SELECT COUNT(*) FROM prompt_modules")).fetchone()
        print(f"✅ Module count: {result[0]}")
    
    print("\n✅ All component tests passed!")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
