"""
Robust JSON extraction utility for handling LLM responses with improved error handling and logging.
"""
import json
import re
import logging
from typing import Optional, Dict, Any, Union, List

logger = logging.getLogger(__name__)

class JSONExtractionError(Exception):
    """Custom exception for JSON extraction failures"""
    pass

class RobustJSONExtractor:
    """
    Enhanced JSON extractor with multiple strategies and comprehensive error handling.
    Designed specifically for extracting JSON from LLM responses.
    """
    
    def __init__(self):
        self.extraction_strategies = [
            ("complete_json_object", self._extract_complete_json_object),
            ("json_array", self._extract_json_array),
            ("first_json_block", self._extract_first_json_block),
            ("regex_extraction", self._extract_json_with_regex),
            ("partial_json_repair", self._extract_and_repair_partial_json),
            ("cleaned_content", self._extract_cleaned_content),
        ]
    
    def extract_json(self, text: str, fallback_value: Optional[Any] = None, 
                    expected_keys: Optional[List[str]] = None) -> Union[Dict, List, str]:
        """
        Extract JSON from text using multiple strategies with validation.
        
        Args:
            text: The text containing JSON
            fallback_value: Value to return if extraction fails
            expected_keys: List of keys that should be present in the JSON object
            
        Returns:
            Extracted and parsed JSON, or fallback value
        """
        if not isinstance(text, str) or not text.strip():
            logger.warning("Empty or invalid input text for JSON extraction")
            return fallback_value or text
        
        original_text = text
        cleaned_text = self._preprocess_text(text)
        
        logger.debug(f"Attempting JSON extraction from text: {cleaned_text[:200]}...")
        
        # Try each extraction strategy
        for strategy_name, strategy_func in self.extraction_strategies:
            try:
                extracted = strategy_func(cleaned_text)
                if extracted:
                    # Validate JSON syntax
                    parsed = json.loads(extracted)
                    
                    # Validate expected keys if provided
                    if expected_keys and isinstance(parsed, dict):
                        missing_keys = [key for key in expected_keys if key not in parsed]
                        if missing_keys:
                            logger.warning(f"Strategy '{strategy_name}': Missing expected keys: {missing_keys}")
                            continue
                    
                    logger.info(f"JSON extraction successful using strategy '{strategy_name}'")
                    self._log_success(strategy_name, original_text, parsed)
                    return parsed
                    
            except (json.JSONDecodeError, ValueError, IndexError, TypeError) as e:
                logger.debug(f"Strategy '{strategy_name}' failed: {e}")
                continue
            except Exception as e:
                logger.warning(f"Unexpected error in strategy '{strategy_name}': {e}")
                continue
        
        # All strategies failed
        logger.error(f"All JSON extraction strategies failed for text: {original_text[:100]}...")
        self._log_failure(original_text)
        
        # Return fallback or cleaned text
        result = fallback_value if fallback_value is not None else cleaned_text
        logger.info(f"Using fallback value: {str(result)[:100]}...")
        return result
    
    def _log_success(self, strategy: str, original_text: str, result: Any):
        """Log successful extraction."""
        try:
            # Import here to avoid circular imports
            from utils.json_monitoring import json_monitor
            json_monitor.log_extraction_attempt(
                text=original_text,
                result=result,
                strategy_used=strategy,
                success=True
            )
        except ImportError:
            # Monitoring not available
            pass
    
    def _log_failure(self, original_text: str):
        """Log failed extraction."""
        try:
            # Import here to avoid circular imports
            from utils.json_monitoring import json_monitor
            json_monitor.log_extraction_attempt(
                text=original_text,
                result=None,
                strategy_used="all_failed",
                success=False
            )
        except ImportError:
            # Monitoring not available
            pass
    
    def _preprocess_text(self, text: str) -> str:
        """Clean and preprocess text for JSON extraction"""
        cleaned = text.strip()
        
        # Remove common markdown code block wrappers and explanatory text
        patterns_to_remove = [
            r'```json\s*',
            r'```\s*',
            r'^Here\'s the JSON.*?:\s*',
            r'^The JSON response is:\s*',
            r'^Response:\s*',
            r'^Output:\s*',
            r'^Here is the.*?:\s*',
            r'^I\'ll provide.*?:\s*',
            r'^Based on.*?:\s*',
            r'^\**JSON\**:\s*',
            r'^\**Response\**:\s*',
        ]
        
        for pattern in patterns_to_remove:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.MULTILINE)
        
        # Remove trailing explanations after JSON
        # Look for JSON followed by explanatory text
        if '{' in cleaned and '}' in cleaned:
            # Find the last complete JSON object
            brace_count = 0
            json_end = -1
            in_string = False
            escape_next = False
            
            for i, char in enumerate(cleaned):
                if escape_next:
                    escape_next = False
                    continue
                    
                if char == '\\' and in_string:
                    escape_next = True
                    continue
                    
                if char == '"':
                    in_string = not in_string
                    continue
                    
                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            json_end = i + 1
                            break
            
            if json_end > 0:
                # Check if there's significant text after the JSON
                remaining = cleaned[json_end:].strip()
                # Be more aggressive about removing trailing content
                if len(remaining) > 20:  # Likely explanatory text
                    cleaned = cleaned[:json_end]
        
        # Additional cleanup for common LLM response patterns
        # Remove any remaining trailing explanations
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3].strip()
            
        # Remove common trailing phrases
        trailing_patterns = [
            r'\s+This JSON.*$',
            r'\s+I hope.*$',
            r'\s+Let me know.*$',
            r'\s+Note:.*$',
            r'\s+Please.*$',
        ]
        
        for pattern in trailing_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.DOTALL)
        
        return cleaned.strip()
    
    def _extract_complete_json_object(self, text: str) -> Optional[str]:
        """Extract a complete JSON object with proper brace matching"""
        try:
            start_idx = text.index('{')
            brace_count = 0
            
            for i in range(start_idx, len(text)):
                if text[i] == '{':
                    brace_count += 1
                elif text[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        return text[start_idx:i + 1]
        except (ValueError, IndexError):
            pass
        return None
    
    def _extract_json_array(self, text: str) -> Optional[str]:
        """Extract a complete JSON array with proper bracket matching"""
        try:
            start_idx = text.index('[')
            bracket_count = 0
            
            for i in range(start_idx, len(text)):
                if text[i] == '[':
                    bracket_count += 1
                elif text[i] == ']':
                    bracket_count -= 1
                    if bracket_count == 0:
                        return text[start_idx:i + 1]
        except (ValueError, IndexError):
            pass
        return None
    
    def _extract_first_json_block(self, text: str) -> Optional[str]:
        """Extract first occurrence of JSON-like content"""
        try:
            start = text.find('{')
            end = text.find('}')
            if start != -1 and end != -1 and end > start:
                return text[start:end + 1]
        except Exception:
            pass
        return None
    
    def _extract_json_with_regex(self, text: str) -> Optional[str]:
        """Use regex to find JSON patterns with improved matching"""
        try:
            # More comprehensive pattern for JSON object that handles nested structures
            json_patterns = [
                # Standard JSON object pattern with nested support
                r'\{(?:[^{}]|{[^{}]*})*\}',
                # More permissive pattern that allows some nesting
                r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',
                # Simple JSON object for basic cases
                r'\{[^{}]+\}',
                # JSON array patterns
                r'\[(?:[^\[\]]|\[[^\[\]]*\])*\]',
                r'\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]',
            ]
            
            for pattern in json_patterns:
                matches = re.findall(pattern, text, re.DOTALL)
                if matches:
                    # Return the longest match (likely most complete)
                    longest_match = max(matches, key=len)
                    # Validate that it's actually parseable JSON
                    try:
                        json.loads(longest_match)
                        return longest_match
                    except json.JSONDecodeError:
                        continue
            
        except Exception:
            pass
        return None
    
    def _extract_and_repair_partial_json(self, text: str) -> Optional[str]:
        """Attempt to extract and repair incomplete JSON"""
        try:
            # Look for JSON that starts properly but might be incomplete
            start_idx = text.find('{')
            if start_idx == -1:
                return None
                
            # Extract from start of JSON to end of text
            partial_json = text[start_idx:].strip()
            
            # Try to repair common issues
            repaired = self._repair_json(partial_json)
            if repaired:
                # Validate the repaired JSON
                json.loads(repaired)
                return repaired
                
        except Exception:
            pass
        return None
    
    def _repair_json(self, json_str: str) -> Optional[str]:
        """Attempt to repair common JSON formatting issues"""
        try:
            # Remove any trailing commas before closing braces/brackets
            cleaned = re.sub(r',(\s*[}\]])', r'\1', json_str)
            
            # Count braces to see if we need to close
            open_braces = cleaned.count('{') - cleaned.count('}')
            open_brackets = cleaned.count('[') - cleaned.count(']')
            
            # Add missing closing braces/brackets
            if open_braces > 0:
                cleaned += '}' * open_braces
            if open_brackets > 0:
                cleaned += ']' * open_brackets
                
            # Try to fix incomplete string values
            if cleaned.count('"') % 2 != 0:
                # Odd number of quotes - likely incomplete string
                cleaned += '"'
            
            return cleaned
            
        except Exception:
            pass
        return None

    def _extract_cleaned_content(self, text: str) -> str:
        """Return cleaned text as final fallback"""
        return text.strip()

    def extract_json_with_guidance(self, text: str, expected_keys: Optional[List[str]] = None, 
                                 fallback_value: Optional[Any] = None, 
                                 prompt_context: Optional[str] = None) -> Union[Dict, List, str]:
        """
        Enhanced JSON extraction with LLM guidance for failed extractions.
        
        Args:
            text: The text containing JSON
            expected_keys: List of keys that should be present in the JSON object
            fallback_value: Value to return if extraction fails
            prompt_context: Context about what this JSON should represent
            
        Returns:
            Extracted and parsed JSON, or fallback value
        """
        # First try standard extraction
        result = self.extract_json(text, fallback_value=None, expected_keys=expected_keys)
        
        # If successful and has expected structure, return it
        if self._is_valid_extraction(result, expected_keys):
            return result
        
        # Try to recover by creating a minimal valid JSON structure
        if expected_keys:
            logger.warning(f"JSON extraction failed, attempting to create minimal structure with keys: {expected_keys}")
            try:
                minimal_json = self._create_minimal_json_structure(text, expected_keys, prompt_context)
                if minimal_json:
                    logger.info("Successfully created minimal JSON structure from failed extraction")
                    return minimal_json
            except Exception as e:
                logger.error(f"Failed to create minimal JSON structure: {e}")
        
        # Final fallback
        return fallback_value if fallback_value is not None else text

    def _is_valid_extraction(self, result: Any, expected_keys: Optional[List[str]] = None) -> bool:
        """Check if extraction result is valid"""
        if not isinstance(result, (dict, list)):
            return False
        
        if expected_keys and isinstance(result, dict):
            return all(key in result for key in expected_keys)
        
        return True

    def _create_minimal_json_structure(self, text: str, expected_keys: List[str], 
                                     prompt_context: Optional[str] = None) -> Optional[Dict]:
        """
        Create a minimal JSON structure by analyzing the text content and 
        extracting meaningful values for expected keys.
        """
        try:
            minimal_structure = {}
            
            # Analyze text for meaningful content
            text_lower = text.lower().strip()
            
            # Create reasonable defaults based on expected keys and text content
            for key in expected_keys:
                if key == "optimized_query":
                    # Extract main intent from the text
                    minimal_structure[key] = self._extract_query_from_text(text)
                elif key == "key_entities":
                    minimal_structure[key] = self._extract_entities_from_text(text)
                elif key == "intent_summary":
                    minimal_structure[key] = self._extract_intent_from_text(text)
                elif key == "immediate_panel_updates":
                    minimal_structure[key] = {}
                elif key == "user_expressed_intent_summary":
                    minimal_structure[key] = self._extract_intent_from_text(text)
                elif key == "simple_event_triggers_detected":
                    minimal_structure[key] = []
                else:
                    # Generic fallback based on key name
                    if "summary" in key.lower() or "intent" in key.lower():
                        minimal_structure[key] = self._extract_intent_from_text(text)
                    elif "list" in key.lower() or "array" in key.lower() or key.endswith('s'):
                        minimal_structure[key] = []
                    elif "update" in key.lower() or "data" in key.lower():
                        minimal_structure[key] = {}
                    else:
                        minimal_structure[key] = text[:100] if text else ""
            
            return minimal_structure
            
        except Exception as e:
            logger.error(f"Error creating minimal JSON structure: {e}")
            return None

    def _extract_query_from_text(self, text: str) -> str:
        """Extract a reasonable search query from the text"""
        if not text:
            return "general query"
        
        # Remove common prefixes and clean up
        cleaned = re.sub(r'^(here is|the json|response|result)[\s:]*', '', text.lower()).strip()
        cleaned = re.sub(r'[{}"\[\]]', '', cleaned)
        
        # Take first meaningful sentence or first 50 chars
        sentences = re.split(r'[.!?]', cleaned)
        if sentences and len(sentences[0].strip()) > 5:
            return sentences[0].strip()[:100]
        
        return cleaned[:50] if cleaned else "user query"

    def _extract_entities_from_text(self, text: str) -> List[str]:
        """Extract potential entities from text"""
        if not text:
            return []
        
        # Simple entity extraction - look for capitalized words and quoted terms
        entities = []
        
        # Find quoted terms
        quoted = re.findall(r'"([^"]+)"', text)
        entities.extend(quoted)
        
        # Find capitalized words (potential proper nouns)
        capitalized = re.findall(r'\b[A-Z][a-z]+\b', text)
        entities.extend(capitalized[:3])  # Limit to first 3
        
        return list(set(entities))[:5]  # Return unique entities, max 5

    def _extract_intent_from_text(self, text: str) -> str:
        """Extract user intent from text"""
        if not text:
            return "unclear intent"
        
        # Look for common intent patterns
        intent_patterns = [
            (r'\b(want|need|looking for|searching for)\b.*', 'seeking information'),
            (r'\b(how to|how can|explain)\b.*', 'requesting explanation'),
            (r'\b(show me|display|view)\b.*', 'requesting display'),
            (r'\b(help|assist|support)\b.*', 'requesting help'),
            (r'\b(update|change|modify)\b.*', 'requesting modification')
        ]
        
        text_lower = text.lower()
        for pattern, intent in intent_patterns:
            if re.search(pattern, text_lower):
                return intent
        
        # Fallback: use first 50 characters as intent summary
        return text[:50].strip() if text else "general interaction"

# Global instance for easy access
json_extractor = RobustJSONExtractor()

def extract_json(text: str, fallback_value: Optional[Any] = None, 
                expected_keys: Optional[List[str]] = None) -> Union[Dict, List, str]:
    """
    Convenience function for JSON extraction.
    
    Args:
        text: Text containing JSON
        fallback_value: Value to return if extraction fails
        expected_keys: List of keys that should be present in JSON object
        
    Returns:
        Extracted JSON or fallback value
    """
    return json_extractor.extract_json(text, fallback_value, expected_keys)

def validate_json_structure(data: Any, required_fields: List[str]) -> bool:
    """
    Validate that JSON data contains required fields.
    
    Args:
        data: Parsed JSON data
        required_fields: List of required field names
        
    Returns:
        True if all required fields are present
    """
    if not isinstance(data, dict):
        return False
    
    return all(field in data for field in required_fields)

def safe_json_parse(text: str, default: Any = None) -> Any:
    """
    Safely parse JSON with error handling.
    
    Args:
        text: JSON string to parse
        default: Default value if parsing fails
        
    Returns:
        Parsed JSON or default value
    """
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.warning(f"JSON parsing failed: {e}")
        return default
