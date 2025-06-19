#!/usr/bin/env python3
"""Verify service-specific prompt module data"""

import sqlite3
import json

db_path = "are_database.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=== SERVICE-SPECIFIC PROMPT MODULE VERIFICATION ===")

# Check service field data
cursor.execute("""
    SELECT applicable_services, is_core_module, service_priority, COUNT(*) 
    FROM prompt_modules 
    GROUP BY applicable_services, is_core_module
    ORDER BY COUNT(*) DESC
    LIMIT 10
""")

results = cursor.fetchall()
print("\nService distribution:")
for row in results:
    services = row[0]
    is_core = "Core" if row[1] else "Optional"
    count = row[3]
    print(f"  {services} ({is_core}): {count} modules")

# Check specific services
services = ['generation', 'analysis', 'maintenance', 'embedding']
print(f"\n=== MODULE COUNT BY SERVICE ===")
for service in services:
    cursor.execute(f"""
        SELECT COUNT(*) FROM prompt_modules 
        WHERE applicable_services LIKE '%{service}%'
    """)
    count = cursor.fetchone()[0]
    print(f"  {service}: {count} modules")

# Check core modules
cursor.execute("SELECT COUNT(*) FROM prompt_modules WHERE is_core_module = 1")
core_count = cursor.fetchone()[0]
cursor.execute("SELECT COUNT(*) FROM prompt_modules")
total_count = cursor.fetchone()[0]
print(f"\n=== CORE MODULE STATS ===")
print(f"  Core modules: {core_count}")
print(f"  Optional modules: {total_count - core_count}")
print(f"  Total modules: {total_count}")

# Sample service-specific modules
print(f"\n=== SAMPLE MODULES BY SERVICE ===")
for service in services:
    cursor.execute(f"""
        SELECT name, applicable_services, is_core_module, service_priority
        FROM prompt_modules 
        WHERE applicable_services LIKE '%{service}%'
        LIMIT 3
    """)
    modules = cursor.fetchall()
    print(f"\n{service.title()} service modules:")
    for module in modules:
        core_status = "Core" if module[2] else "Optional"
        print(f"  - {module[0]} ({core_status}, Priority: {module[3]})")

conn.close()
print("\n✅ Service verification complete!")
