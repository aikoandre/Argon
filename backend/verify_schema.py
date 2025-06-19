#!/usr/bin/env python3
"""Verify database schema and service-specific fields"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db.database import engine
from sqlalchemy import text

print("=== SCHEMA VERIFICATION ===")
with engine.connect() as conn:
    # Check table schema
    result = conn.execute(text("PRAGMA table_info(prompt_modules)")).fetchall()
    print("Table schema:")
    for row in result:
        print(f"  {row[1]}: {row[2]}")
    
    print("\n=== DATA VERIFICATION ===")
    # Check sample data
    modules = conn.execute(text("""
        SELECT id, name, applicable_services, is_core_module, service_priority 
        FROM prompt_modules 
        LIMIT 5
    """)).fetchall()
    
    print("Sample modules:")
    for row in modules:
        print(f"  ID: {row[0]}, Name: {row[1]}")
        print(f"    Services: {row[2]}, Core: {row[3]}, Priority: {row[4]}")
    
    print("\n=== SERVICE DISTRIBUTION ===")
    # Check service distribution
    services = ['generation', 'analysis', 'maintenance', 'embedding']
    for service in services:
        count = conn.execute(text(f"""
            SELECT COUNT(*) FROM prompt_modules 
            WHERE applicable_services LIKE '%{service}%'
        """)).fetchone()[0]
        print(f"  {service}: {count} modules")
    
    print("\n=== CORE MODULE COUNT ===")
    core_count = conn.execute(text("""
        SELECT COUNT(*) FROM prompt_modules WHERE is_core_module = 1
    """)).fetchone()[0]
    print(f"  Core modules: {core_count}")
    
    total_count = conn.execute(text("SELECT COUNT(*) FROM prompt_modules")).fetchone()[0]
    print(f"  Total modules: {total_count}")

print("\n✅ Schema verification complete!")
