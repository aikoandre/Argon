#!/usr/bin/env python3
"""
Test just the prompt preset functionality without full database models
"""
import sqlite3
import json

def test_prompt_preset_functionality():
    try:
        print("🔍 Testing Prompt Preset Database Operations")
        
        # Direct database connection
        conn = sqlite3.connect("../are_database.db")
        cursor = conn.cursor()
        
        # Test 1: Verify preset exists
        cursor.execute("SELECT id, name FROM prompt_presets WHERE name LIKE '%Argon%'")
        preset = cursor.fetchone()
        
        if not preset:
            print("❌ Argon preset not found")
            return False
            
        preset_id, preset_name = preset
        print(f"✅ Found preset: {preset_name}")
        
        # Test 2: Get modules with service-specific data
        cursor.execute("""
            SELECT id, name, applicable_services, is_core_module, service_priority
            FROM prompt_modules 
            WHERE preset_id = ? 
            LIMIT 5
        """, (preset_id,))
        
        modules = cursor.fetchall()
        if not modules:
            print("❌ No modules found")
            return False
            
        print(f"✅ Found {len(modules)} sample modules with service data")
        
        # Test 3: Verify service-specific fields work
        for module_id, name, applicable_services, is_core, priority in modules:
            print(f"   📋 {name[:40]}...")
            
            # Test JSON parsing
            if applicable_services:
                try:
                    services = json.loads(applicable_services)
                    print(f"      Services: {services}")
                except:
                    print(f"      Services: {applicable_services}")
                    
            print(f"      Core: {is_core}, Priority: {priority}")
        
        # Test 4: Count modules by service
        cursor.execute("""
            SELECT applicable_services, COUNT(*) 
            FROM prompt_modules 
            WHERE preset_id = ? AND applicable_services IS NOT NULL
            GROUP BY applicable_services
        """, (preset_id,))
        
        service_counts = cursor.fetchall()
        print(f"\n📊 Service Distribution:")
        for services_json, count in service_counts:
            try:
                services = json.loads(services_json)
                for service in services:
                    print(f"   - {service}: modules available")
            except:
                print(f"   - {services_json}: {count} modules")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_prompt_preset_functionality()
    if success:
        print(f"\n🎉 Prompt preset functionality verified!")
    else:
        print(f"\n💥 Prompt preset functionality has issues!")
    
    exit(0 if success else 1)
