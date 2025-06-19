#!/usr/bin/env python3
"""
Initialize default NemoEngine preset directly
"""

import sqlite3
import json
import uuid
from datetime import datetime

def create_default_preset():
    """Create the default NemoEngine v5.8 preset directly in database"""
    
    db_path = '../are_database.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        preset_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        # Create the preset
        cursor.execute("""
            INSERT INTO prompt_presets (id, name, description, is_default, is_sillytavern_compatible, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            preset_id,
            "NemoEngine v5.8 (Experimental) (Deepseek) V3",
            "Advanced reasoning and character consistency engine with enhanced response quality",
            True,
            True,
            now
        ))
        
        # Define the NemoEngine modules
        modules = [
            {
                "identifier": "nemo_main",
                "name": "Main Instructions",
                "category": "core",
                "content": """# Assistant Behavior
You are an advanced AI assistant that engages in roleplay while maintaining character consistency and narrative quality.

## Core Guidelines
- Maintain character voice and personality throughout interactions
- Respond with appropriate length and detail for the context
- Keep track of established story elements and character relationships
- Balance creativity with consistency to established lore""",
                "injection_position": "system_prefix",
                "injection_depth": 0,
                "injection_order": 0
            },
            {
                "identifier": "nemo_reasoning",
                "name": "Reasoning Enhancement",
                "category": "core", 
                "content": """# Enhanced Reasoning
Before responding, consider:
1. Character motivations and current emotional state
2. Relationship dynamics and established history
3. Environmental context and situational factors
4. Narrative consistency with previous events
5. Appropriate response tone and length

Use this analysis to craft responses that feel natural and authentic.""",
                "injection_position": "system_prefix",
                "injection_depth": 1,
                "injection_order": 1
            },
            {
                "identifier": "nemo_character",
                "name": "Character Consistency",
                "category": "style",
                "content": """# Character Consistency
- Stay true to the character's established personality traits
- Maintain consistent speech patterns, vocabulary, and mannerisms
- Reflect the character's background, experiences, and worldview
- Show character growth appropriately over time
- Remember important character details and relationships""",
                "injection_position": "system_suffix",
                "injection_depth": 0,
                "injection_order": 0
            },
            {
                "identifier": "nemo_narrative",
                "name": "Narrative Quality",
                "category": "style",
                "content": """# Narrative Enhancement
- Write with appropriate pacing for the scene
- Include relevant sensory details and environmental context
- Balance dialogue with action and internal thoughts
- Maintain story momentum and engagement
- Use varied sentence structure and descriptive language""",
                "injection_position": "system_suffix",
                "injection_depth": 1,
                "injection_order": 1
            },
            {
                "identifier": "nemo_stance",
                "name": "Response Stance",
                "category": "stance",
                "content": """# Response Guidelines
- Respond in character with appropriate emotional depth
- Match the energy and tone of the ongoing conversation
- Provide responses that advance the narrative meaningfully
- Be concise when appropriate, detailed when the moment calls for it
- Maintain immersion through consistent character portrayal""",
                "injection_position": "chat_prefix",
                "injection_depth": 0,
                "injection_order": 0
            },
            {
                "identifier": "nemo_format",
                "name": "Format Guidelines", 
                "category": "utility",
                "content": """# Response Format
- Use clear paragraph breaks for readability
- Separate dialogue, actions, and thoughts appropriately
- Include relevant character actions and reactions
- Keep response length appropriate to the scene's needs
- Ensure proper grammar and punctuation""",
                "injection_position": "chat_suffix",
                "injection_depth": 0,
                "injection_order": 0
            }
        ]
        
        # Insert modules
        for i, module in enumerate(modules):
            module_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO prompt_modules 
                (id, preset_id, identifier, name, category, content, enabled, 
                 injection_position, injection_depth, injection_order, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                module_id,
                preset_id,
                module["identifier"],
                module["name"], 
                module["category"],
                module["content"],
                True,
                module["injection_position"],
                module["injection_depth"],
                module["injection_order"],
                "system",
                now
            ))
        
        conn.commit()
        print(f"✅ Successfully created NemoEngine v5.8 preset with ID: {preset_id}")
        print(f"   Created {len(modules)} prompt modules:")
        
        for module in modules:
            print(f"   - {module['category'].upper()}: {module['name']}")
        
        print("\n🎯 Default preset is now ready for use!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating default preset: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    create_default_preset()
