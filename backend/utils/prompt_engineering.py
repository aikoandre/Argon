"""
Enhanced prompt engineering utilities for better JSON generation.
"""
import logging
from typing import Dict, List, Optional, Any
from enum import Enum

logger = logging.getLogger(__name__)

class PromptStrategy(Enum):
    """Different strategies for prompting LLMs to generate JSON"""
    STRICT_JSON = "strict_json"
    STRUCTURED_OUTPUT = "structured_output"
    XML_TEMPLATE = "xml_template"
    STEP_BY_STEP = "step_by_step"
    EXAMPLES_BASED = "examples_based"

class JSONPromptEngineer:
    """Enhanced prompt engineering for reliable JSON generation"""
    
    def __init__(self):
        self.strategy_success_rates = {
            PromptStrategy.STRICT_JSON: 0.7,
            PromptStrategy.STRUCTURED_OUTPUT: 0.8,
            PromptStrategy.XML_TEMPLATE: 0.85,
            PromptStrategy.STEP_BY_STEP: 0.9,
            PromptStrategy.EXAMPLES_BASED: 0.95
        }
        
    def get_enhanced_prompt(self, original_prompt: str, expected_keys: List[str], 
                          strategy: PromptStrategy = PromptStrategy.EXAMPLES_BASED,
                          context: Optional[str] = None) -> str:
        """
        Generate an enhanced prompt with better JSON generation guidance.
        
        Args:
            original_prompt: The base prompt
            expected_keys: Required JSON keys
            strategy: Strategy to use for prompt enhancement
            context: Additional context about the task
            
        Returns:
            Enhanced prompt string
        """
        if strategy == PromptStrategy.EXAMPLES_BASED:
            return self._create_examples_based_prompt(original_prompt, expected_keys, context)
        elif strategy == PromptStrategy.STEP_BY_STEP:
            return self._create_step_by_step_prompt(original_prompt, expected_keys, context)
        elif strategy == PromptStrategy.XML_TEMPLATE:
            return self._create_xml_template_prompt(original_prompt, expected_keys, context)
        elif strategy == PromptStrategy.STRUCTURED_OUTPUT:
            return self._create_structured_output_prompt(original_prompt, expected_keys, context)
        else:
            return self._create_strict_json_prompt(original_prompt, expected_keys, context)
    
    def _create_examples_based_prompt(self, original_prompt: str, expected_keys: List[str], 
                                    context: Optional[str] = None) -> str:
        """Create a prompt with specific examples"""
        example_json = self._generate_example_json(expected_keys)
        
        return f"""{original_prompt}

IMPORTANT: You must respond with valid JSON only. Here's the exact format:

EXAMPLE OUTPUT:
{example_json}

REQUIREMENTS:
- Start your response with {{ and end with }}
- Include all required fields: {', '.join(expected_keys)}
- Use double quotes for strings
- No markdown formatting, no explanations
- Valid JSON syntax only

Your JSON response:"""

    def _create_step_by_step_prompt(self, original_prompt: str, expected_keys: List[str], 
                                  context: Optional[str] = None) -> str:
        """Create a step-by-step prompt"""
        return f"""{original_prompt}

Follow these steps to create your response:

STEP 1: Understand the requirements
- Analyze the input and determine appropriate values

STEP 2: Structure your response
- Create a JSON object with these exact keys: {', '.join(expected_keys)}

STEP 3: Generate JSON
- Use proper JSON syntax
- Include all required fields
- No additional text or formatting

STEP 4: Validate
- Ensure valid JSON syntax
- Confirm all required keys are present

Output only the JSON object:"""

    def _create_xml_template_prompt(self, original_prompt: str, expected_keys: List[str], 
                                  context: Optional[str] = None) -> str:
        """Create a prompt using XML-style templates"""
        xml_template = self._generate_xml_template(expected_keys)
        
        return f"""{original_prompt}

Use this template format and return valid JSON:

<template>
{xml_template}
</template>

Fill in the template values and return as valid JSON:"""

    def _create_structured_output_prompt(self, original_prompt: str, expected_keys: List[str], 
                                       context: Optional[str] = None) -> str:
        """Create a prompt emphasizing structured output"""
        return f"""{original_prompt}

STRUCTURED OUTPUT REQUIRED:
Format: JSON object
Required fields: {', '.join(expected_keys)}

Generate a valid JSON response with the required structure. 
Do not include any text outside the JSON object.

JSON:"""

    def _create_strict_json_prompt(self, original_prompt: str, expected_keys: List[str], 
                                 context: Optional[str] = None) -> str:
        """Create a strict JSON-only prompt"""
        return f"""{original_prompt}

CRITICAL: Respond with valid JSON only. Required keys: {', '.join(expected_keys)}

JSON response:"""

    def _generate_example_json(self, expected_keys: List[str]) -> str:
        """Generate an example JSON structure"""
        example = {}
        
        for key in expected_keys:
            if key == "optimized_query":
                example[key] = "search terms and keywords"
            elif key == "key_entities":
                example[key] = ["entity1", "entity2"]
            elif key == "intent_summary":
                example[key] = "brief summary of user intent"
            elif key == "immediate_panel_updates":
                example[key] = {"status": "example_value"}
            elif key == "user_expressed_intent_summary":
                example[key] = "what the user wants to accomplish"
            elif key == "simple_event_triggers_detected":
                example[key] = ["trigger1", "trigger2"]
            elif "summary" in key.lower():
                example[key] = "brief summary text"
            elif "list" in key.lower() or key.endswith("s"):
                example[key] = ["item1", "item2"]
            elif "update" in key.lower() or "data" in key.lower():
                example[key] = {"field": "value"}
            else:
                example[key] = "example value"
        
        import json
        return json.dumps(example, indent=2)
    
    def _generate_xml_template(self, expected_keys: List[str]) -> str:
        """Generate XML template for the JSON structure"""
        template_parts = []
        for key in expected_keys:
            if "list" in key.lower() or key.endswith("s"):
                template_parts.append(f"<{key}>[list of items]</{key}>")
            elif "update" in key.lower() or "data" in key.lower():
                template_parts.append(f"<{key}>{{object with fields}}</{key}>")
            else:
                template_parts.append(f"<{key}>[value for {key}]</{key}>")
        
        return "\n".join(template_parts)

