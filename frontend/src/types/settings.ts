// frontend/src/types/settings.ts

export interface UserSettingsData {
  id: string;
  user_id: string;
  theme?: string | null;
  language?: string | null;
  notifications_enabled?: boolean;
  active_persona_id?: string | null; // ID da persona ativa
  selected_llm_model?: string | null;
  primary_llm_api_key?: string | null;
  analysis_llm_api_key?: string | null;
  mistral_api_key?: string | null;
  generationPromptTemplate?: string | null;
  analysis_llm_model?: string | null;
  
  // New LiteLLM provider-based fields
  primary_llm_provider?: string | null;
  primary_llm_model?: string | null;
  primary_llm_api_key_new?: string | null;
  
  analysis_llm_provider?: string | null;
  analysis_llm_model_new?: string | null;
  analysis_llm_api_key_new?: string | null;
  
  maintenance_llm_provider?: string | null;
  maintenance_llm_model?: string | null;
  maintenance_llm_api_key?: string | null;
  
  embedding_llm_provider?: string | null;
  embedding_llm_model?: string | null;
  embedding_llm_api_key?: string | null;
}

export interface UserSettingsUpdateData {
  theme?: string | null;
  language?: string | null;
  notifications_enabled?: boolean;
  active_persona_id?: string | null;
  selected_llm_model?: string | null;
  primary_llm_api_key?: string | null;
  analysis_llm_api_key?: string | null;
  mistral_api_key?: string | null;
  generationPromptTemplate?: string | null;
  analysis_llm_model?: string | null;
  
  // New LiteLLM provider-based fields
  primary_llm_provider?: string | null;
  primary_llm_model?: string | null;
  primary_llm_api_key_new?: string | null;
  
  analysis_llm_provider?: string | null;
  analysis_llm_model_new?: string | null;
  analysis_llm_api_key_new?: string | null;
  
  maintenance_llm_provider?: string | null;
  maintenance_llm_model?: string | null;
  maintenance_llm_api_key?: string | null;
  
  embedding_llm_provider?: string | null;
  embedding_llm_model?: string | null;
  embedding_llm_api_key?: string | null;
}
