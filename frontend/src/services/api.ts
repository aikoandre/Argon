// frontend/src/services/api.ts
import axios from "axios";
import type {
  UserSettingsData,
  UserSettingsUpdateData,
} from "../types/settings"; // Supondo que types/settings.ts existe e define estes

const apiClient = axios.create({
  baseURL: "http://localhost:8000/api", // URL do seu backend FastAPI
  headers: {
    "Content-Type": "application/json",
  },
});

// --- Health Check ---
export const getApiHealth = async () => {
  try {
    const response = await apiClient.get("/health");
    return response.data;
  } catch (error) {
    console.error("Error fetching API health:", error);
    throw error;
  }
};

// --- User Settings ---
export const getUserSettings = async (): Promise<UserSettingsData | null> => {
  try {
    const response = await apiClient.get<UserSettingsData>("/settings");
    return response.data;
  } catch (error) {
    console.error("Error fetching user settings:", error);
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const updateUserSettings = async (
  settingsData: UserSettingsUpdateData
): Promise<UserSettingsData> => {
  try {
    const response = await apiClient.put<UserSettingsData>(
      "/settings",
      settingsData
    );
    return response.data;
  } catch (error) {
    console.error("Error updating user settings:", error);
    throw error;
  }
};

// --- LLM Models ---
export interface LLMModelData {
  id: string;
  name?: string;
}

export const getLLMModels = async (): Promise<LLMModelData[]> => {
  try {
    const response = await apiClient.get<LLMModelData[]>("/llm/models");
    return response.data;
  } catch (error) {
    console.error("Error fetching LLM models:", error);
    throw error;
  }
};

// --- User Persona ---
export interface UserPersonaData {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface UserPersonaCreateData {
  name: string;
  description?: string | null;
}

export interface UserPersonaUpdateData {
  name?: string;
  description?: string | null;
}

export const createUserPersona = async (
  personaData: UserPersonaCreateData
): Promise<UserPersonaData> => {
  try {
    const response = await apiClient.post<UserPersonaData>(
      "/personas",
      personaData
    );
    return response.data;
  } catch (error) {
    console.error("Error creating user persona:", error);
    throw error;
  }
};

export const getAllUserPersonas = async (): Promise<UserPersonaData[]> => {
  try {
    const response = await apiClient.get<UserPersonaData[]>("/personas");
    return response.data;
  } catch (error) {
    console.error("Error fetching user personas:", error);
    throw error;
  }
};

export const getUserPersonaById = async (
  personaId: string
): Promise<UserPersonaData> => {
  try {
    const response = await apiClient.get<UserPersonaData>(
      `/personas/${personaId}`
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching user persona ${personaId}:`, error);
    throw error;
  }
};

export const updateUserPersona = async (
  personaId: string,
  personaData: UserPersonaUpdateData
): Promise<UserPersonaData> => {
  try {
    const response = await apiClient.put<UserPersonaData>(
      `/personas/${personaId}`,
      personaData
    );
    return response.data;
  } catch (error) {
    console.error(`Error updating user persona ${personaId}:`, error);
    throw error;
  }
};

export const deleteUserPersona = async (personaId: string): Promise<void> => {
  try {
    await apiClient.delete(`/personas/${personaId}`);
  } catch (error) {
    console.error(`Error deleting user persona ${personaId}:`, error);
    throw error;
  }
};

// --- Character Cards (NPCs/GM) ---
export interface CharacterCardData {
  id: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  example_dialogues?: Record<string, any>[] | string[] | null; // Ajuste conforme seu schema
  beginning_message?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface CharacterCardCreateData {
  name: string;
  description?: string | null;
  instructions?: string | null;
  example_dialogues?: Record<string, any>[] | string[] | null;
  beginning_message?: string | null;
}

export interface CharacterCardUpdateData {
  name?: string;
  description?: string | null;
  instructions?: string | null;
  example_dialogues?: Record<string, any>[] | string[] | null;
  beginning_message?: string | null;
}

export const createCharacterCard = async (
  characterData: CharacterCardCreateData
): Promise<CharacterCardData> => {
  const response = await apiClient.post<CharacterCardData>(
    "/characters",
    characterData
  );
  return response.data;
};

export const getAllCharacterCards = async (): Promise<CharacterCardData[]> => {
  const response = await apiClient.get<CharacterCardData[]>("/characters");
  return response.data;
};

export const getCharacterCardById = async (
  characterId: string
): Promise<CharacterCardData> => {
  const response = await apiClient.get<CharacterCardData>(
    `/characters/${characterId}`
  );
  return response.data;
};

export const updateCharacterCard = async (
  characterId: string,
  characterData: CharacterCardUpdateData
): Promise<CharacterCardData> => {
  const response = await apiClient.put<CharacterCardData>(
    `/characters/${characterId}`,
    characterData
  );
  return response.data;
};

export const deleteCharacterCard = async (
  characterId: string
): Promise<void> => {
  await apiClient.delete(`/characters/${characterId}`);
};

// --- Scenario Cards ---
export interface ScenarioCardData {
  id: string;
  name: string;
  description?: string | null;
  beginning_message?: string | null;
  world_card_references?: Record<string, any> | null; // Ajuste conforme seu schema
  created_at: string;
  updated_at?: string | null;
}
export interface ScenarioCardCreateData {
  name: string;
  description?: string | null;
  beginning_message?: string | null;
  world_card_references?: Record<string, any> | null;
}
export interface ScenarioCardUpdateData {
  name?: string;
  description?: string | null;
  beginning_message?: string | null;
  world_card_references?: Record<string, any> | null;
}

export const createScenarioCard = async (
  scenarioData: ScenarioCardCreateData
): Promise<ScenarioCardData> => {
  const response = await apiClient.post<ScenarioCardData>(
    "/scenarios",
    scenarioData
  );
  return response.data;
};

export const getAllScenarioCards = async (): Promise<ScenarioCardData[]> => {
  const response = await apiClient.get<ScenarioCardData[]>("/scenarios");
  return response.data;
};

export const getScenarioCardById = async (
  scenarioId: string
): Promise<ScenarioCardData> => {
  const response = await apiClient.get<ScenarioCardData>(
    `/scenarios/${scenarioId}`
  );
  return response.data;
};

export const updateScenarioCard = async (
  scenarioId: string,
  scenarioData: ScenarioCardUpdateData
): Promise<ScenarioCardData> => {
  const response = await apiClient.put<ScenarioCardData>(
    `/scenarios/${scenarioId}`,
    scenarioData
  );
  return response.data;
};

export const deleteScenarioCard = async (scenarioId: string): Promise<void> => {
  await apiClient.delete(`/scenarios/${scenarioId}`);
};

// --- World Cards (Lore) ---
export interface WorldCardData {
  id: string;
  name: string;
  card_type: string;
  description?: string | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  attributes?: Record<string, any> | null;
  faction_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}
export interface WorldCardCreateData {
  name: string;
  card_type: string;
  description?: string | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  attributes?: Record<string, any> | null;
  faction_id?: string | null;
}
export interface WorldCardUpdateData {
  name?: string;
  card_type?: string;
  description?: string | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  attributes?: Record<string, any> | null;
  faction_id?: string | null;
}

export const createWorldCard = async (
  worldCardData: WorldCardCreateData
): Promise<WorldCardData> => {
  const response = await apiClient.post<WorldCardData>(
    "/world_cards",
    worldCardData
  );
  return response.data;
};

export const getAllWorldCards = async (
  cardType?: string
): Promise<WorldCardData[]> => {
  const params: Record<string, string> = {};
  if (cardType) {
    params.card_type = cardType;
  }
  const response = await apiClient.get<WorldCardData[]>("/world_cards", {
    params,
  });
  return response.data;
};

export const getWorldCardById = async (
  cardId: string
): Promise<WorldCardData> => {
  const response = await apiClient.get<WorldCardData>(`/world_cards/${cardId}`);
  return response.data;
};

export const updateWorldCard = async (
  cardId: string,
  worldCardData: WorldCardUpdateData
): Promise<WorldCardData> => {
  const response = await apiClient.put<WorldCardData>(
    `/world_cards/${cardId}`,
    worldCardData
  );
  return response.data;
};

export const deleteWorldCard = async (cardId: string): Promise<void> => {
  await apiClient.delete(`/world_cards/${cardId}`);
};

// --- Chat Sessions & Messages ---
export interface ChatMessageData {
  id: string;
  chat_session_id: string;
  sender_type: "USER" | "AI" | "SYSTEM";
  content: string;
  timestamp: string;
  message_metadata?: Record<string, any> | null;
}

export interface ChatSessionBaseData {
  scenario_id: string;
  gm_character_id: string;
  user_persona_id: string;
  title?: string | null;
}

export interface ChatSessionCreateData extends ChatSessionBaseData {}

export interface ChatSessionData extends ChatSessionBaseData {
  id: string;
  created_at: string;
  last_active_at: string;
  // Adicione outros campos que seu schema ChatSessionInDB retorna
}

export interface ChatSessionListedData {
  id: string;
  title?: string | null;
  last_active_at: string;
  // Adicione outros campos se seu endpoint de listagem os retorna
}

export const createChatSession = async (
  data: ChatSessionCreateData
): Promise<ChatSessionData> => {
  try {
    const response = await apiClient.post<ChatSessionData>("/chats", data);
    return response.data;
  } catch (error) {
    console.error("Error creating chat session:", error);
    throw error;
  }
};

export const getAllChatSessions = async (): Promise<
  ChatSessionListedData[]
> => {
  try {
    const response = await apiClient.get<ChatSessionListedData[]>("/chats");
    return response.data;
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    throw error;
  }
};

export const getChatSessionDetails = async (
  chatId: string
): Promise<ChatSessionData> => {
  try {
    const response = await apiClient.get<ChatSessionData>(`/chats/${chatId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching chat session ${chatId} details:`, error);
    throw error;
  }
};

export const getChatSessionMessages = async (
  chatId: string
): Promise<ChatMessageData[]> => {
  try {
    const response = await apiClient.get<ChatMessageData[]>(
      `/chats/${chatId}/messages`
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching messages for chat ${chatId}:`, error);
    throw error;
  }
};

export const addMessageToSession = async (
  chatId: string,
  messageData: {
    content: string;
    sender_type: "USER" | "AI" | "SYSTEM";
    message_metadata?: Record<string, any> | null;
  }
): Promise<ChatMessageData> => {
  try {
    const response = await apiClient.post<ChatMessageData>(
      `/chats/${chatId}/messages`,
      messageData
    );
    return response.data;
  } catch (error) {
    console.error(`Error adding message to chat ${chatId}:`, error);
    throw error;
  }
};

export const updateChatSessionTitle = async (
  chatId: string,
  title: string
): Promise<ChatSessionData> => {
  try {
    const response = await apiClient.put<ChatSessionData>(`/chats/${chatId}`, {
      title,
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating title for chat ${chatId}:`, error);
    throw error;
  }
};

export const deleteChatSession = async (chatId: string): Promise<void> => {
  try {
    await apiClient.delete(`/chats/${chatId}`);
  } catch (error) {
    console.error(`Error deleting chat session ${chatId}:`, error);
    throw error;
  }
};

// Não se esqueça do export default se ainda o estiver usando para o apiClient
export default apiClient;
