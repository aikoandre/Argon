// frontend/src/types/settings.ts
export interface UserSettingsData {
  id: number;
  selected_llm_model: string | null;
  openrouter_api_key: string | null;
  // Adicione os outros campos aqui
}

export interface UserSettingsUpdateData {
  selected_llm_model?: string | null;
  openrouter_api_key?: string | null;
  // Adicione os outros campos aqui
}
