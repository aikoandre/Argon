from fastapi import APIRouter, Depends, HTTPException, status, Body, Path
from sqlalchemy.orm import Session
from typing import List, Optional
from models.temp_message_variant import TempMessageVariant
from models.temp_variant_analysis import TempVariantAnalysis
from models.temp_variant_memory import TempVariantMemory
from models.chat_message import ChatMessage
from models.full_analysis_result import FullAnalysisResult
from db.database import get_db

router = APIRouter(tags=["Variants"], prefix="/variants")

@router.get("/message/{message_id}", response_model=dict)
def list_variants_for_message(message_id: str, db: Session = Depends(get_db)):
    """
    List all variants for a message. If no variants exist, return the original message as variant 0.
    """
    # Get existing variants
    variants = db.query(TempMessageVariant).filter(
        TempMessageVariant.original_message_id == message_id
    ).order_by(TempMessageVariant.variant_index.asc()).all()
    
    # If no variants exist, get the original message and return it as the first variant
    if not variants:
        original_message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
        if not original_message:
            raise HTTPException(status_code=404, detail="Message not found.")
        
        if original_message.sender_type != "AI":
            raise HTTPException(status_code=400, detail="Variants are only available for AI messages.")
        
        return {
            "variants": [{
                "id": f"original_{message_id}",  # Special ID for original message
                "variant_index": 0,
                "content": original_message.content,
                "sender_type": original_message.sender_type,
                "active_persona_name": original_message.active_persona_name,
                "active_persona_image_url": original_message.active_persona_image_url,
                "message_metadata": original_message.message_metadata,
                "created_at": original_message.timestamp,
                "is_original": True
            }]
        }
    
    # Return existing variants
    variant_list = []
    for v in variants:
        variant_list.append({
            "id": v.id,
            "variant_index": v.variant_index,
            "content": v.content,
            "sender_type": v.sender_type,
            "active_persona_name": v.active_persona_name,
            "active_persona_image_url": v.active_persona_image_url,
            "message_metadata": v.message_metadata,
            "created_at": v.created_at,
            "is_original": v.variant_index == 0
        })
    
    return {"variants": variant_list}

