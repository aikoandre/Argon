import json
import asyncio
from typing import Optional, Dict, Any
from jinja2 import Environment, FileSystemLoader, select_autoescape
import os
import logging

from backend.services.openrouter_client import OpenRouterClient
from backend.services.chat_flow_monitor import get_monitor
from backend.utils.json_extractor import extract_json, validate_json_structure
from backend.utils.json_monitoring import validate_and_log_llm_response

logger = logging.getLogger(__name__)
 
class QueryTransformationService:
    def __init__(self, openrouter_client: OpenRouterClient):
        self.openrouter_client = openrouter_client
        template_dir = os.path.join(os.path.dirname(__file__), '../templates')
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml', 'jinja2'])
        )
        self.query_transformation_template = self.env.get_template('query_transformation_prompt.jinja2')
 
    async def transform_query(self, raw_user_message: str, model: str, api_key: str, user_prompt_instructions=None) -> str:
        """
        Enhanced query transformation with intelligent JSON handling and robust fallbacks.
        Returns a string containing the optimized query.
        """
        from backend.routers.chat import robust_llm_call
        
        monitor = get_monitor()
        start_time = monitor.record_step_start("query_transformation")
        
        template_context = {
            "raw_user_message": raw_user_message,
            "user_prompt_instructions": user_prompt_instructions or {}
        }
        prompt = self.query_transformation_template.render(template_context)
        
        # Use enhanced robust_llm_call with JSON handling
        try:
            messages = [
                {"role": "system", "content": "You must respond with ONLY valid JSON objects. Do not use markdown, backticks, or any explanations. Output pure JSON only."},
                {"role": "user", "content": prompt}
            ]
            
            result = await robust_llm_call(
                llm_client=self.openrouter_client,
                model=model,
                messages=messages,
                api_key=api_key,
                max_retries=3,
                fallback_response=raw_user_message.strip(),
                expected_json_keys=["optimized_query", "key_entities", "intent_summary"],
                json_extraction_context="query transformation for search optimization",
                max_tokens=150,
                temperature=0.1,
                response_format={"type": "json_object"} if self.openrouter_client.supports_json_mode(model) else None
            )
            
            # Handle the response
            if isinstance(result, dict) and "optimized_query" in result:
                logger.info("Query transformation successful")
                monitor.record_step_success("query_transformation", start_time, {
                    "input_length": len(raw_user_message),
                    "output_length": len(result["optimized_query"]),
                    "has_entities": bool(result.get("key_entities")),
                    "has_intent": bool(result.get("intent_summary"))
                })
                return result["optimized_query"]
            else:
                # Handle fallback - result should be the raw message
                logger.warning("Query transformation failed, using fallback")
                monitor.record_step_failure("query_transformation", start_time, 
                                          Exception("JSON extraction failed"), {
                                              "input_length": len(raw_user_message)
                                          })
                return str(result) if result else raw_user_message.strip()
            
        except Exception as e:
            logger.error(f"Query transformation error: {e}")
            monitor.record_step_failure("query_transformation", start_time, e, {
                "input_length": len(raw_user_message)
            })
            return raw_user_message.strip()
    
    async def transform_ai_response(self, ai_response: str, model: str, api_key: str) -> str:
        """
        Extracts key factual information and context from AI responses in JSON format.
        Enhanced with robust JSON extraction and error handling.
        """
        from backend.routers.chat import robust_llm_call
        
        prompt = f"""
Extract essential factual information and context from the AI response below.
Return the extracted information in JSON format with this schema:
{{
  "extracted_info": "human-readable summary of key facts and entities"
}}
Do NOT include tone, implications, or conversational elements.
Keep language concise and factual.

AI RESPONSE:
```
{ai_response}
```
"""
        try:
            messages = [
                {"role": "system", "content": "You must respond with ONLY valid JSON objects. Do not use markdown, backticks, or any explanations. Output pure JSON only."},
                {"role": "user", "content": prompt}
            ]
            
            # Use enhanced robust_llm_call with JSON handling
            result = await robust_llm_call(
                llm_client=self.openrouter_client,
                model=model,
                messages=messages,
                api_key=api_key,
                max_retries=3,
                fallback_response=ai_response,  # Fallback to original response
                expected_json_keys=["extracted_info"],
                json_extraction_context="AI response transformation for key information extraction",
                max_tokens=150,
                temperature=0.2,
                response_format={"type": "json_object"} if self.openrouter_client.supports_json_mode(model) else None
            )
            
            # Handle the response
            if isinstance(result, dict) and "extracted_info" in result:
                logger.info("AI response transformation successful")
                return result["extracted_info"]
            else:
                # Handle fallback - result should be the original AI response
                logger.warning("AI response transformation failed, using fallback")
                return str(result) if result else ai_response
            
        except Exception as e:
            logger.error(f"AI response transformation error: {e}")
            return ai_response

    async def transform_response(self, ai_response: str, model: str, api_key: str) -> str:
        """
        Extracts key information from AI responses for embedding and storage.
        Returns a string containing the extracted key information.
        """
        from backend.routers.chat import robust_llm_call
        
        # Create a simple prompt for extracting key information
        prompt = f"Extract the most important factual information from this AI response:\n\n{ai_response}"
        
        try:
            response_content = await robust_llm_call(
                llm_client=self.openrouter_client,
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=api_key,
                max_tokens=200,
                temperature=0.2,
                fallback_response="Key information extraction failed"
            )
            
            return response_content.strip() if response_content else ai_response
            
        except Exception as e:
            logger.error(f"Response transformation error: {e}")
            return ai_response
