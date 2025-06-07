from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, Boolean
from backend.database import Base

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, default=1) # Assuming a single global settings row    # LLM Configuration (Legacy)
    llm_provider = Column(String, nullable=True, default="openrouter")
    selected_llm_model = Column(String, nullable=True, default="gpt-4o")

    # API Keys (Legacy)
    primary_llm_api_key = Column(String, nullable=True)
    extraction_llm_api_key = Column(String, nullable=True)
    analysis_llm_api_key = Column(String, nullable=True)
    mistral_api_key = Column(String, nullable=True)
    extraction_llm_model = Column(String, nullable=True, default="mistral/mistral-large-latest")
    analysis_llm_model = Column(String, nullable=True, default="mistral/mistral-large-latest")

    # New LiteLLM Provider Configurations
    # Primary LLM (Generation Service)
    primary_llm_provider = Column(String, nullable=True, default="openrouter")
    primary_llm_model = Column(String, nullable=True, default="gpt-4o")
    primary_llm_api_key_new = Column(String, nullable=True)
    
    # Analysis LLM (Analysis & Knowledge Extraction)
    analysis_llm_provider = Column(String, nullable=True, default="openrouter")
    analysis_llm_model_new = Column(String, nullable=True, default="gpt-4o")
    analysis_llm_api_key_new = Column(String, nullable=True)
    
    # Maintenance LLM (Background Tasks)
    maintenance_llm_provider = Column(String, nullable=True, default="openrouter")
    maintenance_llm_model = Column(String, nullable=True, default="gpt-4o")
    maintenance_llm_api_key = Column(String, nullable=True)
    
    # Embedding LLM (Vector Embeddings)
    embedding_llm_provider = Column(String, nullable=True, default="mistral")
    embedding_llm_model = Column(String, nullable=True, default="mistral-embed")
    embedding_llm_api_key = Column(String, nullable=True)

    # Prompt Configuration
    generation_prompt_template = Column(Text, nullable=True, default=(
        "You are {{ai_instructions.name}}, {{ai_instructions.description}}. "
        "Your instructions on how to act are: {{ai_instructions.instructions}}."
        "Examples of how you speak: {{ai_instructions.example_dialogues}}."
        "Initial message (if applicable): {{ai_instructions.beginning_message}}"
        "You are interacting with {{user_persona_details.name}}, who is: {{user_persona_details.description}}."
        "World Context (if applicable): {{world_context_name_and_description}}"
        "--- Recent Chat History ---"
        "{{chat_history}}"
        "--- End of History ---"
        "{{user_persona_details.name}}: {{user_input}}{{ai_instructions.name}}:"
    ))
    language = Column(String, nullable=True, default="English") # Or "English" if you prefer
    interaction_analysis_prompt_template = Column(Text, nullable=True, default=(
        "You are an expert interaction analyst. Your task is to extract structured information "
        "from the provided conversation turn, focusing on new facts, relationship changes, "
        "lore modifications, and user persona updates. Output a JSON object according to the schema.\n"
        "\nUser Message: {{user_message}}\n"
        "AI Response: {{ai_response}}\n"
        "Relevant Lore (from RAG):{% for lore in reranked_lore_entries %}\n- {{lore.text}}{% endfor %}\n"
        "AI Plan (if available): {{ai_plan | tojson}}\n"
        "Current Relationship State (if available): {{current_relationship_state | tojson}}\n"
        "\nOutput JSON strictly following this schema (do not invent fields, do not omit required fields):\n"
        "{\n"
        "  'new_facts_established': [\n"
        "    {'text': 'string', 'relevance_score': float, 'tags': ['string']}\n"
        "  ],\n"
        "  'relationship_changes': [\n"
        "    {\n"
        "      'between_entities': ['ENTITY_ID_OR_NAME_1', 'ENTITY_ID_OR_NAME_2'],\n"
        "      'dimension_changed': 'dimension_name (e.g., trust_score, affection_score, rivalry_score)',\n"
        "      'change_value': 'change_description (e.g., +15, -5, significant_increase, slight_decrease)',\n"
        "      'new_status_tags_add': ['descriptive_tag_1', 'descriptive_tag_2'],\n"
        "      'new_status_tags_remove': ['tag_to_be_removed'],\n"
        "      'reason_summary': 'brief justification'\n"
        "    }\n"
        "  ],\n"
        "  'session_lore_updates': [\n"
        "    {'base_lore_entry_id': 'string', 'field_to_update': 'string', 'new_content_segment': 'string', 'change_reason': 'string'}\n"
        "  ],\n"
        "  'user_persona_session_updates': [\n"
        "    {'attribute': 'string', 'new_value': any, 'reason': 'string'}\n"
        "  ],\n"
        "  'triggered_event_ids': ['string'],\n"
        "  'dynamically_generated_npcs': [\n"
        "    {'npc_name': 'string', 'description_notes': 'string', 'should_create_lore_entry': bool, 'suggested_entry_type': 'string'}\n"
        "  ],\n"
        "  'panel_data_update': {'current_time': 'string', 'current_date': 'string', 'current_location': 'string'}\n"
        "}\n"
        "If no significant relationship change is detected, return an empty list for 'relationship_changes'.\n"
        "Do not return any fields not present in the schema above."
    ))

    # LLM Generation Parameters
    temperature = Column(Float, nullable=True, default=1.0)
    top_p = Column(Float, nullable=True, default=1.0)
    max_response_tokens = Column(Integer, nullable=True, default=2048)
    context_size = Column(Integer, nullable=True, default=164000) # Number of history messages or context tokens
    max_messages_for_context = Column(Integer, nullable=True, default=20) # Max number of messages to include in LLM context
    max_lore_entries_for_rag = Column(Integer, nullable=True, default=3) # Max number of lore entries to include after reranking

    # Panel Configuration
    display_in_message_panel = Column(Boolean, nullable=False, default=False) # Whether to display the panel in the AI's message

    # Active User Persona
    active_persona_id = Column(String, ForeignKey("user_personas.id", ondelete="SET NULL"), nullable=True)
    # If you want easy access to the UserPersona object from settings:
    # active_user_persona = relationship("UserPersona")

    def __repr__(self):
        return f"<UserSettings(id={self.id}, llm_provider='{self.llm_provider}', model='{self.selected_llm_model}')>"
