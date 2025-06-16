import logging
from typing import Dict, Any, Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape, Undefined
import os
import json

from backend.services.litellm_service import litellm_service
from backend.schemas.ai_analysis_result import InteractionAnalysisResult
from backend.utils.reasoning_utils import is_reasoning_capable_model

# Set up logger
logger = logging.getLogger(__name__)

def replace_jinja_undefined(obj):
    if isinstance(obj, dict):
        return {k: replace_jinja_undefined(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_jinja_undefined(v) for v in obj]
    elif isinstance(obj, tuple):
        return tuple(replace_jinja_undefined(v) for v in obj)
    elif isinstance(obj, Undefined):
        return None
    return obj

class InteractionAnalysisService:
    def __init__(self):
        self.litellm_service = litellm_service
        template_dir = os.path.join(os.path.dirname(__file__), '../templates')
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml', 'jinja2'])
        )
        self.full_analysis_template = self.env.get_template('full_analysis_prompt.jinja2')

    async def perform_full_analysis(
        self,
        context: Dict[str, Any],
        user_settings: Dict[str, Any],
        reasoning_mode: Optional[str] = None,
        reasoning_effort: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Performs full analysis after AI response to update session state
        """
        try:
            # Extract analysis LLM configuration from user settings
            analysis_provider = user_settings.get('analysis_llm_provider', 'openrouter')
            analysis_model = user_settings.get('analysis_llm_model_new') or user_settings.get('analysis_llm_model', 'gpt-4o')
            analysis_api_key = user_settings.get('analysis_llm_api_key_new') or user_settings.get('analysis_llm_api_key')
            
            if not analysis_api_key:
                raise ValueError("Analysis LLM API key not configured")
            
            # Add reasoning model capability to context
            context_with_reasoning = context.copy()
            context_with_reasoning['reasoning_model_available'] = is_reasoning_capable_model(analysis_model)

            # Replace any undefined values to prevent template errors
            context_with_reasoning = replace_jinja_undefined(context_with_reasoning)

            # Ensure required context fields are present
            required_fields = {
                'user_message': "",
                'ai_response': "",
                'rag_results': [],
                'ai_persona_card': {"name": "AI", "description": "AI Assistant"},
                'user_persona': {"name": "User", "description": "User"},
                # 'ai_plan': None,  # Obsolete - planning embedded in main generation
                'active_event_details': None,
                'chat_history_formatted': "",
                'current_panel_data': {},
                'last_5_messages': [],
                'last_9_messages_formatted': ""
            }

            for field, default_value in required_fields.items():
                if field not in context_with_reasoning:
                    context_with_reasoning[field] = default_value

            # Prepare context for Jinja2 template
            prompt = self.full_analysis_template.render(context_with_reasoning)

            # Enhanced system prompt for better JSON compliance
            system_prompt = """You are an AI analysis assistant. You must respond with ONLY valid JSON objects.

CRITICAL REQUIREMENTS:
- Output ONLY JSON, no markdown, no backticks, no explanations
- Ensure all JSON is properly formatted and valid
- If you cannot analyze, return a minimal valid JSON structure
- Never include ```json``` or any markdown formatting
- Include all required fields: new_facts_established, relationship_changes, session_lore_updates, etc."""

            # Use enhanced robust_llm_call with JSON handling
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            
            expected_keys = [
                "updates", "creations",
                "new_facts_established", "relationship_changes", "user_persona_session_updates",
                "triggered_event_ids_candidates"
            ]

            # Use LiteLLM service for completion
            response = await self.litellm_service.get_completion(
                provider=analysis_provider,
                model=analysis_model,
                messages=messages,
                api_key=analysis_api_key,
                temperature=0.2,
                max_tokens=1024,
                response_format={"type": "json_object"} if analysis_provider in ["openrouter", "openai"] else None
            )

            # Extract content from response
            if 'choices' in response and response['choices']:
                content = response['choices'][0]['message']['content']
                try:
                    result = json.loads(content)
                except json.JSONDecodeError:
                    logger.warning("Failed to parse JSON response from analysis LLM")
                    result = None
            else:
                result = None

            # Accept result if it has at least updates/creations or legacy keys
            if isinstance(result, dict) and (
                ("updates" in result and "creations" in result) or
                all(key in result for key in expected_keys if key not in ["updates", "creations"])
            ):
                logger.info("Full analysis successful")
                # Pass through all keys, even if not in legacy schema
                return result
            else:
                logger.warning("Full analysis failed, using fallback")
                return self._get_full_analysis_fallback()
        except Exception as e:
            logger.error(f"Full analysis failed: {e}")
            return self._get_full_analysis_fallback()

    def _get_full_analysis_fallback(self) -> Dict[str, Any]:
        """Return a safe fallback response for full analysis"""
        return {
            "new_facts_established": [],
            "relationship_changes": [],
            "session_lore_updates": [],
            "user_persona_session_updates": [],
            "triggered_event_ids_candidates": [],
            "dynamically_generated_lore_entries": [],
            "suggested_dynamic_event": None,
            "panel_data_update": None,
            "session_cache_updates": [],
            "dynamic_memories_to_index": []
        }

    async def analyze_interaction(
        self,
        user_message: str,
        ai_response: str,
        context: Dict[str, Any],
        user_settings: Dict[str, Any],
        reasoning_mode: Optional[str] = None,
        reasoning_effort: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Performs comprehensive analysis of user-AI interaction for full background processing
        """
        try:
            # Add the user message and AI response to the context for analysis
            enhanced_context = context.copy()
            enhanced_context['user_message'] = user_message
            enhanced_context['ai_response'] = ai_response

            # Use the full analysis method which is designed for comprehensive interaction analysis
            return await self.perform_full_analysis(
                context=enhanced_context,
                user_settings=user_settings,
                reasoning_mode=reasoning_mode,
                reasoning_effort=reasoning_effort
            )
        except Exception as e:
            logger.error(f"Interaction analysis failed: {e}")
            return self._get_full_analysis_fallback()
