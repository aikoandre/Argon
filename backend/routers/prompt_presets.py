# backend/routers/prompt_presets.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
import uuid

from db.database import get_db
from models.prompt_preset import PromptPreset, PromptModule, UserPromptConfiguration
from schemas.prompt_presets import (
    PromptPresetResponse, PromptPresetCreate, PromptPresetUpdate,
    PromptModuleResponse, PromptModuleUpdate,
    UserPromptConfigurationResponse, UserPromptConfigurationUpdate
)
from services.sillytavern_import_service import sillytavern_import_service
from utils.prompt_serialization import serialize_prompt_module, serialize_prompt_preset_with_modules

router = APIRouter(
    prefix="/prompt-presets",
    tags=["Prompt Presets"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[PromptPresetResponse])
async def get_prompt_presets(db: Session = Depends(get_db)):
    """Get all available prompt presets"""
    presets = db.query(PromptPreset).all()
    return presets

@router.get("/{preset_id}")
async def get_prompt_preset(preset_id: str, db: Session = Depends(get_db)):
    """Get a specific prompt preset with its modules"""
    preset = db.query(PromptPreset).filter(PromptPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    return serialize_prompt_preset_with_modules(preset)

@router.post("/", response_model=PromptPresetResponse)
async def create_prompt_preset(
    preset_data: PromptPresetCreate,
    db: Session = Depends(get_db)
):
    """Create a new prompt preset"""
    preset = PromptPreset(
        id=str(uuid.uuid4()),
        **preset_data.model_dump()
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset

@router.put("/{preset_id}", response_model=PromptPresetResponse)
async def update_prompt_preset(
    preset_id: str,
    preset_data: PromptPresetUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing prompt preset"""
    preset = db.query(PromptPreset).filter(PromptPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    for field, value in preset_data.model_dump(exclude_unset=True).items():
        setattr(preset, field, value)
    
    db.commit()
    db.refresh(preset)
    return preset

@router.delete("/{preset_id}")
async def delete_prompt_preset(preset_id: str, db: Session = Depends(get_db)):
    """Delete a prompt preset and all its modules"""
    preset = db.query(PromptPreset).filter(PromptPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    db.delete(preset)
    db.commit()
    return {"message": "Preset deleted successfully"}

@router.get("/{preset_id}/modules")
async def get_preset_modules(preset_id: str, db: Session = Depends(get_db)):
    """Get all modules for a specific preset"""
    modules = db.query(PromptModule).filter(PromptModule.preset_id == preset_id).all()
    return [serialize_prompt_module(module) for module in modules]

@router.put("/{preset_id}/modules/{module_id}")
async def update_prompt_module(
    preset_id: str,
    module_id: str,
    module_data: PromptModuleUpdate,
    db: Session = Depends(get_db)
):
    """Update a specific prompt module"""
    module = db.query(PromptModule).filter(
        PromptModule.id == module_id,
        PromptModule.preset_id == preset_id
    ).first()
    
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Handle applicable_services serialization
    update_data = module_data.model_dump(exclude_unset=True)
    if 'applicable_services' in update_data and update_data['applicable_services'] is not None:
        update_data['applicable_services'] = json.dumps(update_data['applicable_services'])
    
    for field, value in update_data.items():
        setattr(module, field, value)
    
    db.commit()
    db.refresh(module)
    return serialize_prompt_module(module)

@router.post("/import-sillytavern", response_model=PromptPresetResponse)
async def import_sillytavern_preset(
    file: UploadFile = File(...),
    preset_name: str = None,
    db: Session = Depends(get_db)
):
    """Import a SillyTavern JSON configuration file"""
    try:
        # Read and parse the uploaded file
        content = await file.read()
        sillytavern_data = json.loads(content.decode('utf-8'))
        
        # Use filename as preset name if not provided
        if not preset_name:
            preset_name = file.filename.replace('.json', '') if file.filename else "Imported Preset"
        
        # Import using the service
        preset = sillytavern_import_service.import_sillytavern_preset(
            sillytavern_data, preset_name, db
        )
        
        return preset
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@router.post("/create-nemo-engine", response_model=PromptPresetResponse)
async def create_nemo_engine_preset(db: Session = Depends(get_db)):
    """Create the curated NemoEngine preset"""
    try:
        preset = sillytavern_import_service.get_nemo_engine_preset(db)
        return preset
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create NemoEngine preset: {str(e)}")

# --- USER CONFIGURATION ENDPOINTS ---

@router.get("/user/configuration", response_model=UserPromptConfigurationResponse)
async def get_user_configuration(db: Session = Depends(get_db)):
    """Get the user's active prompt configuration and parameters"""
    from services.user_configuration_service import user_configuration_service
    
    try:
        config = await user_configuration_service.get_or_create_user_configuration(db, 1)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user configuration: {str(e)}")

@router.put("/user/configuration", response_model=UserPromptConfigurationResponse)
async def update_user_configuration(
    updates: UserPromptConfigurationUpdate,
    db: Session = Depends(get_db)
):
    """Update the user's prompt configuration parameters"""
    from services.user_configuration_service import user_configuration_service
    
    try:
        # Convert Pydantic model to dict, excluding None values
        update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
        
        config = await user_configuration_service.update_user_configuration(db, 1, update_dict)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update user configuration: {str(e)}")

@router.get("/user/merged-settings")
async def get_merged_user_settings(db: Session = Depends(get_db)):
    """Get complete user settings including prompt preset parameters"""
    from services.user_configuration_service import user_configuration_service
    
    try:
        settings = await user_configuration_service.get_merged_user_settings(db, 1)
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get merged settings: {str(e)}")

@router.post("/create-default-nemo")
async def create_default_nemo_preset(db: Session = Depends(get_db)):
    """Create the default NemoEngine v5.8 preset if it doesn't exist"""
    try:
        # Check if default preset already exists
        existing_default = db.query(PromptPreset).filter(PromptPreset.is_default == True).first()
        if existing_default:
            return {"message": "Default preset already exists", "preset_id": existing_default.id}
          # Create default NemoEngine preset
        preset = await sillytavern_import_service.create_default_nemo_engine_preset(db)
        return {"message": "Default NemoEngine preset created successfully", "preset_id": preset.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create default preset: {str(e)}")

@router.post("/create-default-cherrybox")
async def create_default_cherrybox_preset(db: Session = Depends(get_db)):
    """Create or set CherryBox as the default preset, replacing NemoEngine"""
    try:
        # Check if CherryBox already exists
        existing_cherrybox = db.query(PromptPreset).filter(
            PromptPreset.name == "CherryBox Argon Edition"
        ).first()
        
        if existing_cherrybox:
            # Set as default and return
            # Remove default from other presets first
            other_defaults = db.query(PromptPreset).filter(
                PromptPreset.is_default == True,
                PromptPreset.id != existing_cherrybox.id
            ).all()
            for preset in other_defaults:
                preset.is_default = False
            
            existing_cherrybox.is_default = True
            db.commit()
            
            return {
                "message": "CherryBox preset set as default", 
                "preset_id": existing_cherrybox.id,
                "module_count": len(existing_cherrybox.modules)
            }
        
        # Remove default from existing presets
        existing_defaults = db.query(PromptPreset).filter(PromptPreset.is_default == True).all()
        for preset in existing_defaults:
            preset.is_default = False
        
        # Create new CherryBox preset
        cherrybox_preset = sillytavern_import_service.create_cherrybox_preset(db)
        
        return {
            "message": "CherryBox preset created and set as default", 
            "preset_id": cherrybox_preset.id,
            "module_count": len(cherrybox_preset.modules)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create CherryBox preset: {str(e)}")

@router.post("/user/toggle-module/{preset_id}/{module_id}")
async def toggle_prompt_module(
    preset_id: str,
    module_id: str,
    enabled: bool = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """Toggle a prompt module on/off for real-time updates"""
    try:
        module = db.query(PromptModule).filter(
            PromptModule.id == module_id,
            PromptModule.preset_id == preset_id
        ).first()
        
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")
        
        module.enabled = enabled
        db.commit()
        db.refresh(module)
        
        return serialize_prompt_module(module)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle module: {str(e)}")

@router.get("/context-recommendations/{provider}/{model_name}")
async def get_context_recommendations(provider: str, model_name: str):
    """Get context size recommendations for a specific model"""
    try:
        from services.model_context_service import ModelContextService
        
        context_service = ModelContextService()
        # Try with full provider/model format first, then just model name
        full_model_name = f"{provider}/{model_name}"
        recommendations = context_service.get_context_recommendations(full_model_name)
        
        if not recommendations:
            # Fallback to just model name
            recommendations = context_service.get_context_recommendations(model_name)
        
        if not recommendations:
            raise HTTPException(status_code=404, detail=f"No context recommendations found for model: {full_model_name}")
        
        return recommendations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get context recommendations: {str(e)}")

@router.post("/validate-context-size")
async def validate_context_size(
    validation_request: Dict[str, Any] = Body(...)
):
    """Validate context size for a model and message count"""
    try:
        from services.model_context_service import ModelContextService
        
        model_name = validation_request.get("model_name")
        requested_messages = validation_request.get("requested_messages")
        
        if not model_name or requested_messages is None:
            raise HTTPException(status_code=400, detail="model_name and requested_messages are required")
        
        context_service = ModelContextService()
        result = context_service.validate_context_size(model_name, requested_messages)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate context size: {str(e)}")
