# LiteLLM Integration Plan

## Overview

This plan details the integration of LiteLLM as a unified interface for all LLM providers, replacing direct API calls to Mistral and OpenRouter while adding support for Google AI Studio. This will provide a consistent, scalable foundation for LLM interactions across the entire application.

**Architecture Correction**: This plan has been updated to reflect the actual 4-service LLM architecture currently implemented in the codebase, correcting previous references to a 5-service system.

## Current State Analysis

### Existing LLM Integrations
- **Mistral API:** Direct API calls for embeddings and chat completions
- **OpenRouter API:** Direct API calls for various LLM models
- **Provider-Specific Logic:** Separate handling for each provider's API format
- **Settings Configuration:** Individual API key fields for each provider

### Current Settings Structure
```typescript
interface UserSettingsUpdateData {
  selected_llm_model: string;
  primary_llm_api_key: string;
  analysis_llm_api_key: string;
  maintenance_llm_api_key: string;
  embedding_api_key: string;
  mistral_api_key: string;
  analysis_llm_model: string;
  maintenance_llm_model: string;
  embedding_model: string;
}
```

### Current 4-Service LLM Architecture
The system currently uses four distinct LLM services:
1. **Primary LLM (Generation Service)**: Main chat responses and content generation
2. **Analysis LLM**: Turn analysis and intent extraction (handles both analysis and knowledge extraction)
3. **Maintenance LLM**: Background tasks (note updates, entity creation, world simulation)  
4. **Embedding LLM**: Vector embeddings for RAG and semantic search

**Note**: The Analysis LLM service consolidates what was previously conceptualized as separate "extraction" and "analysis" functions. The current backend code uses `analysis_llm_api_key` and `analysis_llm_model` parameters throughout.

## Proposed Architecture

### LiteLLM Unified Interface

#### Provider Configuration
```python
# Backend LiteLLM Configuration
SUPPORTED_PROVIDERS = {
    "openrouter": {
        "name": "OpenRouter",
        "api_base": "https://openrouter.ai/api/v1",
        "api_key_env": "OPENROUTER_API_KEY",
        "models_endpoint": "/models"
    },
    "mistral": {
        "name": "Mistral",
        "api_base": "https://api.mistral.ai/v1", 
        "api_key_env": "MISTRAL_API_KEY",
        "models_endpoint": "/models"
    },
    "google": {
        "name": "Google AI Studio",
        "api_base": "https://generativelanguage.googleapis.com/v1beta",
        "api_key_env": "GOOGLE_API_KEY",
        "models_endpoint": "/models"
    }
}
```

#### Enhanced Settings Schema
```typescript
interface LLMProviderConfig {
  provider: string;
  model: string;
  api_key: string;
}

interface EnhancedUserSettings {
  // Primary LLM Configuration
  primary_llm: LLMProviderConfig;
  
  // Specialized LLM Configurations  
  analysis_llm: LLMProviderConfig;
  maintenance_llm: LLMProviderConfig;
  
  // Embedding Configuration
  embedding_llm: LLMProviderConfig;
}
```

## Implementation Plan

### Phase 1: Backend LiteLLM Integration (1 week)

#### 1.1 Install and Configure LiteLLM
- [ ] Add LiteLLM to requirements.txt
- [ ] Create LiteLLM service wrapper
- [ ] Configure provider mappings
- [ ] Set up environment variables

#### 1.2 Create Unified LLM Service
```python
# services/litellm_service.py
class LiteLLMService:
    def __init__(self):
        self.supported_providers = SUPPORTED_PROVIDERS
    
    async def get_completion(self, provider: str, model: str, messages: list, **kwargs):
        """Unified completion interface for all providers"""
        pass
    
    async def get_embedding(self, provider: str, model: str, text: str):
        """Unified embedding interface for all providers"""
        pass
    
    async def get_available_models(self, provider: str, api_key: str):
        """Get available models for a specific provider"""
        pass
    
    async def get_service_completion(self, service_type: str, messages: list, **kwargs):
        """Get completion for specific service (primary, analysis, maintenance, embedding)"""
        # Load service configuration from user settings
        config = await self.get_service_config(service_type)
        return await self.get_completion(
            config.provider, 
            config.model, 
            messages, 
            api_key=config.api_key,
            **kwargs
        )
```

#### 1.3 Replace Existing API Calls
- [ ] Replace Primary LLM chat completions (Generation Service)
- [ ] Replace Analysis LLM completions (handles both analysis and knowledge extraction)
- [ ] Replace Maintenance LLM completions
- [ ] Replace Embedding API calls
- [ ] Replace legacy Mistral/OpenRouter direct calls
- [ ] Update error handling to use LiteLLM exceptions

### Phase 2: Database Schema Updates (2-3 days)

