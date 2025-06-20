# backend/services/sillytavern_import_service.py
import json
import uuid
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from models.prompt_preset import PromptPreset, PromptModule
from db.database import get_db

class SillyTavernImportService:
    """
    Service to import SillyTavern prompt configurations and convert them
    to our modular prompt system, with special handling for NemoEngine-style prompts.
    """
    
    def __init__(self):
        self.category_mapping = {
            # Core system prompts
            'main_system_role': 'core',
            'jailbreak_unrestricted': 'core', 
            'core_writing_style': 'core',
            'general_instructions_constraints': 'core',
            'user_input_interpretation_guide': 'core',
            'character_development_principles': 'core',
            
            # Writing style prompts
            'style_ao3_flavor': 'style',
            'style_ironic_comedy': 'style',
            'author_style': 'style',
            
            # Stance/mood prompts
            'stance_cooperative': 'stance',
            'stance_neutral': 'stance', 
            'stance_adversarial': 'stance',
            
            # Utility features
            'nsfw': 'utility',
            'danger_protocol': 'utility',
            'color_formatting': 'utility',
            'tutorial_mode': 'utility'
        }
    
    def import_sillytavern_preset(
        self, 
        sillytavern_data: Dict[str, Any], 
        preset_name: str,
        db: Session
    ) -> PromptPreset:
        """
        Import a complete SillyTavern preset into our modular system.
        
        Args:
            sillytavern_data: The JSON data from SillyTavern export
            preset_name: Name for the new preset
            db: Database session
            
        Returns:
            Created PromptPreset instance
        """
        
        # Create the preset
        preset_id = str(uuid.uuid4())
        preset = PromptPreset(
            id=preset_id,
            name=preset_name,
            description=f"Imported from SillyTavern - {preset_name}",
            is_sillytavern_compatible=True,
            is_default=False
        )
        
        db.add(preset)
        
        # Process prompts from SillyTavern format
        prompts = sillytavern_data.get('prompts', [])
        
        for prompt_data in prompts:
            if self._should_import_prompt(prompt_data):
                module = self._convert_prompt_to_module(prompt_data, preset_id)
                if module:
                    db.add(module)
        
        db.commit()
        db.refresh(preset)
        
        return preset
    
    def _should_import_prompt(self, prompt_data: Dict[str, Any]) -> bool:
        """
        Determine if a SillyTavern prompt should be imported.
        Skip empty prompts, markers, and system-internal prompts.
        """
        
        # Skip if no content
        if not prompt_data.get('content', '').strip():
            return False
            
        # Skip marker prompts (just visual separators)
        if prompt_data.get('marker', False):
            return False
            
        # Skip if name suggests it's a separator or system prompt
        name = prompt_data.get('name', '').lower()
        skip_patterns = [
            'main prompt',  # This is handled separately
            'severs system prompt',
            'experimental prompt freeuse',
            'testing with weirness'
        ]
        
        for pattern in skip_patterns:
            if pattern in name:
                return False
                
        return True
    
    def _convert_prompt_to_module(
        self, 
        prompt_data: Dict[str, Any], 
        preset_id: str
    ) -> Optional[PromptModule]:
        """
        Convert a single SillyTavern prompt to our PromptModule format.
        """
        
        identifier = prompt_data.get('identifier', '')
        name = prompt_data.get('name', 'Unnamed Prompt')
        content = prompt_data.get('content', '')
        
        # Determine category based on identifier patterns
        category = self._determine_category(identifier, name)
        
        # Clean up the name (remove emoji prefixes for cleaner display)
        clean_name = self._clean_prompt_name(name)
        
        module = PromptModule(
            id=str(uuid.uuid4()),
            preset_id=preset_id,
            identifier=identifier,
            name=clean_name,
            category=category,
            content=content,
            enabled=prompt_data.get('enabled', True),
            injection_position=prompt_data.get('injection_position', 0),
            injection_depth=prompt_data.get('injection_depth', 4),
            injection_order=prompt_data.get('injection_order', 0),
            forbid_overrides=prompt_data.get('forbid_overrides', False),
            role=prompt_data.get('role', 'system')
        )
        
        return module
    
    def _determine_category(self, identifier: str, name: str) -> str:
        """
        Determine the appropriate category for a prompt module.
        """
        
        # Check direct identifier mapping
        if identifier in self.category_mapping:
            return self.category_mapping[identifier]
        
        # Check name-based patterns
        name_lower = name.lower()
        
        if any(pattern in name_lower for pattern in ['system:', 'core', 'jailbreak', 'instructions']):
            return 'core'
        elif any(pattern in name_lower for pattern in ['style:', 'author', 'writing', 'ao3', 'comedy']):
            return 'style'
        elif any(pattern in name_lower for pattern in ['stance:', 'cooperative', 'adversarial', 'neutral']):
            return 'stance'
        elif any(pattern in name_lower for pattern in ['utility:', 'nsfw', 'danger', 'color', 'tutorial']):
            return 'utility'
        else:
            # Default to utility for unrecognized prompts
            return 'utility'
    
    def _clean_prompt_name(self, name: str) -> str:
        """
        Clean up SillyTavern prompt names for better display.
        Remove emoji indicators and format consistently.
        """
        
        # Remove common SillyTavern prefixes
        prefixes_to_remove = [
            '📜︱System: ',
            '🎨︱Style: ',
            '🎨︱Instructions: ',
            '🎨︱Principles: ',
            '🔥︱NSFW: ',
            '🔧︱Utility: ',
            '✨︱OPTIONAL STANCE: ',
            '✨🎨︱OPTIONAL STYLE: ',
            '✨🔥︱OPTIONAL NSFW: ',
            '✨✍️︱OPTIONAL AUTHOR STYLE: ',
            '✨🧭︱OPTIONAL UTILITY: ',
            '✨❗︱OPTIONAL: '
        ]
        
        clean_name = name
        for prefix in prefixes_to_remove:
            if clean_name.startswith(prefix):
                clean_name = clean_name[len(prefix):]
                break
        
        # Remove parenthetical notes like "(Essential just here for things to play off main)"
        if '(' in clean_name and ')' in clean_name:
            clean_name = clean_name.split('(')[0].strip()
        
        return clean_name or "Unnamed Prompt"
    
    def create_default_nemo_engine_preset(self, db: Session) -> PromptPreset:
        """
        Create the default NemoEngine v5.8 preset for Argon.
        This becomes the default preset that users see when they first use the system.
        """
        
        preset_id = str(uuid.uuid4())
        preset = PromptPreset(
            id=preset_id,
            name="NemoEngine v5.8 (Default)",
            description="Default NemoEngine v5.8 configuration optimized for Argon's multi-service pipeline",
            is_sillytavern_compatible=True,
            is_default=True
        )
        
        db.add(preset)
        
        # Core modules (always enabled for the default preset)
        modules = [
            {
                'identifier': 'main_system_role',
                'name': 'Core Role & Persona',
                'category': 'core',
                'content': '''You are {{char}}, a character in a rich roleplaying world.
Your personality: {{char_description}}
Your behavioral guidelines: {{char_instructions}}

Collaboratively craft engaging roleplaying stories with {{user}}. Portray {{char}} authentically and narrate the world/events. Aim for original, coherent, fun stories.''',
                'enabled': True,
                'injection_order': 0,
                'applicable_services': ['generation']
            },
            {
                'identifier': 'core_writing_style',
                'name': 'Narrative Style & Tone',
                'category': 'core',
                'content': '''NARRATIVE STYLE: Write engaging prose. Use vivid descriptions. Balance description with natural dialogue. Inject genre tones or drama. Assume {{user}} understands subtext/sarcasm. Vary sentence/paragraph length for dynamic rhythm. Write in a naturalistic way, favoring more modern American/European/Japanese styles of writing rather than flowery purple prose, focus on easy to read style, account for reader fatigue, and break up paragraphs to vary their lengths.''',
                'enabled': True,
                'injection_order': 1,
                'applicable_services': ['generation']
            },
            {
                'identifier': 'general_instructions_constraints',
                'name': 'General Storytelling & Constraints',
                'category': 'core',
                'content': '''GENERAL STORYTELLING: 1. In Character: NPCs have agency, evolving thoughts/emotions. 2. Proactive Plot: Take initiative (challenges, twists, time skips, emotional beats) to keep story moving. NPCs act decisively; avoid asking {{user}} what to do (unless characteristic). 3. Show, Don't Tell (Mostly): Describe experiences, actions, dialogue. Reveal intent/emotion via actions. Marked internal NPC thoughts add depth. 4. Novelty: Introduce new details/events to avoid repetition. 5. Dynamic World: Introduce new NPCs/environmental elements. Characters interact with environment. 6. Consistency: Maintain spatial/physical details (positions, clothing, injuries, items). Changes must be logical & described.''',
                'enabled': True,
                'injection_order': 2,
                'applicable_services': ['generation']
            },
            {
                'identifier': 'stance_neutral',
                'name': 'Neutral/Realistic Stance',
                'category': 'stance',
                'content': '''STANCE: NEUTRAL/REALISTIC - NPCs act per established personalities, motivations, logic. Cooperativeness is context-dependent. Challenges have tangible, realistic consequences. Relationships develop organically. Balanced opportunities/obstacles.''',
                'enabled': True,
                'injection_order': 20,
                'applicable_services': ['generation']
            },
            {
                'identifier': 'style_ao3_flavor',
                'name': 'AO3 Flavor (Optional)',
                'category': 'style',
                'content': '''STYLE: AO3 FLAVOR Informal, fanfic-esque narration (more literary than typical AO3). More NPC internal thoughts, casual language, focus on emotional beats & character dynamics.''',
                'enabled': False,
                'injection_order': 10,
                'applicable_services': ['generation']
            },
            {
                'identifier': 'color_formatting_v2',
                'name': 'Color Formatting (Optional)',
                'category': 'utility',
                'content': '''Color dialogue and thoughts with HTML font tags:
- Character speech: <font color="lightblue">
- Character thoughts: <font color="lightcyan">
- Other character speech: <font color="yellow">
- Narrator text: No coloring needed''',
                'enabled': False,
                'injection_order': 30,
                'applicable_services': ['generation']
            }
        ]
        
        for module_data in modules:
            module = PromptModule(
                id=str(uuid.uuid4()),
                preset_id=preset_id,
                identifier=module_data['identifier'],
                name=module_data['name'],
                category=module_data['category'],
                content=module_data['content'],
                enabled=module_data['enabled'],
                injection_order=module_data['injection_order'],
                role='system'
            )
            db.add(module)
        
        db.commit()
        db.refresh(preset)
        
        return preset
        """
        Create a preset specifically based on the NemoEngine configuration.
        This creates a curated selection of the most useful NemoEngine modules.
        """
        
        preset_id = str(uuid.uuid4())
        preset = PromptPreset(
            id=preset_id,
            name="NemoEngine v5.8 (Curated)",
            description="Curated selection from NemoEngine v5.8 optimized for Argon",
            is_sillytavern_compatible=True,
            is_default=True
        )
        
        db.add(preset)
        
        # Core modules (always enabled)
        core_modules = [
            {
                'identifier': 'main_system_role',
                'name': 'Core Role & Persona',
                'category': 'core',
                'content': '''You are {{char}}, a character in a rich roleplaying world.
Your personality: {{char_description}}
Your behavioral guidelines: {{char_instructions}}

Collaboratively craft engaging roleplaying stories with {{user}}. Portray {{char}} authentically and narrate the world/events. Aim for original, coherent, fun stories.''',
                'enabled': True,
                'injection_order': 0
            },
            {
                'identifier': 'core_writing_style',
                'name': 'Narrative Style & Tone',
                'category': 'core',
                'content': '''NARRATIVE STYLE: Write engaging prose. Use vivid descriptions. Balance description with natural dialogue. Inject genre tones or drama. Assume {{user}} understands subtext/sarcasm. Vary sentence/paragraph length for dynamic rhythm. Write in a naturalistic way, favoring more modern American/European/Japanese styles of writing rather than flowery purple prose, focus on easy to read style, account for reader fatigue, and break up paragraphs to vary their lengths.''',
                'enabled': True,
                'injection_order': 1
            },
            {
                'identifier': 'general_instructions_constraints',
                'name': 'General Storytelling & Constraints',
                'category': 'core',
                'content': '''GENERAL STORYTELLING: 1. In Character: NPCs have agency, evolving thoughts/emotions. 2. Proactive Plot: Take initiative (challenges, twists, time skips, emotional beats) to keep story moving. NPCs act decisively; avoid asking {{user}} what to do (unless characteristic). 3. Show, Don't Tell (Mostly): Describe experiences, actions, dialogue. Reveal intent/emotion via actions. Marked internal NPC thoughts add depth. 4. Novelty: Introduce new details/events to avoid repetition. 5. Dynamic World: Introduce new NPCs/environmental elements. Characters interact with environment. 6. Consistency: Maintain spatial/physical details (positions, clothing, injuries, items). Changes must be logical & described.''',
                'enabled': True,
                'injection_order': 2
            }
        ]
        
        # Style modules (optional)
        style_modules = [
            {
                'identifier': 'style_ao3_flavor',
                'name': 'AO3 Flavor',
                'category': 'style',
                'content': 'STYLE: AO3 FLAVOR Informal, fanfic-esque narration (more literary than typical AO3). More NPC internal thoughts, casual language, focus on emotional beats & character dynamics.',
                'enabled': False,
                'injection_order': 10
            },
            {
                'identifier': 'style_ironic_comedy',
                'name': 'Ironic Comedy Mode',
                'category': 'style',
                'content': 'STYLE: IRONIC COMEDY Emphasize comedic situations, witty banter, absurdism, characters reacting in unexpectedly funny ways.',
                'enabled': False,
                'injection_order': 11
            }
        ]
        
        # Stance modules (choose one)
        stance_modules = [
            {
                'identifier': 'stance_cooperative',
                'name': 'Cooperative/Playful',
                'category': 'stance',
                'content': 'STANCE: COOPERATIVE/PLAYFUL - NPCs generally helpful, understanding, inclined to assist {{user}}. Challenges are usually surmountable. Tone allows lighter/heroic outcomes. Characters are more open to {{user}}\'s influence. World offers more fun, humor, or heartwarming interactions.',
                'enabled': False,
                'injection_order': 20
            },
            {
                'identifier': 'stance_neutral',
                'name': 'Neutral/Realistic',
                'category': 'stance',
                'content': 'STANCE: NEUTRAL/REALISTIC - NPCs act per established personalities, motivations, logic. Cooperativeness is context-dependent. Challenges have tangible, realistic consequences. Relationships develop organically. Balanced opportunities/obstacles.',
                'enabled': True,
                'injection_order': 21
            },
            {
                'identifier': 'stance_adversarial',
                'name': 'Adversarial/Gritty',
                'category': 'stance',
                'content': 'STANCE: ADVERSARIAL/GRITTY - NPCs often uncooperative, suspicious, or have conflicting goals. Challenges are frequent, difficult; failure can have significant negative consequences. Trust is hard to build. Tone may be darker/survival-oriented.',
                'enabled': False,
                'injection_order': 22
            }
        ]
        
        # Utility modules (optional features)
        utility_modules = [
            {
                'identifier': 'color_formatting_v2',
                'name': 'Color Formatting',
                'category': 'utility',
                'content': '<COLOR_FORMATTING> Color dialogue (e.g.,"<font color=skyblue>Hello!</font>") & thoughts (e.g., *<font color=lightcoral>I wonder...</font>*) by coloring ONLY text inside delimiters. Assign each character ({{char}} {{user}}, major NPCs) a unique, consistent, light/readable color. Delimiters (quotes, asterisks), attribution (said, thought), and narration remain default color. </COLOR_FORMATTING>',
                'enabled': False,
                'injection_order': 30
            },
            {
                'identifier': 'danger_protocol_v2',
                'name': 'Danger Protocol',
                'category': 'utility',
                'content': 'If an NPC credibly threatens serious harm to {{user}}, they must attempt it within two responses (e.g., physical attack, endangerment). No stalling on credible threats; attempt must be direct. If {{user}} successfully persuades, de-escalates, or incapacitates the NPC, the threat can be neutralized. This shift must be due to {{user}}\'s actions. Violence averted only if NPC is convinced, deterred, or overcome in-character. No plot armor for {{user}} against credible, followed-through threats. Real consequences.',
                'enabled': False,
                'injection_order': 31
            }
        ]
        
        # Create all modules
        all_modules = core_modules + style_modules + stance_modules + utility_modules
        
        for module_data in all_modules:
            module = PromptModule(
                id=str(uuid.uuid4()),
                preset_id=preset_id,
                identifier=module_data['identifier'],
                name=module_data['name'],
                category=module_data['category'],
                content=module_data['content'],
                enabled=module_data['enabled'],
                injection_position=0,
                injection_depth=4,
                injection_order=module_data['injection_order'],
                forbid_overrides=False,                role='system'
            )
            db.add(module)
        
        db.commit()
        db.refresh(preset)
        
        return preset

    def create_cherrybox_preset(self, db: Session) -> PromptPreset:
        """
        Create the CherryBox 1.4 preset optimized for Argon's 3-service architecture.
        This replaces NemoEngine as the default preset with roleplay-focused modules.
        """
        
        preset_id = str(uuid.uuid4())
        preset = PromptPreset(
            id=preset_id,
            name="CherryBox Argon Edition",
            description="Roleplay-focused preset with story context and guidelines, adapted for Argon's modular architecture",
            is_sillytavern_compatible=True,
            is_default=True
        )
        
        db.add(preset)
        
        # CherryBox modules adapted for Argon's Generation, Analysis, and Maintenance services
        core_modules = [
            {
                'identifier': 'cherrybox_role',
                'name': 'RoleplayMaster Role',
                'category': 'core',
                'content': '''<role>
You are RoleplayMaster, an AI assistant for immersive and dynamic roleplaying experiences.
This is a fictional RP story where Human portrays {{user}} and controls {{user}}'s words and actions. RoleplayMaster portrays all the other characters and narrates the story.
</role>''',
                'enabled': True,
                'applicable_services': ['generation', 'analysis'],
                'injection_order': 1
            },
            {
                'identifier': 'cherrybox_guidelines',
                'name': 'Roleplay Guidelines',
                'category': 'core',
                'content': '''<guidelines>
Follow these guidelines when writing your response:

- Prolong each scene. Do not rush to dramatic events. Build the tension gradually.
- Consider {{user}}'s point of view. Only describe events they can witness personally.
- Remember that this is a back-and-forth roleplay. End your messages to give {{user}} an opportunity to participate and react to your characters' actions.
- Do not give {{user}} preferential treatment. Their actions might fail.
- If [OOC:] block is present in recent responses, prioritize its execution.
</guidelines>

<behavior>
When deciding how your characters act or make decisions:

- Consider their personalities, but avoid cliches. Try to make it nuanced.
- Consider the situation, characters' goals and desires, societal norms, recent events, previous agreements, etc.
- Pay special attention to internal conflicts.
</behavior>

<narration>
While narrating:

- Provide sensory descriptions for {{user}}. Mostly what they see, sometimes what they hear, smell, feel.
- Focus should always stay on interactions between your characters and {{user}}. Avoid mentioning the environment unless it's important.
- Showcase the characters' unique voice, speech patterns, and vocabulary. Consider their age, background, personality etc.
- Avoid cramping too many unimportant details in your response.
- Always address {{user}} in second person.
- Vary your language. Avoid using the same expressions, descriptions, and euphemisms that you already used in previous responses.
- Do not narrate {{user}}'s words or actions.
</narration>''',
                'enabled': True,
                'applicable_services': ['generation'],
                'injection_order': 2
            },
            {
                'identifier': 'cherrybox_story_context',
                'name': 'Story Context Framework',
                'category': 'core',
                'content': '''<story_context>
Here is the description of the story setting and its characters. Pay attention to all the details:

{{char_description}}
{{scenario}}
{{personality}}
</story_context>''',
                'enabled': True,
                'applicable_services': ['generation', 'maintenance'],
                'injection_order': 3
            }
        ]
        
        # Style modules for writing and behavior
        style_modules = [
            {
                'identifier': 'cherrybox_reminder',
                'name': 'Scene Reminder',
                'category': 'style',
                'content': '''<reminder>
A quick reminder:
- Consider what {{user}} can see right now. Do not describe things that are out of their view.
- Focus on character(s) with whom {{user}} interacts right now? Introduce other characters only if it will really benefit the story.
- Prolong the scene.
</reminder>''',
                'enabled': True,
                'applicable_services': ['generation'],
                'injection_order': 10
            },
            {
                'identifier': 'cherrybox_infoblock',
                'name': 'Infoblock Tracker',
                'category': 'style',
                'content': '''End your response with "infoblock" to keep track of the scene. Be factual and to the point. Use the format below:

<infoblock>
```md
Location: (Current location)
Positions: (All the characters' and {{user}}'s current positions relative to each other.)
Outfits: (For each character their current clothing and underwear. If it's not described, guess.)
```
</infoblock>''',
                'enabled': False,
                'applicable_services': ['generation'],
                'injection_order': 11
            }
        ]
        
        # Stance modules for content handling
        stance_modules = [
            {
                'identifier': 'cherrybox_nsfw',
                'name': 'NSFW Content Guidelines',
                'category': 'stance',
                'content': '''<nsfw_preferences>

All kind of explicit sexual content is allowed in this story. But do not rush straight to it. Try to build tension slowly.

Use these guidelines in sexual/erotic scenes:
- Don't rush to orgasm. Make sex conversational.
- Take into account characters' age and sexual experience while describing their reactions to various activities.
- Use the knowledge of human anatomy. Make sex realistic.
- For female characters their arousment should depend on the situation (attraction to the partner, circumstances of the encounter etc.)

Additionally, while narrating sexual situations, make them exciting and arousing with the following:

- Describe characters' bodies (only what's visible to {{user}}).
- Use straightforward, vulgar or anatomical terms like "pussy", "vagina", "cock", "penis", "ass" etc. Avoid euphemisms and metaphors.

</nsfw_preferences>''',
                'enabled': False,
                'applicable_services': ['generation'],
                'injection_order': 20
            }
        ]
        
        # Utility modules for special features
        utility_modules = [
            {
                'identifier': 'cherrybox_persona',
                'name': 'User Persona Integration',
                'category': 'utility',
                'content': '''<{{user}}>
{{persona}}
</{{user}}>''',
                'enabled': True,
                'applicable_services': ['generation', 'analysis'],
                'injection_order': 30
            },
            {
                'identifier': 'cherrybox_memory_maintenance',
                'name': 'Memory and Consistency Tracking',
                'category': 'utility',
                'content': '''<memory_tracking>
Monitor for:
- Character development and relationship changes
- Important story events and their consequences
- New locations, objects, or world-building elements
- Emotional states and character motivations
- Consistency with established character traits and story elements

Update session memory when significant changes occur to characters, relationships, or world state.
</memory_tracking>''',
                'enabled': True,
                'applicable_services': ['analysis', 'maintenance'],
                'injection_order': 31
            },
            {
                'identifier': 'cherrybox_start_prompt',
                'name': 'Roleplay Starter',
                'category': 'utility',
                'content': 'Let\'s start the roleplay.',
                'enabled': False,
                'applicable_services': ['generation'],
                'injection_order': 99
            }
        ]
        
        # Create all modules with proper service assignments
        all_modules = core_modules + style_modules + stance_modules + utility_modules
        
        for module_data in all_modules:
            module = PromptModule(
                id=str(uuid.uuid4()),
                preset_id=preset_id,
                identifier=module_data['identifier'],
                name=module_data['name'],
                category=module_data['category'],
                content=module_data['content'],
                enabled=module_data['enabled'],
                injection_position=0,
                injection_depth=4,
                injection_order=module_data['injection_order'],
                forbid_overrides=False,
                role='system',
                applicable_services=json.dumps(module_data['applicable_services']),
                is_core_module=(module_data['category'] == 'core'),
                service_priority=module_data['injection_order']
            )
            db.add(module)
        
        db.commit()
        db.refresh(preset)
        
        return preset

# Service instance
sillytavern_import_service = SillyTavernImportService()
