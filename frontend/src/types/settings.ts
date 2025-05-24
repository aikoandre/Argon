// frontend/src/types/settings.ts

export interface UserSettingsData {
  id: string;
  user_id: string;
  theme?: string | null;
  language?: string | null;
  notifications_enabled?: boolean;
  active_persona_id?: string | null; // ID da persona ativa
  selected_llm_model?: string | null;
  llm_api_key?: string | null;
  // Add more fields as needed to match your backend
}

export interface UserSettingsUpdateData {
  theme?: string | null;
  language?: string | null;
  notifications_enabled?: boolean;
  active_persona_id?: string | null; // ID da persona ativa
  selected_llm_model?: string | null;
  llm_api_key?: string | null;
  // Add more fields as needed to match your backend
}
