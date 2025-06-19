#!/usr/bin/env python3
"""
Test script to verify the service-specific modular prompt system is working
"""
import sys
import os
import requests
import json

def test_api_endpoints():
    """Test the prompt preset API endpoints"""
    base_url = "http://localhost:8000"
    
    print("Testing Modular Prompt System API...")
    
    try:
        # Test 1: Get all presets
        print("\n1. Testing GET /prompt-presets/")
        response = requests.get(f"{base_url}/prompt-presets/")
        if response.status_code == 200:
            presets = response.json()
            print(f"✅ Found {len(presets)} presets")
            for preset in presets:
                print(f"   - {preset['name']} (ID: {preset['id']})")
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")
            return False
        
        # Test 2: Get NemoEngine preset with modules
        nemo_preset_id = None
        for preset in presets:
            if "NemoEngine" in preset['name']:
                nemo_preset_id = preset['id']
                break
        
        if nemo_preset_id:
            print(f"\n2. Testing GET /prompt-presets/{nemo_preset_id}")
            response = requests.get(f"{base_url}/prompt-presets/{nemo_preset_id}")
            if response.status_code == 200:
                preset_data = response.json()
                modules = preset_data.get('modules', [])
                print(f"✅ NemoEngine preset loaded with {len(modules)} modules")
                
                # Analyze service distribution
                service_counts = {}
                for module in modules:
                    services = module.get('applicable_services', [])
                    for service in services:
                        service_counts[service] = service_counts.get(service, 0) + 1
                
                print("   Service distribution:")
                for service, count in service_counts.items():
                    print(f"     - {service}: {count} modules")
                
                # Test service-specific filtering
                generation_modules = [m for m in modules if 'generation' in m.get('applicable_services', [])]
                analysis_modules = [m for m in modules if 'analysis' in m.get('applicable_services', [])]
                maintenance_modules = [m for m in modules if 'maintenance' in m.get('applicable_services', [])]
                embedding_modules = [m for m in modules if 'embedding' in m.get('applicable_services', [])]
                
                print(f"\n   Module filtering test:")
                print(f"     - Generation: {len(generation_modules)} modules")
                print(f"     - Analysis: {len(analysis_modules)} modules")
                print(f"     - Maintenance: {len(maintenance_modules)} modules")
                print(f"     - Embedding: {len(embedding_modules)} modules")
                
            else:
                print(f"❌ Failed to get preset: {response.status_code}")
                return False
        else:
            print("❌ NemoEngine preset not found")
            return False
        
        # Test 3: Get user configuration
        print(f"\n3. Testing GET /prompt-presets/user/configuration")
        response = requests.get(f"{base_url}/prompt-presets/user/configuration")
        if response.status_code == 200:
            config = response.json()
            print(f"✅ User configuration loaded")
            print(f"   Active preset: {config.get('active_preset_id', 'None')}")
            print(f"   Temperature: {config.get('temperature', 'Not set')}")
            print(f"   Context size: {config.get('context_size', 'Not set')}")
        else:
            print(f"❌ Failed to get user config: {response.status_code}")
            return False
        
        print(f"\n🎉 All API tests passed! Service-specific modular prompt system is working.")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Service-Specific Modular Prompt System Test")
    print("=" * 50)
    
    success = test_api_endpoints()
    
    if success:
        print("\n✅ System is ready for use!")
        print("\nNext steps:")
        print("1. Start the frontend: cd frontend && npm run dev")
        print("2. Navigate to the left panel to see the 4-service drawer UI")
        print("3. Toggle modules by service to test real-time updates")
    else:
        print("\n❌ System has issues that need to be resolved")
    
    sys.exit(0 if success else 1)
