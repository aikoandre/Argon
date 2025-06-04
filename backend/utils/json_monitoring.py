"""
Enhanced monitoring and logging for JSON extraction and LLM response processing.
"""
import logging
import json
from typing import Dict, Any, Optional
from datetime import datetime
import traceback

logger = logging.getLogger(__name__)

class JSONExtractionMonitor:
    """Monitor and log JSON extraction performance and failures."""
    
    def __init__(self):
        self.extraction_stats = {
            "total_attempts": 0,
            "successful_extractions": 0,
            "fallback_used": 0,
            "errors": 0,
            "strategy_success_rate": {}
        }
    
    def log_extraction_attempt(self, text: str, result: Any, strategy_used: str, 
                             success: bool, error: Optional[Exception] = None):
        """Log a JSON extraction attempt with details."""
        self.extraction_stats["total_attempts"] += 1
        
        if success:
            self.extraction_stats["successful_extractions"] += 1
        elif isinstance(result, str) and result != text:  # Fallback was used
            self.extraction_stats["fallback_used"] += 1
        else:
            self.extraction_stats["errors"] += 1
        
        # Track strategy success rates
        if strategy_used not in self.extraction_stats["strategy_success_rate"]:
            self.extraction_stats["strategy_success_rate"][strategy_used] = {"attempts": 0, "successes": 0}
        
        self.extraction_stats["strategy_success_rate"][strategy_used]["attempts"] += 1
        if success:
            self.extraction_stats["strategy_success_rate"][strategy_used]["successes"] += 1
        
        # Log details
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "input_length": len(text) if isinstance(text, str) else 0,
            "input_preview": text[:100] if isinstance(text, str) else str(text)[:100],
            "strategy": strategy_used,
            "success": success,
            "result_type": type(result).__name__,
            "error": str(error) if error else None
        }
        
        if success:
            logger.info(f"JSON extraction successful: {json.dumps(log_data, indent=2)}")
        elif error:
            logger.error(f"JSON extraction error: {json.dumps(log_data, indent=2)}")
        else:
            logger.warning(f"JSON extraction fallback: {json.dumps(log_data, indent=2)}")
    
    def log_llm_response_issue(self, model: str, prompt: str, response: str, 
                              expected_format: str, issue: str):
        """Log issues with LLM response formatting."""
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "prompt_preview": prompt[:200],
            "response_preview": response[:200] if response else "None",
            "expected_format": expected_format,
            "issue": issue,
            "response_length": len(response) if response else 0
        }
        
        logger.warning(f"LLM Response Format Issue: {json.dumps(log_data, indent=2)}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current extraction statistics."""
        # Calculate success rates
        stats = self.extraction_stats.copy()
        if stats["total_attempts"] > 0:
            stats["success_rate"] = stats["successful_extractions"] / stats["total_attempts"]
            stats["fallback_rate"] = stats["fallback_used"] / stats["total_attempts"]
            stats["error_rate"] = stats["errors"] / stats["total_attempts"]
        
        # Calculate strategy success rates
        for strategy, data in stats["strategy_success_rate"].items():
            if data["attempts"] > 0:
                data["success_rate"] = data["successes"] / data["attempts"]
        
        return stats
    
    def log_stats_summary(self):
        """Log a summary of extraction statistics."""
        stats = self.get_stats()
        logger.info(f"JSON Extraction Statistics: {json.dumps(stats, indent=2)}")

class LLMResponseValidator:
    """Validate and analyze LLM responses for common issues."""
    
    @staticmethod
    def validate_json_response(response: str, expected_keys: Optional[list] = None) -> Dict[str, Any]:
        """
        Validate an LLM response that should contain JSON.
        
        Returns:
            Dict with validation results and recommendations
        """
        result = {
            "is_valid_json": False,
            "has_expected_keys": False,
            "issues": [],
            "recommendations": [],
            "cleaned_response": response
        }
        
        if not response or not response.strip():
            result["issues"].append("Empty response")
            result["recommendations"].append("Check LLM model configuration and prompt")
            return result
        
        # Check for common formatting issues
        if "```" in response:
            result["issues"].append("Contains markdown code blocks")
            result["recommendations"].append("Remove markdown formatting from response")
        
        if response.strip().startswith("Here") or response.strip().startswith("The JSON"):
            result["issues"].append("Contains explanatory text before JSON")
            result["recommendations"].append("Instruct LLM to return only JSON")
        
        # Try to find JSON in the response
        try:
            # Look for JSON-like patterns
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                parsed = json.loads(json_str)
                result["is_valid_json"] = True
                result["cleaned_response"] = json_str
                
                # Check for expected keys
                if expected_keys and isinstance(parsed, dict):
                    missing_keys = [key for key in expected_keys if key not in parsed]
                    if not missing_keys:
                        result["has_expected_keys"] = True
                    else:
                        result["issues"].append(f"Missing expected keys: {missing_keys}")
                        result["recommendations"].append("Update prompt to specify required fields")
            else:
                result["issues"].append("No JSON structure found")
                result["recommendations"].append("Improve prompt to request JSON format")
                
        except json.JSONDecodeError as e:
            result["issues"].append(f"Invalid JSON syntax: {e}")
            result["recommendations"].append("Fix JSON syntax in LLM response")
        except Exception as e:
            result["issues"].append(f"Validation error: {e}")
        
        return result

# Global instances
json_monitor = JSONExtractionMonitor()
response_validator = LLMResponseValidator()

def log_extraction_metrics():
    """Log current extraction metrics."""
    json_monitor.log_stats_summary()

def validate_and_log_llm_response(response: str, model: str, prompt: str, 
                                expected_keys: Optional[list] = None) -> Dict[str, Any]:
    """Validate LLM response and log any issues."""
    validation = response_validator.validate_json_response(response, expected_keys)
    
    if validation["issues"]:
        json_monitor.log_llm_response_issue(
            model=model,
            prompt=prompt,
            response=response,
            expected_format="JSON with keys: " + str(expected_keys) if expected_keys else "JSON",
            issue="; ".join(validation["issues"])
        )
    
    return validation
