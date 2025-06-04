# backend/utils/reasoning_utils.py
"""
Utility functions for reasoning model detection and related functionality.
"""

import re

def is_reasoning_capable_model(model: str) -> bool:
    """
    Check if a model supports reasoning/thinking capabilities.
    
    Args:
        model: The model name/identifier
        
    Returns:
        bool: True if the model supports reasoning capabilities
    """
    if not model:
        return False
    
    reasoning_models = [
        # OpenAI o-series models
        'openai/o1-preview',
        'openai/o1-mini',
        'openai/o1',
        # Grok models  
        'x-ai/grok-beta',
        'x-ai/grok-2-1212',
        # DeepSeek models
        'deepseek/deepseek-r1',
        # Any model containing "reasoning" in the name
    ]
    
    # Check for exact matches
    if reasoning_models.__contains__(model.lower()):
        return True
    
    # Check for patterns that indicate reasoning capability
    model_lower = model.lower()
    return (model_lower.__contains__('o1') or 
            model_lower.__contains__('grok') or 
            model_lower.__contains__('reasoning') or
            model_lower.__contains__('deepseek-r1'))

def extract_content_from_reasoning_response(content: str, model: str = None) -> str:
    """
    Extract actual content from reasoning model responses.
    
    Reasoning models like DeepSeek R1 wrap their thinking process in <thinking> tags
    and provide the actual response after. This function extracts the useful content.
    
    Args:
        content: The raw response content from the reasoning model
        model: Optional model name for model-specific processing
        
    Returns:
        str: The extracted content without thinking tags
    """
    if not content or not isinstance(content, str):
        return content or ""
    
    # For DeepSeek R1 and similar reasoning models, extract content after </thinking>
    thinking_pattern = r'<thinking>.*?</thinking>\s*'
    cleaned_content = re.sub(thinking_pattern, '', content, flags=re.DOTALL)
    
    # Remove any remaining thinking markers
    cleaned_content = re.sub(r'</?thinking>', '', cleaned_content)
    
    # Clean up extra whitespace
    cleaned_content = cleaned_content.strip()
    
    # If the cleaned content is empty or very short, return the original content
    # This handles cases where the thinking tags might not be properly formatted
    if len(cleaned_content) < 10 and len(content) > len(cleaned_content):
        return content.strip()
    
    return cleaned_content

def is_reasoning_response_format(content: str) -> bool:
    """
    Check if the content appears to be in reasoning response format (contains <thinking> tags).
    
    Args:
        content: The response content to check
        
    Returns:
        bool: True if the content appears to be a reasoning response
    """
    if not content or not isinstance(content, str):
        return False
    
    return '<thinking>' in content and '</thinking>' in content