#### 2.1 Update User Settings Model
```sql
-- Migration to update user_settings table
ALTER TABLE user_settings 
ADD COLUMN primary_llm_provider VARCHAR(50),
ADD COLUMN primary_llm_model VARCHAR(100),
ADD COLUMN primary_llm_api_key TEXT,

ADD COLUMN analysis_llm_provider VARCHAR(50),
ADD COLUMN analysis_llm_model VARCHAR(100),
ADD COLUMN analysis_llm_api_key TEXT,

ADD COLUMN maintenance_llm_provider VARCHAR(50),
ADD COLUMN maintenance_llm_model VARCHAR(100),
ADD COLUMN maintenance_llm_api_key TEXT,

ADD COLUMN embedding_llm_provider VARCHAR(50),
ADD COLUMN embedding_llm_model VARCHAR(100),
ADD COLUMN embedding_llm_api_key TEXT;

-- Migrate existing data
UPDATE user_settings 
SET primary_llm_provider = 'openrouter',
    primary_llm_model = selected_llm_model,
    primary_llm_api_key = primary_llm_api_key,
    analysis_llm_provider = 'openrouter',
    analysis_llm_model = analysis_llm_model,
    analysis_llm_api_key = analysis_llm_api_key
WHERE selected_llm_model IS NOT NULL;

-- Drop old columns after migration verification
-- ALTER TABLE user_settings DROP COLUMN selected_llm_model;
-- ALTER TABLE user_settings DROP COLUMN mistral_api_key;
```

#### 2.2 Update Pydantic Schemas
```python
# schemas/user_settings.py
class LLMConfigSchema(BaseModel):
    provider: str
    model: str
    api_key: str

class UserSettingsUpdateData(BaseModel):
    primary_llm: Optional[LLMConfigSchema] = None
    analysis_llm: Optional[LLMConfigSchema] = None
    maintenance_llm: Optional[LLMConfigSchema] = None
    embedding_llm: Optional[LLMConfigSchema] = None
```

### Phase 3: Frontend Settings UI Enhancement (1 week)

#### 3.1 Enhanced Settings Page Component
```typescript
// New provider-based settings interface
interface ProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
}

interface EnhancedSettings {
  primaryLLM: ProviderConfig;
  analysisLLM: ProviderConfig;
  maintenanceLLM: ProviderConfig;
  embeddingLLM: ProviderConfig;
}
```

#### 3.2 Provider Selection Flow
1. **Provider Dropdown:** User selects provider (OpenRouter, Mistral, Google AI Studio)
2. **Model Dropdown:** Dynamically populated based on selected provider
3. **API Key Field:** Provider-specific API key input
4. **Service Assignment:** Configure which service uses which provider/model:
   - **Primary LLM:** Main chat responses (Generation Service)
   - **Analysis LLM:** Turn analysis and intent extraction (handles both analysis and knowledge extraction)
   - **Maintenance LLM:** Background tasks (note updates, entity creation, world simulation)
   - **Embedding LLM:** Vector embeddings for RAG
5. **Validation:** Real-time validation of API key and model availability

#### 3.3 Enhanced UI Components
- [ ] Provider selector component with service assignment
- [ ] Dynamic model dropdown component
- [ ] API key validation component
- [ ] Provider-specific help text
- [ ] Service role explanation (Primary, Analysis, Maintenance, Embedding)
- [ ] Cost estimation per service type

### Phase 4: API Endpoints Updates (2-3 days)

#### 4.1 Enhanced Models Endpoint
```python
# routers/llm_providers.py
@router.get("/models/{provider}")
async def get_provider_models(provider: str, api_key: str):
    """Get available models for specific provider"""
    litellm_service = LiteLLMService()
    return await litellm_service.get_available_models(provider, api_key)

@router.get("/providers")
async def get_supported_providers():
    """Get list of supported providers"""
    return list(SUPPORTED_PROVIDERS.keys())
```

#### 4.2 Settings API Updates
- [ ] Update settings CRUD to handle new schema
- [ ] Add validation for provider configurations
- [ ] Maintain backward compatibility during migration

### Phase 5: Testing and Migration (3-4 days)

#### 5.1 Migration Strategy
- [ ] Create data migration scripts
- [ ] Implement feature flags for gradual rollout
- [ ] Add fallback mechanisms for existing configurations

#### 5.2 Testing Plan
- [ ] Unit tests for LiteLLM service
- [ ] Integration tests for each provider
- [ ] End-to-end tests for settings flow
- [ ] Performance testing for API response times

## Provider-Specific Configuration

### Google AI Studio Integration
```python
# Google AI Studio specific configuration
GOOGLE_AI_MODELS = [
    "gemini-1.5-pro",
    "gemini-1.5-flash", 
    "gemini-1.0-pro",
    "text-embedding-004"
]

# LiteLLM format for Google AI Studio
def format_google_request(model: str, messages: list):
    return {
        "model": f"google/{model}",
        "messages": messages,
        "api_key": os.getenv("GOOGLE_API_KEY")
    }
```

