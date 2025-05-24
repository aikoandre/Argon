from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey
from backend.database import Base

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, default=1) # Assuming a single global settings row

    # LLM Configuration
    llm_provider = Column(String, nullable=True, default="OpenRouter")
    selected_llm_model = Column(String, nullable=True, default="gpt-4o") # Or your preferred default

    # API Key - Stored in plaintext as per user decision
    llm_api_key = Column(String, nullable=True) # Changed from encrypted_llm_api_key, type is String

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

    # LLM Generation Parameters
    temperature = Column(Float, nullable=True, default=1.0)
    top_p = Column(Float, nullable=True, default=1.0)
    max_response_tokens = Column(Integer, nullable=True, default=2048)
    context_size = Column(Integer, nullable=True, default=164000) # Number of history messages or context tokens

    # Active User Persona
    active_persona_id = Column(String, ForeignKey("user_personas.id", ondelete="SET NULL"), nullable=True)
    # If you want easy access to the UserPersona object from settings:
    # active_user_persona = relationship("UserPersona")

    def __repr__(self):
        return f"<UserSettings(id={self.id}, llm_provider='{self.llm_provider}', model='{self.selected_llm_model}')>"
