#!/usr/bin/env python3
"""Test backend API endpoints for prompt system"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from fastapi.testclient import TestClient
    from main import app
    
    client = TestClient(app)
    
    print("=== TESTING PROMPT PRESETS API ===")
    
    # Test GET presets
    response = client.get("/api/prompt-presets/")
    print(f"GET /api/prompt-presets/ - Status: {response.status_code}")
    
    if response.status_code == 200:
        presets = response.json()
        print(f"Presets found: {len(presets)}")
        
        if presets:
            first_preset = presets[0]
            print(f"First preset: {first_preset['name']}")
            preset_id = first_preset['id']
            
            # Test GET specific preset
            print(f"\n=== TESTING SPECIFIC PRESET ===")
            response = client.get(f"/api/prompt-presets/{preset_id}")
            print(f"GET /api/prompt-presets/{preset_id} - Status: {response.status_code}")
            
            if response.status_code == 200:
                preset_detail = response.json()
                modules = preset_detail.get('modules', [])
                print(f"Modules in preset: {len(modules)}")
                
                if modules:
                    # Check service-specific fields
                    print(f"\n=== TESTING SERVICE-SPECIFIC FIELDS ===")
                    sample_module = modules[0]
                    print(f"Sample module: {sample_module['name']}")
                    print(f"  Applicable services: {sample_module.get('applicable_services', 'Not found')}")
                    print(f"  Is core module: {sample_module.get('is_core_module', 'Not found')}")
                    print(f"  Service priority: {sample_module.get('service_priority', 'Not found')}")
                    
                    # Count modules by service
                    services = {}
                    for module in modules:
                        applicable = module.get('applicable_services', [])
                        if isinstance(applicable, list):
                            for service in applicable:
                                services[service] = services.get(service, 0) + 1
                    
                    print(f"\n=== MODULE DISTRIBUTION ===")
                    for service, count in services.items():
                        print(f"  {service}: {count} modules")
    
    print(f"\n=== TESTING USER CONFIGURATIONS ===")
    response = client.get("/api/prompt-presets/user-config")
    print(f"GET /api/prompt-presets/user-config - Status: {response.status_code}")
    
    if response.status_code == 200:
        config = response.json()
        print(f"User config found: {config.get('active_preset_id', 'None')}")
        print(f"Temperature: {config.get('temperature', 'None')}")
        print(f"Top P: {config.get('top_p', 'None')}")
    
    print(f"\n✅ API verification complete!")
    
except Exception as e:
    print(f"❌ Error testing API: {str(e)}")
    import traceback
    traceback.print_exc()