### OpenRouter Enhanced Integration
```python
# Enhanced OpenRouter configuration
def format_openrouter_request(model: str, messages: list):
    return {
        "model": f"openrouter/{model}",
        "messages": messages,
        "api_key": os.getenv("OPENROUTER_API_KEY"),
        "headers": {
            "HTTP-Referer": "https://your-app.com",
            "X-Title": "Argon AI"
        }
    }
```

### Mistral Enhanced Integration
```python
# Enhanced Mistral configuration
def format_mistral_request(model: str, messages: list):
    return {
        "model": f"mistral/{model}",
        "messages": messages,
        "api_key": os.getenv("MISTRAL_API_KEY")
    }
```

## Error Handling and Validation

### Provider Validation
```python
class ProviderValidator:
    async def validate_api_key(self, provider: str, api_key: str) -> bool:
        """Validate API key for specific provider"""
        try:
            await litellm.acompletion(
                model=f"{provider}/test-model",
                messages=[{"role": "user", "content": "test"}],
                api_key=api_key,
                max_tokens=1
            )
            return True
        except Exception:
            return False
    
    async def validate_model_availability(self, provider: str, model: str, api_key: str) -> bool:
        """Check if model is available for provider"""
        available_models = await self.get_available_models(provider, api_key)
        return model in [m.id for m in available_models]
```

### Enhanced Error Messages
```python
PROVIDER_ERROR_MESSAGES = {
    "openrouter": {
        "invalid_key": "Invalid OpenRouter API key. Please check your key in the OpenRouter dashboard.",
        "model_not_found": "Model not available in OpenRouter. Please select a different model.",
        "rate_limit": "OpenRouter rate limit exceeded. Please try again later."
    },
    "mistral": {
        "invalid_key": "Invalid Mistral API key. Please verify your key in the Mistral console.",
        "model_not_found": "Model not available in Mistral. Please select a different model.",
        "rate_limit": "Mistral rate limit exceeded. Please try again later."
    },
    "google": {
        "invalid_key": "Invalid Google AI Studio API key. Please check your Google Cloud console.",
        "model_not_found": "Model not available in Google AI Studio. Please select a different model.",
        "rate_limit": "Google AI Studio quota exceeded. Please check your usage limits."
    }
}
```

## Configuration Management

### Environment Variables
```bash
# .env configuration
OPENROUTER_API_KEY=your_openrouter_key
MISTRAL_API_KEY=your_mistral_key
GOOGLE_API_KEY=your_google_ai_key

# LiteLLM specific settings
LITELLM_LOG_LEVEL=INFO
LITELLM_DROP_PARAMS=true
LITELLM_MAX_BUDGET=100
```

### Settings Validation
```python
class LLMSettingsValidator:
    def validate_configuration(self, config: LLMConfigSchema) -> bool:
        """Validate LLM configuration"""
        if config.provider not in SUPPORTED_PROVIDERS:
            raise ValueError(f"Unsupported provider: {config.provider}")
        
        if not config.api_key:
            raise ValueError("API key is required")
        
        if not config.model:
            raise ValueError("Model selection is required")
        
        return True
```

## Migration Timeline

### Week 1: Backend Foundation
- **Days 1-2:** LiteLLM installation and basic service setup
- **Days 3-4:** Replace Mistral API calls
- **Days 5-7:** Replace OpenRouter API calls and add Google AI Studio

### Week 2: Database and API Updates  
- **Days 1-2:** Database schema migration
- **Days 3-4:** Update API endpoints
- **Days 5-7:** Enhanced error handling and validation

### Week 3: Frontend Enhancement
- **Days 1-3:** Settings page UI overhaul
- **Days 4-5:** Provider selection and model dropdown implementation
- **Days 6-7:** Testing and bug fixes

## Success Metrics

### Technical Metrics
- All LLM API calls routed through LiteLLM
- Response time parity with direct API calls
- 100% backward compatibility during migration
- Zero downtime deployment

### User Experience Metrics
- Improved settings page usability
- Consistent error messaging across providers
- Easy provider switching capability
- Reduced configuration complexity

### Quality Metrics
- Comprehensive test coverage (>90%)
- Successful integration with all four LLM services
- Robust error handling and recovery
- Clear documentation for future provider additions

## Future Enhancements

### Additional Providers
- **Anthropic Claude:** Easy addition via LiteLLM
- **OpenAI:** Direct integration support
- **Azure OpenAI:** Enterprise integration
- **Local Models:** Ollama integration

### Advanced Features
- **Cost Tracking:** Per-provider usage monitoring
- **Load Balancing:** Automatic failover between providers
- **Model Recommendations:** AI-powered model suggestions
- **Batch Processing:** Efficient bulk operations

---

*Document created on: June 7, 2025*
*Status: Planning - Ready for Implementation*
