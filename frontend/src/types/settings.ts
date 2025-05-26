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
  planning_llm_api_key?: string | null;
  extraction_llm_api_key?: string | null;
  analysis_llm_api_key?: string | null;
  mistral_api_key?: string | null;
  generationPromptTemplate?: string | null;
  extraction_llm_model?: string | null;
  planning_llm_model?: string | null;
  analysis_llm_model?: string | null;
}

export interface UserSettingsUpdateData {
  theme?: string | null;
  language?: string | null;
  notifications_enabled?: boolean;
  active_persona_id?: string | null;
  selected_llm_model?: string | null;
  primary_llm_api_key?: string | null;
  planning_llm_api_key?: string | null;
  extraction_llm_api_key?: string | null;
  analysis_llm_api_key?: string | null;
  mistral_api_key?: string | null;
  generationPromptTemplate?: string | null;
  extraction_llm_model?: string | null;
  planning_llm_model?: string | null;
  analysis_llm_model?: string | null;
}
