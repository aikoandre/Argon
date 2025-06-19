#!/usr/bin/env python3
"""
Verify the NemoEngine preset and its service-specific module distribution
"""
import sqlite3
import json
from collections import defaultdict

def verify_nemo_preset():
    try:
        conn = sqlite3.connect("../are_database.db")
        cursor = conn.cursor()
          # Check if NemoEngine preset exists
        cursor.execute("SELECT id, name, description FROM prompt_presets WHERE name LIKE '%Argon%'")
        presets = cursor.fetchall()
        
        if not presets:
            print("❌ No NemoEngine Argon Edition preset found")
            return False
        
        preset_id, name, description = presets[0]
        print(f"✅ Found NemoEngine preset: {name}")
        print(f"   ID: {preset_id}")
        print(f"   Description: {description}")
        
        # Get modules for this preset
        cursor.execute("""
            SELECT id, name, category, enabled, applicable_services, is_core_module, service_priority
            FROM prompt_modules 
            WHERE preset_id = ?
        """, (preset_id,))
        
        modules = cursor.fetchall()
        print(f"\n✅ Found {len(modules)} modules in preset")
        
        # Analyze service distribution
        service_counts = defaultdict(int)
        core_module_count = 0
        enabled_count = 0
        
        for module_data in modules:
            module_id, name, category, enabled, applicable_services, is_core, priority = module_data
            
            if enabled:
                enabled_count += 1
            if is_core:
                core_module_count += 1
                
            # Parse applicable_services JSON
            if applicable_services:
                try:
                    services = json.loads(applicable_services)
                    for service in services:
                        service_counts[service] += 1
                except json.JSONDecodeError:
                    service_counts[applicable_services] += 1
        
        print(f"\n📊 Module Statistics:")
        print(f"   - Total modules: {len(modules)}")
        print(f"   - Enabled modules: {enabled_count}")
        print(f"   - Core modules: {core_module_count}")
        
        print(f"\n🎯 Service Distribution:")
        for service, count in sorted(service_counts.items()):
            print(f"   - {service.capitalize()}: {count} modules")
        
        # Verify service-specific modules exist
        required_services = ['generation', 'analysis', 'maintenance', 'embedding']
        missing_services = []
        
        for service in required_services:
            if service not in service_counts:
                missing_services.append(service)
        
        if missing_services:
            print(f"\n❌ Missing modules for services: {missing_services}")
            return False
        else:
            print(f"\n✅ All required services have modules assigned")
        
        # Show some example modules
        print(f"\n📋 Sample Modules by Service:")
        cursor.execute("""
            SELECT name, applicable_services, is_core_module
            FROM prompt_modules 
            WHERE preset_id = ?
            LIMIT 5
        """, (preset_id,))
        
        sample_modules = cursor.fetchall()
        for name, services, is_core in sample_modules:
            core_indicator = " [CORE]" if is_core else ""
            print(f"   - {name[:50]}{'...' if len(name) > 50 else ''}: {services}{core_indicator}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error verifying preset: {e}")
        return False

if __name__ == "__main__":
    print("🔍 Verifying NemoEngine Preset Service Distribution")
    print("=" * 55)
    
    success = verify_nemo_preset()
    if success:
        print(f"\n🎉 NemoEngine preset verification successful!")
    else:
        print(f"\n💥 NemoEngine preset verification failed!")
        
    exit(0 if success else 1)
