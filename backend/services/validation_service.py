# backend/services/validation_service.py
"""
Validation Service for Enhanced Analysis System.

Provides validation and error handling for analysis results and entity operations.
"""
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from .enhanced_analysis_service import EnhancedAnalysisResult, EntityUpdate, EntityCreation
from .entity_matching_service import EntityMatchingResult

logger = logging.getLogger(__name__)


class ValidationError(BaseModel):
    """Validation error information"""
    field: str = Field(description="Field that failed validation")
    error_type: str = Field(description="Type of validation error")
    message: str = Field(description="Error message")
    value: Optional[str] = Field(None, description="Invalid value")


class AnalysisValidationResult(BaseModel):
    """Result of analysis validation"""
    is_valid: bool = Field(description="Whether analysis passed validation")
    errors: List[ValidationError] = Field(default_factory=list, description="Validation errors found")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")


class ValidationService:
    """Service for validating analysis results and entity operations"""
    
    def __init__(self):
        self.max_entities_per_turn = 10
        self.min_description_length = 5
        self.max_description_length = 500
        self.valid_entity_types = {"CHARACTER", "LOCATION", "OBJECT", "EVENT", "CONCEPT"}

    def validate_analysis_result(self, result: EnhancedAnalysisResult) -> AnalysisValidationResult:
        """Validate an enhanced analysis result"""
        errors = []
        warnings = []
        
        try:
            # Check if analysis was successful
            if not result.success:
                errors.append(ValidationError(
                    field="success",
                    error_type="analysis_failure",
                    message=result.error_message or "Analysis failed without specific error message"
                ))
                return AnalysisValidationResult(is_valid=False, errors=errors)
            
            # Validate entity counts
            total_entities = len(result.updates) + len(result.creations)
            if total_entities > self.max_entities_per_turn:
                errors.append(ValidationError(
                    field="entity_count",
                    error_type="too_many_entities",
                    message=f"Too many entities ({total_entities}). Maximum allowed: {self.max_entities_per_turn}",
                    value=str(total_entities)
                ))
            
            # Validate updates
            for i, update in enumerate(result.updates):
                update_errors = self._validate_entity_update(update, i)
                errors.extend(update_errors)
            
            # Validate creations
            for i, creation in enumerate(result.creations):
                creation_errors = self._validate_entity_creation(creation, i)
                errors.extend(creation_errors)
            
            # Generate warnings
            if not result.updates and not result.creations:
                warnings.append("Analysis found no memory operations - this might indicate a missed opportunity for story development")
            
            if len(result.creations) > 3:
                warnings.append(f"Many new entities ({len(result.creations)}) detected - ensure they are all necessary for the story")
            
            return AnalysisValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings
            )
            
        except Exception as e:
            logger.error(f"Error during analysis validation: {e}")
            errors.append(ValidationError(
                field="validation",
                error_type="validation_exception",
                message=f"Validation failed with exception: {str(e)}"
            ))
            return AnalysisValidationResult(is_valid=False, errors=errors)

    def _validate_entity_update(self, update: EntityUpdate, index: int) -> List[ValidationError]:
        """Validate a single entity update"""
        errors = []
        
        # Validate entity_description
        if not update.entity_description or not update.entity_description.strip():
            errors.append(ValidationError(
                field=f"updates[{index}].entity_description",
                error_type="empty_field",
                message="Entity description cannot be empty"
            ))
        elif len(update.entity_description.strip()) < self.min_description_length:
            errors.append(ValidationError(
                field=f"updates[{index}].entity_description",
                error_type="too_short",
                message=f"Entity description too short (minimum {self.min_description_length} characters)",
                value=update.entity_description
            ))
        elif len(update.entity_description) > self.max_description_length:
            errors.append(ValidationError(
                field=f"updates[{index}].entity_description",
                error_type="too_long",
                message=f"Entity description too long (maximum {self.max_description_length} characters)",
                value=f"{update.entity_description[:50]}..."
            ))
        
        # Validate update_summary
        if not update.update_summary or not update.update_summary.strip():
            errors.append(ValidationError(
                field=f"updates[{index}].update_summary",
                error_type="empty_field",
                message="Update summary cannot be empty"
            ))
        elif len(update.update_summary.strip()) < self.min_description_length:
            errors.append(ValidationError(
                field=f"updates[{index}].update_summary",
                error_type="too_short",
                message=f"Update summary too short (minimum {self.min_description_length} characters)",
                value=update.update_summary
            ))
        
        return errors

    def _validate_entity_creation(self, creation: EntityCreation, index: int) -> List[ValidationError]:
        """Validate a single entity creation"""
        errors = []
        
        # Validate entity_type
        if not creation.entity_type or creation.entity_type not in self.valid_entity_types:
            errors.append(ValidationError(
                field=f"creations[{index}].entity_type",
                error_type="invalid_type",
                message=f"Invalid entity type. Must be one of: {', '.join(self.valid_entity_types)}",
                value=creation.entity_type
            ))
        
        # Validate creation_summary
        if not creation.creation_summary or not creation.creation_summary.strip():
            errors.append(ValidationError(
                field=f"creations[{index}].creation_summary",
                error_type="empty_field",
                message="Creation summary cannot be empty"
            ))
        elif len(creation.creation_summary.strip()) < self.min_description_length:
            errors.append(ValidationError(
                field=f"creations[{index}].creation_summary",
                error_type="too_short",
                message=f"Creation summary too short (minimum {self.min_description_length} characters)",
                value=creation.creation_summary
            ))
        elif len(creation.creation_summary) > self.max_description_length:
            errors.append(ValidationError(
                field=f"creations[{index}].creation_summary",
                error_type="too_long",
                message=f"Creation summary too long (maximum {self.max_description_length} characters)",
                value=f"{creation.creation_summary[:50]}..."
            ))
        
        return errors

    def validate_entity_matching_results(
        self, 
        matching_results: List[EntityMatchingResult]
    ) -> AnalysisValidationResult:
        """Validate entity matching results"""
        errors = []
        warnings = []
        
        try:
            for i, result in enumerate(matching_results):
                if not result.success:
                    errors.append(ValidationError(
                        field=f"matching_results[{i}]",
                        error_type="matching_failure",
                        message=result.error_message or "Entity matching failed",
                        value=str(i)
                    ))
                elif result.confidence < 0.5:
                    warnings.append(f"Low confidence entity match at index {i} (confidence: {result.confidence:.3f})")
            
            return AnalysisValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings
            )
            
        except Exception as e:
            logger.error(f"Error validating entity matching results: {e}")
            return AnalysisValidationResult(
                is_valid=False,
                errors=[ValidationError(
                    field="validation",
                    error_type="validation_exception",
                    message=f"Validation failed: {str(e)}"
                )]
            )

    def get_retry_recommendations(self, validation_result: AnalysisValidationResult) -> List[str]:
        """Get recommendations for retrying failed analysis"""
        recommendations = []
        
        for error in validation_result.errors:
            if error.error_type == "too_many_entities":
                recommendations.append("Reduce the number of entities identified - focus only on the most significant changes")
            elif error.error_type == "empty_field":
                recommendations.append(f"Provide content for {error.field}")
            elif error.error_type == "too_short":
                recommendations.append(f"Provide more detailed description for {error.field}")
            elif error.error_type == "too_long":
                recommendations.append(f"Shorten the description for {error.field}")
            elif error.error_type == "invalid_type":
                recommendations.append(f"Use valid entity type for {error.field}: {', '.join(self.valid_entity_types)}")
        
        return recommendations


# Global validation service instance
validation_service = ValidationService()
