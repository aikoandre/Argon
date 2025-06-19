#!/usr/bin/env python3
"""Test minimal backend startup"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("Testing database import...")
    from db.database import engine, SessionLocal, Base
    print("✅ Database import successful")
    
    print("Testing individual model imports...")
    from models.chat_session import ChatSession
    print("✅ ChatSession import successful")
    
    from models.prompt_preset import PromptPreset, PromptModule
    print("✅ PromptPreset/PromptModule import successful")
    
    print("Testing table creation...")
    # This should not recreate tables if they already exist
    Base.metadata.create_all(bind=engine)
    print("✅ Table creation/verification successful")
    
    print("Testing database connection...")
    with SessionLocal() as db:
        from sqlalchemy import text
        result = db.execute(text("SELECT COUNT(*) FROM prompt_modules")).fetchone()
        print(f"✅ Database query successful: {result[0]} modules found")
    
    print("\n🎉 All core components working!")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