@router.post("/message/{message_id}/generate", response_model=dict)
async def generate_variant_for_message(message_id: str, db: Session = Depends(get_db)):
    """
    Generate a new AI variant for the given message by re-running the generation pipeline
    with slightly different parameters for variety.
    """
    # Get the original AI message
    original_message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not original_message:
        raise HTTPException(status_code=404, detail="Original message not found.")
    
    if original_message.sender_type != "AI":
        raise HTTPException(status_code=400, detail="Can only generate variants for AI messages.")
    
    # Find the user message that prompted this AI response
    chat_messages = db.query(ChatMessage).filter(
        ChatMessage.chat_session_id == original_message.chat_session_id
    ).order_by(ChatMessage.timestamp.asc()).all()
    
    # Find the index of the current AI message
    ai_message_index = next((i for i, msg in enumerate(chat_messages) if msg.id == message_id), -1)
    if ai_message_index == -1:
        raise HTTPException(status_code=404, detail="AI message not found in conversation.")
    
    # Find the preceding user message
    user_message = None
    for i in range(ai_message_index - 1, -1, -1):
        if chat_messages[i].sender_type == "USER":
            user_message = chat_messages[i]
            break
    
    if not user_message:
        raise HTTPException(status_code=400, detail="No user message found before this AI response.")
    
    # Check if we already have variants for this message, get the next variant index
    existing_variants = db.query(TempMessageVariant).filter(
        TempMessageVariant.original_message_id == message_id
    ).all()
    
    # If no variants exist yet, create the first one from the original message
    if not existing_variants:
        # Create variant 0 from the original message
        original_variant = TempMessageVariant(
            original_message_id=message_id,
            chat_session_id=original_message.chat_session_id,
            variant_index=0,
            content=original_message.content,
            sender_type=original_message.sender_type,
            active_persona_name=original_message.active_persona_name,
            active_persona_image_url=original_message.active_persona_image_url,
            message_metadata=original_message.message_metadata,
        )
        db.add(original_variant)
        db.commit()
        existing_variants = [original_variant]
    
    next_variant_index = len(existing_variants)
    
    # Import the chat message generation logic and models
    from routers.chat import (
        USER_SETTINGS_ID, QueryTransformationService,
        jinja_env, replace_jinja_undefined,
        get_text_to_embed_from_lore_entry,
        is_reasoning_capable_model,
        AIPersonaCardInfo, MessagePreprocessingService
    )
    from services.litellm_service import litellm_service
    
    # Import models directly from their respective modules
    from models.user_settings import UserSettings
    from models.character_card import CharacterCard
    from models.scenario_card import ScenarioCard
    from models.user_persona import UserPersona
    from models.lore_entry import LoreEntry as LoreEntryModel
    from models.session_lore_modification import SessionLoreModification
    from models.session_cache_fact import SessionCacheFact
    from models.user_prompt_instructions import UserPromptInstructions
    
    # Get user settings and session details
    user_settings = db.query(UserSettings).filter(UserSettings.id == USER_SETTINGS_ID).first()
    if not user_settings:
        raise HTTPException(status_code=500, detail="User settings not found.")
    
    # Get session details
    from models.chat_session import ChatSession
    session = db.query(ChatSession).filter(ChatSession.id == original_message.chat_session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    
    # Get AI persona card
    if session.card_type == "character":
        ai_persona_card = db.query(CharacterCard).filter(CharacterCard.id == session.card_id).first()
    elif session.card_type == "scenario":
        ai_persona_card = db.query(ScenarioCard).filter(ScenarioCard.id == session.card_id).first()
    else:
        raise HTTPException(status_code=400, detail="Unknown card type.")
    
    if not ai_persona_card:
        raise HTTPException(status_code=404, detail="AI persona card not found.")
    
    # Get user persona
    user_persona = session.user_persona or db.query(UserPersona).filter(UserPersona.name == "User").first()
    
    # Load user prompt instructions
    user_prompt_instructions = db.query(UserPromptInstructions).filter(UserPromptInstructions.id == 1).first()
    if not user_prompt_instructions:
        user_prompt_instructions = UserPromptInstructions(
            id=1, primary_instructions="", extraction_instructions="", analysis_instructions=""
        )
    
    # Build user settings dict for LiteLLM service
    db_user_settings = {
        "primary_llm_provider": getattr(user_settings, "primary_llm_provider", None),
        "primary_llm_model": getattr(user_settings, "primary_llm_model", None), 
        "primary_llm_api_key": getattr(user_settings, "primary_llm_api_key", None),
        "primary_llm_api_key_new": getattr(user_settings, "primary_llm_api_key_new", None),
        "selected_llm_model": user_settings.selected_llm_model,
        "llm_provider": user_settings.llm_provider,
        "mistral_api_key": user_settings.mistral_api_key,
        "max_response_tokens": user_settings.max_response_tokens,
        "top_p": user_settings.top_p
    }
    
    # Determine provider, model and API key for primary LLM
    if db_user_settings.get("primary_llm_provider") and db_user_settings.get("primary_llm_model"):
        # Use new LiteLLM configuration
        provider = db_user_settings["primary_llm_provider"].lower()
        model = db_user_settings["primary_llm_model"]
        api_key = db_user_settings.get("primary_llm_api_key_new") or db_user_settings.get("primary_llm_api_key")
    else:
        # Fall back to legacy configuration
        if user_settings.llm_provider == "OpenRouter":
            if not user_settings.primary_llm_api_key:
                raise HTTPException(status_code=500, detail="OpenRouter API key is missing.")
            provider = "openrouter"
            model = user_settings.selected_llm_model
            api_key = user_settings.primary_llm_api_key
        elif user_settings.llm_provider == "MistralDirect":
            if not user_settings.mistral_api_key:
                raise HTTPException(status_code=500, detail="Mistral API key is missing.")
            provider = "mistral"
            model = user_settings.selected_llm_model
            api_key = user_settings.mistral_api_key
        else:
            raise HTTPException(status_code=400, detail="Unsupported LLM provider.")
    
    if not api_key:
        raise HTTPException(status_code=500, detail="Primary LLM API key is missing.")
    if not model:
        raise HTTPException(status_code=500, detail="Primary LLM model is missing.")
    
    # Process the user message through preprocessing
    preprocessing_service = MessagePreprocessingService()
    ai_character_name = preprocessing_service.get_ai_character_name(ai_persona_card)
    user_persona_name = preprocessing_service.get_user_persona_name(user_persona)
    preprocessed_message = preprocessing_service.preprocess_user_message(
        user_message.content, ai_character_name, user_persona_name
    )
    
    # Build context similar to the original generation
    ai_persona_card_info = AIPersonaCardInfo.model_validate(ai_persona_card)
    
    # Get chat history up to the user message (excluding the original AI response)
    messages_for_context = chat_messages[:ai_message_index]
    chat_history_formatted = ""
    for msg in messages_for_context[:-1]:  # Exclude the current user message
        sender_name = "User" if msg.sender_type == "USER" else (msg.active_persona_name or ai_persona_card.name)
        chat_history_formatted += f"{sender_name}: {msg.content}\n"
    
    # Get session cache facts for panel data
    session_cache_facts = db.query(SessionCacheFact).filter(SessionCacheFact.chat_session_id == session.id).all()
    current_panel_data = {fact.key: fact.value for fact in session_cache_facts if fact.key and fact.value}
    
    # Build the generation context
    main_llm_context = {
        "ai_persona_card": ai_persona_card_info,
        "user_persona": {
            "name": user_persona_name,
            "description": user_persona.description if user_persona else "A generic user."
        },
        "user_input": preprocessed_message.content,
        "chat_history_formatted": chat_history_formatted.strip(),
        "reranked_lore_entries": [],  # Skip RAG for variants to focus on pure generation variety
        "current_panel_data": current_panel_data,
        "active_events": [],
        "reasoning_model_available": is_reasoning_capable_model(model),
        "user_prompt_instructions": user_prompt_instructions,
        "get_text_to_embed_from_lore_entry": get_text_to_embed_from_lore_entry,
    }
    
    main_llm_context = replace_jinja_undefined(main_llm_context)
    
    # Load the generation template
    main_llm_prompt_template = jinja_env.get_template('main_generation_enhanced.jinja2')
    final_full_prompt = main_llm_prompt_template.render(main_llm_context)
    
    # Handle OOC messages
    if preprocessed_message.is_ooc:
        ooc_system_prompt = f"""You are an AI assistant helping with roleplay management. The user has sent an out-of-character (OOC) message.

Original character context: {ai_persona_card_info.name} - {ai_persona_card_info.description}

Respond helpfully to their OOC request without staying in character."""
        final_llm_messages = [
            {"role": "system", "content": ooc_system_prompt},
            {"role": "user", "content": f"[OOC] {preprocessed_message.ooc_content}"}
        ]
    else:
        final_llm_messages = [
            {"role": "system", "content": final_full_prompt},
            {"role": "user", "content": preprocessed_message.content}
        ]
    
    # Generate with slightly different parameters for variety
    # Increase temperature slightly for more variation
    base_temperature = 0.7
    variant_temperature = min(1.0, base_temperature + (next_variant_index * 0.1))
    
    try:
        # Use LiteLLM service for variant generation
        response = await litellm_service.get_completion(
            provider=provider,
            model=model,
            messages=final_llm_messages,
            api_key=api_key,
            temperature=variant_temperature,
            max_tokens=user_settings.max_response_tokens,
            top_p=user_settings.top_p
        )
        
        # Extract content from LiteLLM response
        if isinstance(response, dict) and "choices" in response:
            ai_response_content = response["choices"][0]["message"]["content"]
        else:
            ai_response_content = str(response)
        
        if not ai_response_content:
            raise Exception("Empty response from LLM")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate variant: {str(e)}")
    
    # Extract panel data if present
    import re
    import json
    
    extracted_panel_data = None
    try:
        panel_pattern = r'\[PANEL_UPDATE\]\s*(\{.*?\})\s*\[/PANEL_UPDATE\]'
        panel_match = re.search(panel_pattern, ai_response_content, re.DOTALL)
        
        if panel_match:
            panel_json_str = panel_match.group(1)
            try:
                extracted_panel_data = json.loads(panel_json_str)
                # Remove the panel update block from the response
                ai_response_content = re.sub(panel_pattern, '', ai_response_content, flags=re.DOTALL).strip()
            except json.JSONDecodeError:
                pass  # Keep panel data in response if parsing fails
    except Exception:
        pass  # Continue without panel extraction
    
    # Create the new variant
    new_variant = TempMessageVariant(
        original_message_id=message_id,
        chat_session_id=original_message.chat_session_id,
        variant_index=next_variant_index,
        content=ai_response_content,
        sender_type="AI",
        active_persona_name=original_message.active_persona_name,
        active_persona_image_url=original_message.active_persona_image_url,
        message_metadata={
            "generation_temperature": variant_temperature,
            "variant_generation": True,
            **(extracted_panel_data or {})
        },
    )
    
    db.add(new_variant)
    db.commit()
    db.refresh(new_variant)

    # Run full interaction analysis for the generated variant
    try:
        from backend.background_tasks import run_full_interaction_analysis
        # Prepare last 9 previous messages for analysis (excluding the new variant)
        chat_messages = db.query(ChatMessage).filter(
            ChatMessage.chat_session_id == original_message.chat_session_id
        ).order_by(ChatMessage.timestamp.asc()).all()
        # Add all previous messages up to the user message that prompted this variant
        ai_message_index = next((i for i, msg in enumerate(chat_messages) if msg.id == message_id), -1)
        messages_before_current = chat_messages[:ai_message_index] if ai_message_index > 0 else []
        last_9_prev_messages = []
        if messages_before_current:
            start_index = max(0, len(messages_before_current) - 9)
            for msg in messages_before_current[start_index:]:
                last_9_prev_messages.append({
                    "sender_type": msg.sender_type,
                    "content": msg.content,
                    "active_persona_name": getattr(msg, "active_persona_name", None)
                })
        await run_full_interaction_analysis(
            db=db,
            chat_id=str(original_message.chat_session_id),
            user_message=user_message.content,
            ai_response=ai_response_content,
            rag_results=[],  # RAG context can be added if available
            ai_persona_card_data={
                "id": str(ai_persona_card.id),
                "name": ai_persona_card.name,
                "description": ai_persona_card.description,
                "instructions": getattr(ai_persona_card, 'instructions', None)
            },
            user_persona_data={
                "name": user_persona.name if user_persona else "User",
                "description": user_persona.description if user_persona else "A generic user."
            },
            active_event_details=None,
            analysis_llm_api_key=user_settings.analysis_llm_api_key,
            analysis_llm_model=user_settings.analysis_llm_model,
            last_9_prev_messages=last_9_prev_messages
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to complete full analysis for variant: {str(e)}")

    return {
        "id": new_variant.id, 
        "variant_index": new_variant.variant_index, 
        "content": new_variant.content,
        "temperature_used": variant_temperature
    }

@router.post("/message/{message_id}/select/{variant_id}", response_model=dict)
def select_variant_for_message(message_id: str, variant_id: str, db: Session = Depends(get_db)):
    # Commit the selected variant as a permanent ChatMessage and FullAnalysisResult
    variant = db.query(TempMessageVariant).filter(TempMessageVariant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found.")
    # Create permanent ChatMessage
    committed_msg = ChatMessage(
        chat_session_id=variant.chat_session_id,
        sender_type=variant.sender_type,
        content=variant.content,
        active_persona_name=variant.active_persona_name,
        active_persona_image_url=variant.active_persona_image_url,
        message_metadata=variant.message_metadata,
    )
    db.add(committed_msg)
    db.commit()
    db.refresh(committed_msg)
    # Move analysis if exists
    analysis = db.query(TempVariantAnalysis).filter(TempVariantAnalysis.variant_id == variant_id).first()
    if analysis:
        full_analysis = FullAnalysisResult(
            chat_session_id=variant.chat_session_id,
            source_message_id=committed_msg.id,
            analysis_data=analysis.analysis_data,
        )
        db.add(full_analysis)
        db.commit()
    # Clean up all variants for this message
    db.query(TempVariantAnalysis).filter(TempVariantAnalysis.variant_id.in_(
        db.query(TempMessageVariant.id).filter(TempMessageVariant.original_message_id == message_id)
    )).delete(synchronize_session=False)
    db.query(TempMessageVariant).filter(TempMessageVariant.original_message_id == message_id).delete(synchronize_session=False)
    db.commit()
    return {"committed_message_id": committed_msg.id}

@router.post("/message/{message_id}/regenerate", response_model=dict)
async def regenerate_ai_response(message_id: str, db: Session = Depends(get_db)):
    """
    Regenerate AI response by triggering the same chat generation flow as sending a message.
    This will create a new AI message in the conversation with a new response.
    """
    from routers.chat import chat_message, UserMessageInput

    original_message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not original_message:
        raise HTTPException(status_code=404, detail="Original message not found.")
    
    if original_message.sender_type != "AI":
        raise HTTPException(status_code=400, detail="Can only regenerate AI messages.")
    
    # Find the user message that prompted this AI response
    chat_messages = db.query(ChatMessage).filter(
        ChatMessage.chat_session_id == original_message.chat_session_id
    ).order_by(ChatMessage.timestamp.asc()).all()
    
    # Find the index of the current AI message
    ai_message_index = next((i for i, msg in enumerate(chat_messages) if msg.id == message_id), -1)
    if ai_message_index == -1:
        raise HTTPException(status_code=404, detail="AI message not found in conversation.")
    
    # Find the preceding user message
    user_message = None
    for i in range(ai_message_index - 1, -1, -1):
        if chat_messages[i].sender_type == "USER":
            user_message = chat_messages[i]
            break
    
    if not user_message:
        raise HTTPException(status_code=400, detail="No user message found before this AI response.")
    
    # Create a UserMessageInput object using the user message content
    user_message_input = UserMessageInput(
        content=user_message.content,
        user_persona_id=getattr(user_message, 'active_persona_id', None)
    )
    
    # Trigger the chat generation flow
    try:
        response = await chat_message(
            chat_id=original_message.chat_session_id,
            user_message_input=user_message_input,
            db=db
        )
        # Convert ChatTurnResponse to dict for API response
        return {
            "status": "success",
            "message": "AI response regenerated successfully",
            "user_message": response.user_message.model_dump() if response.user_message else None,
            "ai_message": response.ai_message.model_dump() if response.ai_message else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to regenerate AI response: {str(e)}")
