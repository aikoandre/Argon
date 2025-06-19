# backend/services/session_note_rewriter.py
"""
Advanced SessionNote Rewriting Service for Phase 3.

Provides sophisticated LLM-driven note rewriting with context awareness and quality control.
"""
import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel

from .litellm_service import litellm_service
from utils.reasoning_utils import is_reasoning_capable_model

logger = logging.getLogger(__name__)


class RewriteResult(BaseModel):
    """Result of session note rewriting"""
    success: bool
    rewritten_content: str = ""
    quality_score: float = 0.0
    error_message: str = ""
    reasoning_used: bool = False


class SessionNoteRewriter:
    """Advanced service for rewriting SessionNotes with LLM integration"""
    
    def __init__(self):
        self.litellm_service = litellm_service
        self.max_content_length = 2000
        self.min_quality_score = 0.7

    async def rewrite_session_note(
        self,
        lore_entry_content: str,
        current_session_note: str,
        update_summary: str,
        user_settings: Dict[str, Any],
        entity_name: str = "",
        turn_context: Optional[Dict[str, Any]] = None,
        reasoning_mode: Optional[str] = None,
        reasoning_effort: Optional[str] = None
    ) -> RewriteResult:
        """
        Rewrite a session note with advanced context awareness.
        
        Args:
            lore_entry_content: Base lore entry description
            current_session_note: Current session note content
            update_summary: New information to integrate
            user_settings: User LLM configuration
            entity_name: Name of the entity being updated
            turn_context: Optional conversation context
            reasoning_mode: Optional reasoning mode for capable models
            reasoning_effort: Optional reasoning effort level
        """
        try:
            # Extract LLM configuration
            provider = user_settings.get('analysis_llm_provider', 'openrouter')
            model = user_settings.get('analysis_llm_model_new') or user_settings.get('analysis_llm_model', 'mistral-large-latest')
            api_key = user_settings.get('analysis_llm_api_key_new') or user_settings.get('analysis_llm_api_key')
            
            # Create enhanced rewrite prompt
            prompt = self._create_rewrite_prompt(
                lore_entry_content=lore_entry_content,
                current_session_note=current_session_note,
                update_summary=update_summary,
                entity_name=entity_name,
                turn_context=turn_context
            )
            
            # Configure reasoning if available
            reasoning_params = {}
            reasoning_used = False
            if is_reasoning_capable_model(model) and reasoning_mode:
                reasoning_params = {
                    "reasoning_mode": reasoning_mode,
                    "reasoning_effort": reasoning_effort or "medium"
                }
                reasoning_used = True
            
            # Call LLM for rewriting
            response = await self.litellm_service.get_completion(
                provider=provider,
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=api_key,
                max_tokens=1200,
                temperature=0.6,
                **reasoning_params
            )
            
            # Extract content
            content = response.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            if not content:
                return RewriteResult(
                    success=False,
                    error_message="Empty response from LLM"
                )
            
            # Clean and validate the rewritten content
            rewritten_content = self._clean_rewritten_content(content)
            
            # Calculate quality score
            quality_score = self._calculate_quality_score(
                original_note=current_session_note,
                rewritten_note=rewritten_content,
                update_summary=update_summary
            )
            
            logger.info(f"[SessionNoteRewriter] Rewritten note for {entity_name}, quality: {quality_score:.2f}")
            
            return RewriteResult(
                success=True,
                rewritten_content=rewritten_content,
                quality_score=quality_score,
                reasoning_used=reasoning_used
            )
            
        except Exception as e:
            logger.error(f"[SessionNoteRewriter] Error: {e}")
            
            # Fallback: append update to existing note
            fallback_content = self._create_fallback_content(current_session_note, update_summary)
            
            return RewriteResult(
                success=True,  # Still successful, just using fallback
                rewritten_content=fallback_content,
                quality_score=0.5,  # Lower quality for fallback
                error_message=f"Used fallback due to LLM error: {str(e)}"
            )

    def _create_rewrite_prompt(
        self,
        lore_entry_content: str,
        current_session_note: str,
        update_summary: str,
        entity_name: str,
        turn_context: Optional[Dict[str, Any]]
    ) -> str:
        """Create an enhanced rewrite prompt with context"""
        
        context_section = ""
        if turn_context:
            recent_messages = turn_context.get('chat_history', [])[-3:]  # Last 3 messages
            if recent_messages:
                context_section = f"""
[Recent Conversation Context]:
{chr(10).join([f"{msg.get('sender', 'Unknown')}: {msg.get('content', '')}" for msg in recent_messages])}
"""
        
        return f"""You are an expert story continuity editor. Your task is to update session notes for the character/entity "{entity_name}" based on new story developments.

[Base Character/Entity Information]:
{lore_entry_content}

[Current Session Notes]:
{current_session_note if current_session_note.strip() else "No previous session notes for this character."}

[New Story Development]:
{update_summary}
{context_section}

**Instructions:**
1. Rewrite the COMPLETE session notes incorporating the new development
2. Preserve all existing accurate information
3. Integrate the new information naturally and chronologically  
4. Maintain narrative consistency and character voice
5. Remove any contradictory information, keeping the most recent version
6. Keep the tone consistent with the story style
7. Be concise but comprehensive

**Requirements:**
- Maximum 400 words
- Third-person perspective
- Focus on character development, relationships, and story progression
- Highlight significant changes or growth

**Respond ONLY with the complete rewritten session notes:**"""

    def _clean_rewritten_content(self, content: str) -> str:
        """Clean and format the rewritten content"""
        # Remove common LLM artifacts
        content = content.strip()
        
        # Remove any "Here are the rewritten notes:" type prefixes
        import re
        content = re.sub(r'^(here are the |here is the |the |these are the |updated |rewritten )?session notes?:?\s*', '', content, flags=re.IGNORECASE)
        content = re.sub(r'^(new |updated |complete )?session notes?:?\s*', '', content, flags=re.IGNORECASE)
        
        # Remove quotes if the entire content is wrapped in them
        if content.startswith('"') and content.endswith('"'):
            content = content[1:-1]
        if content.startswith("'") and content.endswith("'"):
            content = content[1:-1]
        
        # Limit length
        if len(content) > self.max_content_length:
            content = content[:self.max_content_length] + "..."
        
        return content.strip()

    def _calculate_quality_score(
        self,
        original_note: str,
        rewritten_note: str,
        update_summary: str
    ) -> float:
        """Calculate a quality score for the rewritten note"""
        score = 0.0
        
        # Length check (0.2)
        if 50 <= len(rewritten_note) <= self.max_content_length:
            score += 0.2
        elif len(rewritten_note) > 20:
            score += 0.1
        
        # Content preservation check (0.3)
        if original_note:
            # Check if key terms from original are preserved
            original_words = set(original_note.lower().split())
            rewritten_words = set(rewritten_note.lower().split())
            
            if original_words:
                preservation_ratio = len(original_words.intersection(rewritten_words)) / len(original_words)
                score += preservation_ratio * 0.3
        else:
            score += 0.3  # No original content to preserve
        
        # Update integration check (0.3)
        update_words = set(update_summary.lower().split())
        rewritten_words = set(rewritten_note.lower().split())
        
        if update_words:
            integration_ratio = len(update_words.intersection(rewritten_words)) / len(update_words)
            score += integration_ratio * 0.3
        
        # Format and structure check (0.2)
        if rewritten_note and not rewritten_note.startswith('"'):
            score += 0.1
        if len(rewritten_note.split('.')) >= 2:  # At least 2 sentences
            score += 0.1
        
        return min(score, 1.0)

    def _create_fallback_content(self, current_note: str, update_summary: str) -> str:
        """Create fallback content when LLM rewriting fails"""
        if current_note:
            return f"{current_note}\n\n[Recent Development]: {update_summary}"
        else:
            return f"[Character Development]: {update_summary}"


# Global rewriter instance
session_note_rewriter = SessionNoteRewriter()