class JSONGenerationStrategy:
    """Manages different strategies for JSON generation"""
    
    def __init__(self):
        self.prompt_engineer = JSONPromptEngineer()
        self.model_capabilities = {
            # Models with native JSON mode support
            'gpt-4o': {'json_mode': True, 'preferred_strategy': PromptStrategy.STRUCTURED_OUTPUT},
            'gpt-4o-mini': {'json_mode': True, 'preferred_strategy': PromptStrategy.STRUCTURED_OUTPUT},
            'gpt-4-turbo': {'json_mode': True, 'preferred_strategy': PromptStrategy.STRUCTURED_OUTPUT},
            'claude-3': {'json_mode': False, 'preferred_strategy': PromptStrategy.EXAMPLES_BASED},
            'claude-3.5': {'json_mode': False, 'preferred_strategy': PromptStrategy.EXAMPLES_BASED},
            'mistral': {'json_mode': False, 'preferred_strategy': PromptStrategy.STEP_BY_STEP},
            'llama': {'json_mode': False, 'preferred_strategy': PromptStrategy.XML_TEMPLATE},
        }
    
    def get_optimal_strategy(self, model_name: str, previous_failures: int = 0) -> PromptStrategy:
        """
        Get the optimal prompt strategy for a given model and failure history.
        
        Args:
            model_name: Name of the LLM model
            previous_failures: Number of previous failures for this task
            
        Returns:
            Optimal prompt strategy
        """
        # Find model family
        model_family = self._identify_model_family(model_name)
        model_info = self.model_capabilities.get(model_family, {
            'json_mode': False, 
            'preferred_strategy': PromptStrategy.EXAMPLES_BASED
        })
        
        # Escalate strategy based on previous failures
        if previous_failures == 0:
            return model_info['preferred_strategy']
        elif previous_failures == 1:
            return PromptStrategy.STEP_BY_STEP
        elif previous_failures == 2:
            return PromptStrategy.EXAMPLES_BASED
        else:
            return PromptStrategy.XML_TEMPLATE
    
    def _identify_model_family(self, model_name: str) -> str:
        """Identify the model family from the model name"""
        model_name_lower = model_name.lower()
        
        if 'gpt-4o' in model_name_lower:
            return 'gpt-4o'
        elif 'gpt-4' in model_name_lower:
            return 'gpt-4-turbo'
        elif 'claude-3.5' in model_name_lower:
            return 'claude-3.5'
        elif 'claude' in model_name_lower:
            return 'claude-3'
        elif 'mistral' in model_name_lower:
            return 'mistral'
        elif 'llama' in model_name_lower:
            return 'llama'
        else:
            return 'unknown'
    
    def should_use_json_mode(self, model_name: str) -> bool:
        """Check if the model supports JSON mode"""
        model_family = self._identify_model_family(model_name)
        return self.model_capabilities.get(model_family, {}).get('json_mode', False)
    
    def enhance_prompt_for_model(self, original_prompt: str, expected_keys: List[str], 
                               model_name: str, previous_failures: int = 0) -> str:
        """
        Enhance a prompt for optimal JSON generation with a specific model.
        
        Args:
            original_prompt: The base prompt
            expected_keys: Required JSON keys
            model_name: Name of the LLM model
            previous_failures: Number of previous failures
            
        Returns:
            Enhanced prompt
        """
        strategy = self.get_optimal_strategy(model_name, previous_failures)
        return self.prompt_engineer.get_enhanced_prompt(
            original_prompt, expected_keys, strategy
        )

# Global instances
json_prompt_engineer = JSONPromptEngineer()
json_generation_strategy = JSONGenerationStrategy()
