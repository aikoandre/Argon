# backend/services/prompt_compatibility_service.py
import json
import uuid
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from models.prompt_preset import PromptPreset, PromptModule
from services.sillytavern_import_service import sillytavern_import_service

class PromptCompatibilityService:
    """
    Service to handle two-way compatibility with SillyTavern prompt formats.
    Enables import from SillyTavern and export back to SillyTavern format.
    """
    
    def __init__(self):
        self.argon_service_mapping = {
            # Map SillyTavern identifiers to Argon service applicability
            'main_system_role': ['generation', 'analysis'],
            'jailbreak_unrestricted': ['generation'],
            'core_writing_style': ['generation'],
            'general_instructions_constraints': ['generation', 'maintenance'],
            'user_input_interpretation_guide': ['generation'],
            'character_development_principles': ['generation', 'analysis'],
            'nsfw': ['generation'],
            'danger_protocol': ['generation'],
            'color_formatting': ['generation'],
            'stance_cooperative': ['generation'],
            'stance_neutral': ['generation'],
            'stance_adversarial': ['generation'],
            'style_ao3_flavor': ['generation'],
            'style_ironic_comedy': ['generation'],
        }
    
    def import_sillytavern_preset(
        self, 
        sillytavern_json: Dict[str, Any], 
        preset_name: str,
        db: Session
    ) -> PromptPreset:
        """
        Import SillyTavern JSON and convert to Argon's multi-service format.
        """
        
        preset_id = str(uuid.uuid4())
        preset = PromptPreset(
            id=preset_id,
            name=preset_name,
            description=f"Imported from SillyTavern - {preset_name}",
            is_sillytavern_compatible=True,
            is_default=False
        )
        
        db.add(preset)
        
        # Process each prompt from SillyTavern
        prompts = sillytavern_json.get('prompts', [])
        
        for prompt_data in prompts:
            if self._should_import_prompt(prompt_data):
                module = self._convert_sillytavern_to_argon_module(prompt_data, preset_id)
                if module:
                    db.add(module)
        
        # Create Argon-specific enhancement modules
        self._add_argon_enhancement_modules(preset_id, db)
        
        db.commit()
        db.refresh(preset)
        
        return preset
    
    def _convert_sillytavern_to_argon_module(
        self, 
        sillytavern_prompt: Dict[str, Any], 
        preset_id: str
    ) -> Optional[PromptModule]:
        """
        Convert a single SillyTavern prompt to Argon PromptModule format.
        """
        
        identifier = sillytavern_prompt.get('identifier', '')
        name = sillytavern_prompt.get('name', 'Unnamed Prompt')
        content = sillytavern_prompt.get('content', '')
        
        # Determine applicable services for this module
        applicable_services = self._determine_applicable_services(identifier, content)
        
        # Clean up the name for Argon display
        clean_name = self._clean_sillytavern_name(name)
        
        # Determine category
        category = self._determine_category(identifier, name)
        
        module = PromptModule(
            id=str(uuid.uuid4()),
            preset_id=preset_id,
            identifier=identifier,
            name=clean_name,
            category=category,
            content=content,
            enabled=sillytavern_prompt.get('enabled', True),
            injection_position=sillytavern_prompt.get('injection_position', 0),
            injection_depth=sillytavern_prompt.get('injection_depth', 4),
            injection_order=sillytavern_prompt.get('injection_order', 0),
            forbid_overrides=sillytavern_prompt.get('forbid_overrides', False),
            role=sillytavern_prompt.get('role', 'system'),
            # Argon-specific fields
            applicable_services=json.dumps(applicable_services)  # Store as JSON
        )
        
        return module
    
    def _determine_applicable_services(self, identifier: str, content: str) -> List[str]:
        """
        Determine which Argon services this SillyTavern module should apply to.
        """
        
        # Use predefined mapping if available
        if identifier in self.argon_service_mapping:
            return self.argon_service_mapping[identifier]
        
        # Fallback: analyze content for service applicability
        content_lower = content.lower()
        services = []
        
        # Generation service (most SillyTavern modules apply here)
        if any(keyword in content_lower for keyword in ['character', 'roleplay', 'story', 'dialogue', 'narrative']):
            services.append('generation')
        
        # Analysis service
        if any(keyword in content_lower for keyword in ['analyze', 'extract', 'relationship', 'memory']):
            services.append('analysis')
        
        # Maintenance service
        if any(keyword in content_lower for keyword in ['world', 'consistency', 'background', 'maintain']):
            services.append('maintenance')
        
        # Default to generation if no specific keywords found
        if not services:
            services.append('generation')
        
        return services
    
    def _add_argon_enhancement_modules(self, preset_id: str, db: Session):
        """
        Add Argon-specific modules that enhance SillyTavern imports.
        These modules handle RAG integration and multi-service coordination.
        """
        
        # RAG Integration Module
        rag_module = PromptModule(
            id=str(uuid.uuid4()),
            preset_id=preset_id,
            identifier='argon_rag_integration',
            name='RAG Context Integration',
            category='core',
            content='''## RELEVANT KNOWLEDGE
The following information from your memory and knowledge base is relevant to this conversation:
{{rag_context}}

Use this context to inform your responses, but don't explicitly reference it unless natural.''',
            enabled=True,
            injection_position=0,
            injection_depth=4,
            injection_order=5,  # After core SillyTavern modules
            forbid_overrides=False,
            role='system',
            applicable_services=json.dumps(['generation'])
        )
        
        # Session Memory Module
        memory_module = PromptModule(
            id=str(uuid.uuid4()),
            preset_id=preset_id,
            identifier='argon_session_memory',
            name='Session Memory Awareness',
            category='core',
            content='''## SESSION MEMORY
Remember that this conversation contributes to your understanding of {{char}} and the world. Pay attention to:
- Character development and personality reveals
- Relationship dynamics and changes
- World-building details and lore
- Important events and consequences

Your responses will be analyzed to update memory systems automatically.''',
            enabled=True,
            injection_position=0,
            injection_depth=4,
            injection_order=6,
            forbid_overrides=False,
            role='system',
            applicable_services=json.dumps(['generation', 'analysis'])
        )
        
        db.add(rag_module)
        db.add(memory_module)
    
    def export_to_sillytavern_format(
        self, 
        preset: PromptPreset, 
        db: Session
    ) -> Dict[str, Any]:
        """
        Export an Argon preset back to SillyTavern JSON format.
        """
        
        # Get all modules for this preset
        modules = db.query(PromptModule).filter(
            PromptModule.preset_id == preset.id
        ).all()
        
        # Convert Argon modules back to SillyTavern format
        sillytavern_prompts = []
        
        for module in modules:
            # Skip Argon-specific modules when exporting
            if module.identifier.startswith('argon_'):
                continue
                
            sillytavern_prompt = {
                'identifier': module.identifier,
                'name': self._restore_sillytavern_name(module.name, module.category),
                'system_prompt': False,
                'role': module.role,
                'content': module.content,
                'injection_position': module.injection_position,
                'injection_depth': module.injection_depth,
                'injection_order': module.injection_order,
                'forbid_overrides': module.forbid_overrides,
                'enabled': module.enabled
            }
            
            sillytavern_prompts.append(sillytavern_prompt)
        
        # Create full SillyTavern export format
        sillytavern_export = {
            'name': preset.name,
            'description': preset.description,
            'prompts': sillytavern_prompts,
            # Default SillyTavern parameters
            'temperature': 1.0,
            'top_p': 1.0,
            'top_k': 40,
            'frequency_penalty': 0,
            'presence_penalty': 0,
            'repetition_penalty': 1,
            'max_context_unlocked': False,
            'stream_openai': True
        }
        
        return sillytavern_export
    
    def _restore_sillytavern_name(self, clean_name: str, category: str) -> str:
        """
        Restore SillyTavern-style emoji prefixes for export compatibility.
        """
        
        category_prefixes = {
            'core': '📜︱System: ',
            'style': '🎨︱Style: ',
            'stance': '✨︱OPTIONAL STANCE: ',
            'utility': '🔧︱Utility: '
        }
        
        prefix = category_prefixes.get(category, '')
        return f"{prefix}{clean_name}"
    
    # ...existing helper methods...

# Service instance
prompt_compatibility_service = PromptCompatibilityService()
