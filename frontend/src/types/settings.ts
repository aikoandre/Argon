// frontend/src/types/settings.ts

export interface UserSettingsData {
  id: string;
  user_id: string;
  theme?: string | null;
  language?: string | null;
  notifications_enabled?: boolean;
  active_persona_id?: string | null; // ID da persona ativa
  
  // Legacy fields (keep for backward compatibility)
  selected_llm_model?: string | null;
  primary_llm_api_key?: string | null;
  analysis_llm_api_key?: string | null;
  mistral_api_key?: string | null;
  generationPromptTemplate?: string | null;
  analysis_llm_model?: string | null;
  
  // Simplified LLM configuration - only Primary LLM settings needed
  primary_llm_provider?: string | null;
  primary_llm_model?: string | null;
  primary_llm_api_key_new?: string | null;
  
  // Simple feature toggles for Analysis and Maintenance (use Primary LLM key when enabled)
  analysis_enabled?: boolean;
  maintenance_enabled?: boolean;
  
  // Embedding configuration (requires separate API key due to rate limiting)
  embedding_enabled?: boolean;
  embedding_llm_provider?: string | null;
  embedding_llm_model?: string | null;
  embedding_llm_api_key?: string | null;
  
  // Primary LLM parameters
  primary_llm_temperature?: number;
  primary_llm_top_p?: number;
  primary_llm_max_tokens?: number;
  primary_llm_reasoning_effort?: string | null;
  primary_llm_custom_prompt?: string | null;
  
  // Context and token management
  max_messages_for_context?: number;
  max_response_tokens?: number;
  context_size?: number;
  max_lore_entries_for_rag?: number;
  
  // Analysis LLM parameters (separate from Primary)
  analysis_llm_temperature?: number;
  analysis_llm_top_p?: number;
  analysis_llm_max_tokens?: number;
  analysis_llm_reasoning_effort?: string | null;
  analysis_llm_custom_prompt?: string | null;
  
  // Maintenance LLM parameters (separate from Primary)
  maintenance_llm_temperature?: number;
  maintenance_llm_top_p?: number;
  maintenance_llm_max_tokens?: number;
  maintenance_llm_reasoning_effort?: string | null;
  maintenance_llm_custom_prompt?: string | null;
}

export interface UserSettingsUpdateData {
  theme?: string | null;
  language?: string | null;
  notifications_enabled?: boolean;
  active_persona_id?: string | null;
  
  // Legacy fields (keep for backward compatibility)
  selected_llm_model?: string | null;
  primary_llm_api_key?: string | null;
  analysis_llm_api_key?: string | null;
  mistral_api_key?: string | null;
  generationPromptTemplate?: string | null;
  analysis_llm_model?: string | null;
  
  // Simplified LLM configuration - only Primary LLM settings needed
  primary_llm_provider?: string | null;
  primary_llm_model?: string | null;
  primary_llm_api_key_new?: string | null;
  
  // Simple feature toggles for Analysis and Maintenance (use Primary LLM key when enabled)
  analysis_enabled?: boolean;
  maintenance_enabled?: boolean;
  
  // Embedding configuration (requires separate API key due to rate limiting)
  embedding_enabled?: boolean;
  embedding_llm_provider?: string | null;
  embedding_llm_model?: string | null;
  embedding_llm_api_key?: string | null;
  
  // Primary LLM parameters
  primary_llm_temperature?: number;
  primary_llm_top_p?: number;
  primary_llm_max_tokens?: number;
  primary_llm_reasoning_effort?: string | null;
  primary_llm_custom_prompt?: string | null;
  
  // Context and token management
  max_messages_for_context?: number;
  max_response_tokens?: number;
  context_size?: number;
  max_lore_entries_for_rag?: number;
  
  // Analysis LLM parameters (separate from Primary)
  analysis_llm_temperature?: number;
  analysis_llm_top_p?: number;
  analysis_llm_max_tokens?: number;
  analysis_llm_reasoning_effort?: string | null;
  analysis_llm_custom_prompt?: string | null;
  
  // Maintenance LLM parameters (separate from Primary)
  maintenance_llm_temperature?: number;
  maintenance_llm_top_p?: number;
  maintenance_llm_max_tokens?: number;
  maintenance_llm_reasoning_effort?: string | null;
  maintenance_llm_custom_prompt?: string | null;
}
