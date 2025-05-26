from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey
from backend.database import Base

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, default=1) # Assuming a single global settings row

    # LLM Configuration
    llm_provider = Column(String, nullable=True, default="OpenRouter")
    selected_llm_model = Column(String, nullable=True, default="gpt-4o") # Or your preferred default

    # API Key - Stored in plaintext as per user decision
    primary_llm_api_key = Column(String, nullable=True)
    planning_llm_api_key = Column(String, nullable=True)
    extraction_llm_api_key = Column(String, nullable=True)
    analysis_llm_api_key = Column(String, nullable=True)
    mistral_api_key = Column(String, nullable=True)
    extraction_llm_model = Column(String, nullable=True, default="mistral/mistral-large-latest")
    planning_llm_model = Column(String, nullable=True, default="deepseek-ai/deepseek-coder-v2-instruct")
    analysis_llm_model = Column(String, nullable=True, default="mistral/mistral-large-latest")

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
        "lore modifications, and user persona updates. Output a JSON object according to the schema."
        "\n\nUser Message: {{user_message}}\nAI Response: {{ai_response}}\n\n"
        "Relevant Lore (from RAG):{% for lore in reranked_lore_entries %}\n- {{lore.text}}{% endfor %}"
        "\n\nAI Plan (if available): {{ai_plan | tojson}}"
        "\n\nOutput JSON strictly following this schema:\n"
        "{'new_facts_established': [{'text': 'string', 'relevance_score': float, 'tags': ['string']}], "
        "'relationship_changes': [{'character_pair': ['string', 'string'], 'change_type': 'string', 'new_value': any, 'reason': 'string'}], "
        "'session_lore_updates': [{'base_lore_entry_id': 'string', 'field_to_update': 'string', 'new_content_segment': 'string', 'change_reason': 'string'}], "
        "'user_persona_session_updates': [{'attribute': 'string', 'new_value': any, 'reason': 'string'}], "
        "'triggered_event_ids': ['string'], "
        "'dynamically_generated_npcs': [{'npc_name': 'string', 'description_notes': 'string', 'should_create_lore_entry': bool, 'suggested_entry_type': 'string'}], "
        "'panel_data_update': {'current_time': 'string', 'current_date': 'string', 'current_location': 'string'}}"
    ))

    # LLM Generation Parameters
    temperature = Column(Float, nullable=True, default=1.0)
    top_p = Column(Float, nullable=True, default=1.0)
    max_response_tokens = Column(Integer, nullable=True, default=2048)
    context_size = Column(Integer, nullable=True, default=164000) # Number of history messages or context tokens
    max_messages_for_context = Column(Integer, nullable=True, default=20) # Max number of messages to include in LLM context
    max_lore_entries_for_rag = Column(Integer, nullable=True, default=3) # Max number of lore entries to include after reranking

    # Active User Persona
    active_persona_id = Column(String, ForeignKey("user_personas.id", ondelete="SET NULL"), nullable=True)
    # If you want easy access to the UserPersona object from settings:
    # active_user_persona = relationship("UserPersona")

    def __repr__(self):
        return f"<UserSettings(id={self.id}, llm_provider='{self.llm_provider}', model='{self.selected_llm_model}')>"
