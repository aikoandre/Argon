# backend/services/adaptive_prompt_service.py
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from models.prompt_preset import PromptModule, UserPromptConfiguration

class AdaptivePromptService:
    """
    Service to assemble prompts for different LLM services in the Argon pipeline,
    adapting SillyTavern-style modules to our multi-service architecture.
    """
    
    def __init__(self):
        self.service_templates = {
            'generation': 'main_generation_enhanced.jinja2',
            'analysis': 'full_analysis_prompt.jinja2',
            'maintenance': 'maintenance_prompt.jinja2',
            'query_transformation': 'query_transformation_prompt.jinja2'
        }
    
    async def assemble_prompt_for_service(
        self,
        service_type: str,
        base_context: Dict[str, Any],
        user_config: UserPromptConfiguration,
        db: Session,
        rag_results: Optional[List] = None
    ) -> str:
        """
        Assemble a complete prompt for a specific service, combining:
        1. Base Jinja2 template (our core system)
        2. Applicable prompt modules (SillyTavern-style)
        3. RAG context (our enhancement)
        4. Service-specific adaptations
        """
        
        # Get enabled modules for this service
        applicable_modules = self._get_applicable_modules(service_type, user_config, db)
        
        # Assemble prompt based on service type
        if service_type == 'generation':
            return await self._assemble_generation_prompt(
                base_context, applicable_modules, rag_results
            )
        elif service_type == 'analysis':
            return await self._assemble_analysis_prompt(
                base_context, applicable_modules
            )
        elif service_type == 'maintenance':
            return await self._assemble_maintenance_prompt(
                base_context, applicable_modules
            )
        elif service_type == 'query_transformation':
            return await self._assemble_query_prompt(
                base_context, applicable_modules
            )
        else:
            raise ValueError(f"Unknown service type: {service_type}")
    
    async def _assemble_generation_prompt(
        self,
        context: Dict[str, Any],
        modules: List[PromptModule],
        rag_results: Optional[List] = None
    ) -> str:
        """
        Assemble the main generation prompt with full SillyTavern-style modules.
        This is where most of the character/style/stance modules apply.
        """
        
        # Start with base template context
        prompt_parts = []
        
        # Add core system modules (always first)
        core_modules = [m for m in modules if m.category == 'core']
        for module in sorted(core_modules, key=lambda x: x.injection_order):
            prompt_parts.append(self._render_module(module, context))
        
        # Add character/scenario context from our database
        if context.get('ai_persona_card'):
            char_context = f"""
## CHARACTER CONTEXT
You are {context['ai_persona_card']['name']}.
Personality: {context['ai_persona_card']['description']}
Instructions: {context['ai_persona_card']['instructions']}
"""
            prompt_parts.append(char_context)
        
        # Add RAG context (our unique enhancement)
        if rag_results:
            rag_context = self._format_rag_context(rag_results)
            prompt_parts.append(rag_context)
        
        # Add style/stance modules
        style_modules = [m for m in modules if m.category in ['style', 'stance']]
        for module in sorted(style_modules, key=lambda x: x.injection_order):
            prompt_parts.append(self._render_module(module, context))
        
        # Add utility modules (formatting, etc.)
        utility_modules = [m for m in modules if m.category == 'utility']
        for module in sorted(utility_modules, key=lambda x: x.injection_order):
            prompt_parts.append(self._render_module(module, context))
        
        # Add conversation history
        if context.get('chat_history'):
            prompt_parts.append(f"\n## CONVERSATION HISTORY\n{context['chat_history']}")
        
        # Add current user message
        if context.get('user_message'):
            prompt_parts.append(f"\n## CURRENT MESSAGE\n{context['user_message']}")
        
        return "\n\n".join(prompt_parts)
    
    async def _assemble_analysis_prompt(
        self,
        context: Dict[str, Any],
        modules: List[PromptModule]
    ) -> str:
        """
        Assemble analysis prompt with focus on relationship/memory extraction.
        Only certain modules apply here (core analysis instructions).
        """
        
        prompt_parts = []
        
        # Analysis-specific core modules
        analysis_modules = [m for m in modules if 
                          m.category == 'core' and 
                          any(keyword in m.name.lower() for keyword in 
                              ['analysis', 'memory', 'relationship', 'extraction'])]
        
        for module in sorted(analysis_modules, key=lambda x: x.injection_order):
            prompt_parts.append(self._render_module(module, context))
        
        # Add our standard analysis template
        base_template = f"""
You are analyzing a conversation turn to extract key information for dynamic memory management.

User Message: {context.get('user_message', '')}
AI Response: {context.get('ai_response', '')}
"""
        prompt_parts.append(base_template)
        
        return "\n\n".join(prompt_parts)
    
    async def _assemble_maintenance_prompt(
        self,
        context: Dict[str, Any],
        modules: List[PromptModule]
    ) -> str:
        """
        Assemble maintenance prompt for background memory updates.
        Focus on world-building and consistency modules.
        """
        
        prompt_parts = []
        
        # Maintenance-relevant modules
        maintenance_modules = [m for m in modules if 
                             m.category == 'core' and
                             any(keyword in m.name.lower() for keyword in 
                                 ['world', 'consistency', 'memory', 'maintenance'])]
        
        for module in sorted(maintenance_modules, key=lambda x: x.injection_order):
            prompt_parts.append(self._render_module(module, context))
        
        return "\n\n".join(prompt_parts)
    
    async def _assemble_query_prompt(
        self,
        context: Dict[str, Any],
        modules: List[PromptModule]
    ) -> str:
        """
        Assemble query transformation prompt.
        Very focused - only transformation-relevant modules.
        """
        
        # Query transformation is usually very focused
        # Only apply modules specifically marked for query transformation
        query_modules = [m for m in modules if 
                        'query_transformation' in m.applicable_services]
        
        if not query_modules:
            # Fallback to basic query transformation
            return f"Transform this user message into search terms: {context.get('raw_user_message', '')}"
        
        prompt_parts = []
        for module in sorted(query_modules, key=lambda x: x.injection_order):
            prompt_parts.append(self._render_module(module, context))
        
        return "\n\n".join(prompt_parts)
    
    def _get_applicable_modules(
        self,
        service_type: str,
        user_config: UserPromptConfiguration,
        db: Session
    ) -> List[PromptModule]:
        """Get enabled modules that apply to the specified service."""
        
        if not user_config.active_preset_id:
            return []
        
        modules = db.query(PromptModule).filter(
            PromptModule.preset_id == user_config.active_preset_id,
            PromptModule.enabled == True
        ).all()
        
        # Filter modules applicable to this service
        applicable_modules = []
        for module in modules:
            if self._is_module_applicable(module, service_type):
                applicable_modules.append(module)
        
        return applicable_modules
    
    def _is_module_applicable(self, module: PromptModule, service_type: str) -> bool:
        """Determine if a module should be applied to a specific service."""
        
        # If module has explicit service configuration, use it
        if hasattr(module, 'applicable_services') and module.applicable_services:
            return service_type in module.applicable_services
        
        # Otherwise, use smart defaults based on category and service
        service_applicability = {
            'generation': ['core', 'style', 'stance', 'utility'],
            'analysis': ['core'],  # Only core analysis modules
            'maintenance': ['core'],  # Only core maintenance modules  
            'query_transformation': []  # Very selective
        }
        
        return module.category in service_applicability.get(service_type, [])
    
    def _render_module(self, module: PromptModule, context: Dict[str, Any]) -> str:
        """Render a module's content with context variables."""
        
        content = module.content
        
        # Replace common SillyTavern variables with our context
        replacements = {
            '{{char}}': context.get('ai_persona_card', {}).get('name', 'Assistant'),
            '{{user}}': context.get('user_persona', {}).get('name', 'User'),
            '{{char_description}}': context.get('ai_persona_card', {}).get('description', ''),
            '{{char_instructions}}': context.get('ai_persona_card', {}).get('instructions', ''),
            '{{scenario}}': context.get('scenario_card', {}).get('description', ''),
        }
        
        for placeholder, value in replacements.items():
            content = content.replace(placeholder, value)
        
        return content
    
    def _format_rag_context(self, rag_results: List) -> str:
        """Format RAG results for inclusion in prompt."""
        
        if not rag_results:
            return ""
        
        context_parts = ["## RELEVANT CONTEXT"]
        
        for result in rag_results[:5]:  # Limit to top 5 results
            if hasattr(result, 'content'):
                context_parts.append(f"- {result.content}")
            elif isinstance(result, dict):
                context_parts.append(f"- {result.get('content', '')}")
        
        return "\n".join(context_parts)

# Service instance
adaptive_prompt_service = AdaptivePromptService()
