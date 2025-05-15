// frontend/src/services/api.ts
import axios from "axios";
import type {
  UserSettingsData,
  UserSettingsUpdateData,
} from "../types/settings";

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
  example_dialogues?: Record<string, any>[] | string[] | null;
  beginning_messages: string[] | null;
  master_world_id: string;
  linked_lore_ids: string[] | null;
  created_at: string;
  updated_at?: string | null;
}

export interface CharacterCardCreateData {
  name: string;
  description?: string | null;
  instructions?: string | null;
  example_dialogues?: Record<string, any>[] | string[] | null;
  beginning_messages?: string[] | null;
  master_world_id?: string | null;
  linked_lore_ids?: string[] | null;
}

export interface CharacterCardUpdateData {
  name?: string;
  description?: string | null;
  instructions?: string | null;
  example_dialogues?: Record<string, any>[] | string[] | null;
  beginning_messages: string[] | null;
  linked_lore_ids: string[] | null;
}

export const createCharacterCard = async (
  characterData: CharacterCardCreateData
): Promise<CharacterCardData> => {
  try {
    const response = await apiClient.post<CharacterCardData>(
      "/characters",
      characterData
    );
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  }
};

export const getAllCharacterCards = async (
  masterWorldId?: string
): Promise<CharacterCardData[]> => {
  const params: Record<string, string> = {};
  if (masterWorldId) {
    params.master_world_id = masterWorldId;
  }
  try {
    const response = await apiClient.get<CharacterCardData[]>("/characters", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching character cards:", error);
    throw error;
  }
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
  beginning_message?: string[] | null;
  example_dialogues?: string[] | null;
  master_world_id?: string | null;
  world_card_references?: string[] | null;
  user_persona_id: string | null;
  created_at: string;
  updated_at?: string | null;
}
export interface ScenarioCardCreateData {
  name: string;
  description?: string | null;
  beginning_message?: string[] | null;
  example_dialogues?: string[] | null;
  master_world_id?: string | null;
  world_card_references?: string[] | null;
  user_persona_id?: string | null;
}
export interface ScenarioCardUpdateData {
  name?: string;
  description?: string | null;
  beginning_message?: string[] | null;
  example_dialogues?: string[] | null;
  world_card_references?: string[] | null;
  master_world_id?: string | null;
  user_persona_id?: string | null;
}

export const createScenarioCard = async (
  scenarioData: ScenarioCardCreateData
): Promise<ScenarioCardData> => {
  try {
    const response = await apiClient.post<ScenarioCardData>(
      "/scenarios",
      scenarioData
    );
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.detail) {
      throw new Error(error.response.data.detail);
    }
    throw error;
  }
};

export const getAllScenarioCards = async (
  masterWorldId?: string
): Promise<ScenarioCardData[]> => {
  const params: Record<string, string> = {};
  if (masterWorldId) {
    params.master_world_id = masterWorldId;
  }
  try {
    const response = await apiClient.get<ScenarioCardData[]>("/scenarios", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching scenario cards:", error);
    throw error;
  }
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

// --- Master Worlds ---
export interface MasterWorldData {
  id: string;
  name: string;
  description?: string | null;
  tags?: string[] | null;
  created_at: string;
  updated_at?: string | null;
}

export const getMasterWorldById = async (
  id: string
): Promise<MasterWorldData> => {
  const response = await apiClient.get<MasterWorldData>(`/master_worlds/${id}`);
  return response.data;
};

export const getAllMasterWorlds = async (): Promise<MasterWorldData[]> => {
  const response = await apiClient.get<MasterWorldData[]>("/master_worlds");
  return response.data;
};

export const createMasterWorld = async (data: {
  name: string;
  description?: string | null;
  tags?: string[] | null;
}): Promise<MasterWorldData> => {
  const response = await apiClient.post<MasterWorldData>(
    "/master_worlds",
    data
  );
  return response.data;
};

export const updateMasterWorld = async (
  id: string,
  data: { name?: string; description?: string | null; tags?: string[] | null }
): Promise<MasterWorldData> => {
  const response = await apiClient.put<MasterWorldData>(
    `/master_worlds/${id}`,
    data
  );
  return response.data;
};

export const deleteMasterWorld = async (id: string): Promise<void> => {
  await apiClient.delete(`/master_worlds/${id}`);
};

// --- Lore Entries ---
export interface LoreEntryData {
  id: string;
  master_world_id: string;
  name: string;
  entry_type: string;
  description?: string | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  faction_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface LoreEntryCreateData {
  name: string;
  entry_type: string;
  description?: string | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  faction_id?: string | null;
  master_world_id: string; // <-- Adicionado para corresponder ao backend
}

export interface LoreEntryUpdateData {
  name?: string;
  entry_type?: string;
  description?: string | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  faction_id?: string | null;
}

export const getAllLoreEntriesForMasterWorld = async (
  masterWorldId: string,
  entryType?: string
): Promise<LoreEntryData[]> => {
  const params: Record<string, string> = {};
  if (entryType) {
    params.entry_type = entryType;
  }
  const response = await apiClient.get<LoreEntryData[]>(
    `/master_worlds/${masterWorldId}/lore_entries`,
    { params }
  );
  return response.data;
};

export const createLoreEntryForMasterWorld = async (
  masterWorldId: string,
  data: LoreEntryCreateData
): Promise<LoreEntryData> => {
  const response = await apiClient.post<LoreEntryData>(
    `/master_worlds/${masterWorldId}/lore_entries`,
    data
  );
  return response.data;
};

export const getLoreEntryById = async (
  entryId: string
): Promise<LoreEntryData> => {
  const response = await apiClient.get<LoreEntryData>(
    `/lore_entries/${entryId}`
  );
  return response.data;
};

export const updateLoreEntry = async (
  entryId: string,
  data: LoreEntryUpdateData
): Promise<LoreEntryData> => {
  const response = await apiClient.put<LoreEntryData>(
    `/lore_entries/${entryId}`,
    data
  );
  return response.data;
};

export const deleteLoreEntry = async (entryId: string): Promise<void> => {
  await apiClient.delete(`/lore_entries/${entryId}`);
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
