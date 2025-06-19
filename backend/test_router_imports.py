#!/usr/bin/env python3
"""Test router imports one by one"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

routers_to_test = [
    "lore_entries",
    "chat", 
    "scenarios",
    "personas",
    "images",
    "characters",
    "master_worlds",
    "settings",
    "llm_providers",
    "maintenance",
    "faiss_management",
    "prompt_presets"
]

print("Testing router imports...")

for router_name in routers_to_test:
    try:
        print(f"Testing {router_name}...", end=" ")
        exec(f"from routers.{router_name} import router")
        print("✅")
    except Exception as e:
        print(f"❌ {str(e)}")
        
print("\nRouter import test complete!")
