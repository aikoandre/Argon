#!/usr/bin/env python3
"""
Script to add custom JSON serialization for prompt modules
"""
import json
from typing import List, Optional

def serialize_prompt_module(module) -> dict:
    """Custom serialization for PromptModule to handle JSON fields"""
    
    # Parse applicable_services if it's stored as JSON string
    applicable_services = None
    if hasattr(module, 'applicable_services') and module.applicable_services:
        if isinstance(module.applicable_services, str):
            try:
                applicable_services = json.loads(module.applicable_services)
            except (json.JSONDecodeError, TypeError):
                applicable_services = [module.applicable_services]
        elif isinstance(module.applicable_services, list):
            applicable_services = module.applicable_services
    
    return {
        "id": module.id,
        "preset_id": module.preset_id,
        "identifier": module.identifier,
        "name": module.name,
        "category": module.category,
        "content": module.content,
        "enabled": module.enabled,
        "injection_position": module.injection_position,
        "injection_depth": module.injection_depth,
        "injection_order": module.injection_order,
        "forbid_overrides": module.forbid_overrides,
        "role": module.role,
        "applicable_services": applicable_services,
        "is_core_module": getattr(module, 'is_core_module', False),
        "service_priority": getattr(module, 'service_priority', 0),
        "created_at": module.created_at.isoformat() if module.created_at else None,
        "updated_at": module.updated_at.isoformat() if module.updated_at else None,
    }

def serialize_prompt_preset_with_modules(preset) -> dict:
    """Custom serialization for PromptPreset with modules"""
    
    modules = [serialize_prompt_module(module) for module in preset.modules]
    
    return {
        "id": preset.id,
        "name": preset.name,
        "description": preset.description,
        "is_default": preset.is_default,
        "is_sillytavern_compatible": preset.is_sillytavern_compatible,
        "created_at": preset.created_at.isoformat() if preset.created_at else None,
        "updated_at": preset.updated_at.isoformat() if preset.updated_at else None,
        "modules": modules
    }
