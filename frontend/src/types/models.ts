export interface ScenarioCard {
  id: string;
  scenario_name: string;
  scenario_description: string;
  beginning_message: string;
  world_lore_references: string[];
}

export interface CharacterCard {
  id: string;
  character_name: string;
  character_description: string;
  dialogue_examples: string[];
  beginning_message: string | null;
  world_lore_references: string[];
}

export interface GlobalLoreEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

export interface UserSettings {
  openrouter_api_key: string;
  selected_llm_model: string;
}

export interface ChatInput {
  chat_id: string;
  user_input: string;
  current_scene_time?: string;
  current_scene_location?: string;
  current_scene_context?: string;
}

export interface ChatResponse {
  ai_response: string;
  chat_id: string;
}

export interface NewChatRequest {
  scenario_id?: string;
  gm_character_id?: string;
  user_character_id: string;
}

export interface NewChatResponse {
  chat_id: string;
  beginning_message: string;
}
