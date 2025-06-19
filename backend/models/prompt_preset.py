# backend/models/prompt_preset.py
from sqlalchemy import Column, String, Text, Boolean, Integer, Float, DateTime, func, ForeignKey
from sqlalchemy.orm import relationship
from db.database import Base

class PromptPreset(Base):
    __tablename__ = "prompt_presets"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_sillytavern_compatible = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship to modules
    modules = relationship("PromptModule", back_populates="preset", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<PromptPreset(id={self.id}, name={self.name})>"

class PromptModule(Base):
    __tablename__ = "prompt_modules"
    
    id = Column(String, primary_key=True, index=True)
    preset_id = Column(String, ForeignKey('prompt_presets.id'), nullable=False)
    identifier = Column(String, nullable=False)  # SillyTavern compatibility
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # 'core', 'style', 'stance', 'utility'
    content = Column(Text, nullable=False)
    enabled = Column(Boolean, default=True)
    
    # SillyTavern compatibility fields
    injection_position = Column(Integer, default=0)
    injection_depth = Column(Integer, default=4)
    injection_order = Column(Integer, default=0)
    forbid_overrides = Column(Boolean, default=False)
    role = Column(String, default="system")  # 'system', 'user', 'assistant'
    
    # Argon service-specific fields
    applicable_services = Column(Text, nullable=True)  # JSON array: ['generation', 'analysis', 'maintenance', 'embedding']
    is_core_module = Column(Boolean, default=False)  # Core modules can't be disabled
    service_priority = Column(Integer, default=0)  # Module ordering within services
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship to preset
    preset = relationship("PromptPreset", back_populates="modules")
    
    def __repr__(self):
        return f"<PromptModule(id={self.id}, name={self.name}, enabled={self.enabled})>"

class UserPromptConfiguration(Base):
    __tablename__ = "user_prompt_configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, default=1)  # For now, single user system
    active_preset_id = Column(String, ForeignKey('prompt_presets.id'), nullable=True)
      # Core LLM Parameters
    temperature = Column(Float, default=1.0)
    top_p = Column(Float, default=1.0)
    top_k = Column(Integer, nullable=True)  # Top-K sampling
    top_a = Column(Float, nullable=True)  # Top-A sampling
    min_p = Column(Float, nullable=True)  # Min-P sampling
    max_tokens = Column(Integer, nullable=True)
    
    # Penalty Parameters
    frequency_penalty = Column(Float, default=0.0)
    presence_penalty = Column(Float, default=0.0)
    repetition_penalty = Column(Float, default=1.0)
      # Advanced Parameters
    reasoning_effort = Column(String, default="Medium")  # For reasoning models
    
    # Context Management
    context_size = Column(Integer, default=20)  # Number of messages to include in context (default: 20)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship to active preset
    active_preset = relationship("PromptPreset")
    
    def __repr__(self):
        return f"<UserPromptConfiguration(id={self.id}, preset={self.active_preset_id})>"
