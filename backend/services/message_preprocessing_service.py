# backend/services/message_preprocessing_service.py
import re
import logging
from typing import Dict, Any, Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class PreprocessedMessage:
    """Result of message preprocessing"""
    content: str  # The processed content with placeholders replaced
    original_content: str  # The original user input
    is_ooc: bool  # Whether this is an Out of Character message
    ooc_content: str  # If OOC, the extracted content without OOC markers
    sender_type: str  # "USER", "SYSTEM", or "AI"
    metadata: Dict[str, Any]  # Additional metadata about the preprocessing

class MessagePreprocessingService:
    """
    Service to handle SillyTavern-style message preprocessing:
    - {{char}} replacement with AI character/scenario name
    - {{user}} replacement with user persona name  
    - OOC (Out of Character) command detection and handling
    """
    
    def __init__(self):
        # OOC patterns to detect
        self.ooc_patterns = [
            r'^\s*\[OOC:\s*(.*?)\s*\]\s*$',  # [OOC: content]
            r'^\s*OOC:\s*(.*?)\s*$',         # OOC: content
            r'^\s*\(\s*OOC:\s*(.*?)\s*\)\s*$', # (OOC: content)
        ]
        
        # Placeholder patterns
        self.char_pattern = r'\{\{char\}\}'
        self.user_pattern = r'\{\{user\}\}'
    
    def preprocess_user_message(
        self, 
        user_input: str, 
        ai_character_name: str, 
        user_persona_name: str
    ) -> PreprocessedMessage:
        """
        Preprocess a user message for SillyTavern-style functionality.
        
        Args:
            user_input: The raw user input
            ai_character_name: Name of the AI character/scenario
            user_persona_name: Name of the user persona
            
        Returns:
            PreprocessedMessage with all processing results
        """
        original_content = user_input.strip()
        processed_content = original_content
        is_ooc = False
        ooc_content = ""
        sender_type = "USER"
        metadata = {}
        
        # Step 1: Check for OOC patterns first
        for pattern in self.ooc_patterns:
            match = re.match(pattern, original_content, re.IGNORECASE | re.DOTALL)
            if match:
                is_ooc = True
                ooc_content = match.group(1).strip()
                sender_type = "SYSTEM"
                processed_content = ooc_content  # Use the content inside OOC markers
                metadata["ooc_pattern_matched"] = pattern
                metadata["ooc_extracted"] = True
                logger.info(f"OOC message detected: '{ooc_content}'")
                break
        
        # Step 2: Replace placeholders (whether OOC or not)
        if not is_ooc:
            # For regular messages, replace placeholders
            char_replacements = 0
            user_replacements = 0
            
            # Replace {{char}} with AI character name
            processed_content, char_count = re.subn(
                self.char_pattern, 
                ai_character_name, 
                processed_content, 
                flags=re.IGNORECASE
            )
            char_replacements += char_count
            
            # Replace {{user}} with user persona name  
            processed_content, user_count = re.subn(
                self.user_pattern, 
                user_persona_name, 
                processed_content, 
                flags=re.IGNORECASE
            )
            user_replacements += user_count
            
            metadata["char_replacements"] = char_replacements
            metadata["user_replacements"] = user_replacements
            
            if char_replacements > 0:
                logger.info(f"Replaced {{{{char}}}} with '{ai_character_name}' ({char_replacements} times)")
            if user_replacements > 0:
                logger.info(f"Replaced {{{{user}}}} with '{user_persona_name}' ({user_replacements} times)")
        else:
            # For OOC messages, still do placeholder replacement in the extracted content
            char_replacements = 0
            user_replacements = 0
            
            # Replace {{char}} with AI character name
            processed_content, char_count = re.subn(
                self.char_pattern, 
                ai_character_name, 
                processed_content, 
                flags=re.IGNORECASE
            )
            char_replacements += char_count
            
            # Replace {{user}} with user persona name  
            processed_content, user_count = re.subn(
                self.user_pattern, 
                user_persona_name, 
                processed_content, 
                flags=re.IGNORECASE
            )
            user_replacements += user_count
            
            metadata["char_replacements"] = char_replacements
            metadata["user_replacements"] = user_replacements
            metadata["ooc_placeholders_replaced"] = True
        
        return PreprocessedMessage(
            content=processed_content,
            original_content=original_content,
            is_ooc=is_ooc,
            ooc_content=ooc_content if is_ooc else "",
            sender_type=sender_type,
            metadata=metadata
        )
    
    def get_ai_character_name(self, ai_persona_card: Any) -> str:
        """
        Extract the AI character name from the persona card.
        
        Args:
            ai_persona_card: The AI character/scenario card object
            
        Returns:
            The character name to use for {{char}} replacement
        """
        if hasattr(ai_persona_card, 'name') and ai_persona_card.name:
            return ai_persona_card.name
        return "AI"  # Fallback
    
    def get_user_persona_name(self, user_persona: Any) -> str:
        """
        Extract the user persona name.
        
        Args:
            user_persona: The user persona object
            
        Returns:
            The persona name to use for {{user}} replacement
        """
        if hasattr(user_persona, 'name') and user_persona.name:
            return user_persona.name
        return "User"  # Fallback
    
    def preprocess_for_display(
        self, 
        user_input: str, 
        ai_character_name: str, 
        user_persona_name: str
    ) -> str:
        """
        Preprocess message content specifically for display purposes.
        This version always replaces placeholders, even in OOC messages.
        
        Args:
            user_input: The raw user input
            ai_character_name: Name of the AI character/scenario  
            user_persona_name: Name of the user persona
            
        Returns:
            Processed content with placeholders replaced for display
        """
        processed = user_input
        
        # Replace {{char}} with AI character name
        processed = re.sub(
            self.char_pattern, 
            ai_character_name, 
            processed, 
            flags=re.IGNORECASE
        )
        
        # Replace {{user}} with user persona name
        processed = re.sub(
            self.user_pattern, 
            user_persona_name, 
            processed, 
            flags=re.IGNORECASE
        )
        
        return processed
