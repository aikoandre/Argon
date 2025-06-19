#!/usr/bin/env python3
"""
Script to create or update the NemoEngine v5.8 preset with service-specific architecture
"""
import sys
import os
import json
import sqlite3
from typing import Dict, List, Any

def load_nemo_engine_preset() -> Dict[str, Any]:
    """Load the NemoEngine v5.8 preset from the JSON file"""
    nemo_path = "../NemoEngine v5.8 (Experimental) (Deepseek) V3.json"
    
    try:
        with open(nemo_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading NemoEngine preset: {e}")
        return {}

def determine_service_mapping(identifier: str, name: str, content: str) -> List[str]:
    """Determine which services a module should apply to based on its content"""
    
    # Core system modules that apply to multiple services
    if any(keyword in identifier.lower() for keyword in ['system', 'core', 'main']):
        if 'analysis' in name.lower() or 'memory' in name.lower():
            return ['generation', 'analysis']
        elif 'maintenance' in name.lower() or 'world' in name.lower():
            return ['generation', 'maintenance']
        else:
            return ['generation']  # Most core modules are for generation
    
    # Analysis-specific keywords
    if any(keyword in content.lower() for keyword in ['analyze', 'extract', 'relationship', 'entity']):
        return ['analysis']
    
    # Maintenance-specific keywords  
    if any(keyword in content.lower() for keyword in ['maintain', 'update', 'consistency', 'world-building']):
        return ['maintenance']
    
    # Embedding/query keywords
    if any(keyword in content.lower() for keyword in ['search', 'query', 'embed', 'vector']):
        return ['embedding']
    
    # Writing style, character, and interaction modules - primarily generation
    if any(keyword in identifier.lower() for keyword in ['style', 'writing', 'character', 'nsfw', 'stance', 'format']):
        return ['generation']
    
    # Default to generation service
    return ['generation']

def determine_core_status(identifier: str, name: str) -> bool:
    """Determine if a module is a core module that cannot be disabled"""
    core_identifiers = [
        'main_system_role',
        'core_writing_style', 
        'general_instructions_constraints',
        'character_development_principles'
    ]
    
    return identifier in core_identifiers or 'core' in name.lower()

def create_nemo_preset_with_services():
    """Create the NemoEngine preset with proper service mapping"""
    
    # Load the original NemoEngine preset
    nemo_data = load_nemo_engine_preset()
    if not nemo_data:
        print("❌ Failed to load NemoEngine preset")
        return False
    
    try:
        # Connect to database
        conn = sqlite3.connect("../are_database.db")
        cursor = conn.cursor()
        
        # Check if preset already exists
        cursor.execute("SELECT id FROM prompt_presets WHERE name = ?", ("NemoEngine v5.8 (Argon Edition)",))
        existing = cursor.fetchone()
        
        if existing:
            preset_id = existing[0]
            print(f"✅ Found existing preset: {preset_id}")
            # Delete existing modules to recreate with service mapping
            cursor.execute("DELETE FROM prompt_modules WHERE preset_id = ?", (preset_id,))
        else:
            # Create new preset
            preset_id = "nemo-engine-v5.8-argon"
            cursor.execute("""
                INSERT INTO prompt_presets (id, name, description, is_default, is_sillytavern_compatible)
                VALUES (?, ?, ?, ?, ?)
            """, (
                preset_id,
                "NemoEngine v5.8 (Argon Edition)",
                "NemoEngine v5.8 adapted for Argon's 4-service architecture with intelligent service distribution",
                True,
                True
            ))
            print(f"✅ Created new preset: {preset_id}")
        
        # Process modules from NemoEngine preset
        prompts = nemo_data.get('prompts', [])
        print(f"Processing {len(prompts)} modules...")
        
        module_count = 0
        for prompt_data in prompts:
            identifier = prompt_data.get('identifier', '')
            name = prompt_data.get('name', 'Unnamed Module')
            content = prompt_data.get('content', '')
            
            # Skip empty or invalid modules
            if not content.strip():
                continue
            
            # Determine service applicability
            applicable_services = determine_service_mapping(identifier, name, content)
            is_core = determine_core_status(identifier, name)
            
            # Determine category
            category = 'core'
            if any(keyword in identifier.lower() for keyword in ['style', 'writing']):
                category = 'style'
            elif any(keyword in identifier.lower() for keyword in ['stance', 'cooperative', 'neutral', 'adversarial']):
                category = 'stance'
            elif any(keyword in identifier.lower() for keyword in ['format', 'color', 'utility']):
                category = 'utility'
            
            # Generate module ID
            module_id = f"nemo-{identifier}" if identifier else f"nemo-module-{module_count}"
            
            # Insert module with service mapping
            cursor.execute("""
                INSERT INTO prompt_modules (
                    id, preset_id, identifier, name, category, content, enabled,
                    injection_position, injection_depth, injection_order,
                    forbid_overrides, role, applicable_services, is_core_module, service_priority
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                module_id,
                preset_id,
                identifier,
                name.replace('📜 ', '').replace('🎨 ', '').replace('✨ ', '').replace('🔧 ', ''),  # Clean name
                category,
                content,
                prompt_data.get('enabled', True),
                prompt_data.get('injection_position', 0),
                prompt_data.get('injection_depth', 4),
                prompt_data.get('injection_order', 0),
                prompt_data.get('forbid_overrides', False),
                prompt_data.get('role', 'system'),
                json.dumps(applicable_services),  # Store as JSON
                is_core,
                0  # Default priority
            ))
            
            module_count += 1
            print(f"  ✅ {name} → Services: {applicable_services} (Core: {is_core})")
        
        # Add Argon-specific enhancement modules
        print("\nAdding Argon enhancement modules...")
        
        # RAG Integration Module
        cursor.execute("""
            INSERT INTO prompt_modules (
                id, preset_id, identifier, name, category, content, enabled,
                injection_position, injection_depth, injection_order,
                forbid_overrides, role, applicable_services, is_core_module, service_priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "argon-rag-integration",
            preset_id,
            "argon_rag_integration",
            "RAG Context Integration",
            "core",
            """## RELEVANT KNOWLEDGE
The following information from your memory and knowledge base is relevant to this conversation:
{{rag_context}}

Use this context to inform your responses, but don't explicitly reference it unless natural.""",
            True,
            0, 4, 5, False, "system",
            json.dumps(["generation"]),
            True,
            1
        ))
        
        # Session Memory Module
        cursor.execute("""
            INSERT INTO prompt_modules (
                id, preset_id, identifier, name, category, content, enabled,
                injection_position, injection_depth, injection_order,
                forbid_overrides, role, applicable_services, is_core_module, service_priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "argon-session-memory",
            preset_id,
            "argon_session_memory",
            "Session Memory Awareness",
            "core",
            """## SESSION MEMORY
Remember that this conversation contributes to your understanding of {{char}} and the world. Pay attention to:
- Character development and personality reveals
- Relationship dynamics and changes
- World-building details and lore
- Important events and consequences

Your responses will be analyzed to update memory systems automatically.""",
            True,
            0, 4, 6, False, "system",
            json.dumps(["generation", "analysis"]),
            True,
            2
        ))
        
        conn.commit()
        conn.close()
        
        print(f"\n✅ Successfully created NemoEngine v5.8 (Argon Edition) with {module_count + 2} modules")
        print("🚀 Preset is ready for use with service-specific architecture!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating preset: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    success = create_nemo_preset_with_services()
    sys.exit(0 if success else 1)
