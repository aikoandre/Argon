// frontend/src/services/api.ts
import axios from "axios";
import type {
  UserSettingsData,
  UserSettingsUpdateData,
} from "../types/settings";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
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

// --- Image Upload ---
export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/images/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data.url;
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
  image_url?: string | null; // For display only
  created_at: string;
  updated_at?: string | null;
  master_world_id?: string | null;
}

export interface UserPersonaCreateData {
  name: string;
  description?: string | null;
  master_world_id?: string | null;
  // Do NOT include image_url or original_image_name
}

export interface UserPersonaUpdateData {
  name?: string;
  description?: string | null;
  master_world_id?: string | null;
  // Do NOT include image_url or original_image_name
}

const fileApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "multipart/form-data",
  },
});

export const createUserPersona = async (
  data: FormData | UserPersonaCreateData
): Promise<UserPersonaData> => {
  try {
    if (data instanceof FormData) {
      // If FormData (image upload), use fileApi
      const response = await fileApi.post<UserPersonaData>("/personas", data);
      return response.data;
    } else {
      // If plain JSON, use apiClient
      const response = await apiClient.post<UserPersonaData>("/personas", data);
      return response.data;
    }
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

export const uploadPersonaImage = async (personaId: string, file: File): Promise<UserPersonaData> => {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fileApi.post<UserPersonaData>(`/personas/${personaId}/image`, formData);
  return response.data;
};

export const updateUserPersonaWithImage = async (
  personaId: string,
  formData: FormData
): Promise<UserPersonaData> => {
  try {
    const response = await fileApi.put<UserPersonaData>(`/personas/${personaId}`, formData);
    return response.data;
  } catch (error) {
    console.error(`Error updating user persona ${personaId} with image:`, error);
    throw error;
  }
};

// --- Character Cards (NPCs/GM) ---
export interface CharacterCardData {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null; // For display only
  instructions?: string | null;
  example_dialogues?: Record<string, any>[] | string[] | null;
  beginning_messages: string[] | null;
  master_world_id: string;
  linked_lore_ids: string[] | null;
  created_at: string;
  updated_at?: string | null;
}

export const createCharacterCard = async (
  characterData: FormData // Expect FormData from the component
): Promise<CharacterCardData> => {
  try {
    // The FormData object is already prepared by the caller (CharactersPage.tsx)
    const response = await apiClient.post<CharacterCardData>(
      "/characters",
      characterData, // Send the FormData directly
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.detail) {
       // Handle potential validation errors returning array of details
       if (Array.isArray(error.response.data.detail)) {
         const messages = error.response.data.detail.map((e: any) => {
            // Construct a user-friendly message, potentially including field name
            return e.loc && e.loc.length > 1 ? `${e.loc[1]}: ${e.msg}` : e.msg;
         }).join(' | ');
         throw new Error(messages);
       }
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
  characterData: FormData // Expect FormData from the component
  // The CharactersPage.tsx handleSubmit function *already* prepares FormData
): Promise<CharacterCardData> => {
  // Expect FormData for multipart/form-data, including image and other fields
  const response = await apiClient.put<CharacterCardData>(
    `/characters/${characterId}`,
    characterData, // Send the FormData
    {
       headers: { 'Content-Type': 'multipart/form-data' }
    });
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
  instructions?: string | null;
  image_url?: string | null; // For display only
  beginning_message?: string[] | null;
  example_dialogues?: string[] | null;
  master_world_id?: string | null;
  world_card_references?: string[] | null;
  user_persona_id: string | null;
  created_at: string;
  updated_at?: string | null;
}

export const createScenarioCard = async (
  scenarioFormData: FormData
): Promise<ScenarioCardData> => {
  try {
    const response = await apiClient.post<ScenarioCardData>(
      "/scenarios",
      scenarioFormData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.detail) {
      // Handle potential validation errors returning array of details
      if (Array.isArray(error.response.data.detail)) {
        const messages = error.response.data.detail.map((e: any) => {
          // Construct a user-friendly message, potentially including field name
          return e.loc && e.loc.length > 1 ? `${e.loc[1]}: ${e.msg}` : e.msg;
        }).join(' | ');
        throw new Error(messages);
      }
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
  scenarioFormData: FormData
): Promise<ScenarioCardData> => {
   try {
       // Use fileApi for multipart/form-data requests
       const response = await fileApi.put<ScenarioCardData>(
         `/scenarios/${scenarioId}`,
         scenarioFormData
       );
       return response.data;
   } catch (error: any) {
       if (error.response && error.response.data && error.response.data.detail) {
            // Handle potential validation errors returning array of details
            if (Array.isArray(error.response.data.detail)) {
              const messages = error.response.data.detail.map((e: any) => {
                 // Construct a user-friendly message, potentially including field name
                 return e.loc && e.loc.length > 1 ? `${e.loc[1]}: ${e.msg}` : e.msg;
              }).join(' | ');
              throw new Error(messages);
            }
            throw new Error(error.response.data.detail);
       }
       throw error;
   }
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
  image_url?: string | null; // For display only
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

export const createMasterWorld = async (
  data: FormData
): Promise<MasterWorldData> => {
  // Do NOT set Content-Type header here! Let the browser/axios set it for FormData.
  const response = await axios.post<MasterWorldData>(
    `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"}/master_worlds`,
    data
  );
  return response.data;
};

export const updateMasterWorld = async (
  id: string,
  data: FormData | { name?: string; description?: string | null; tags?: string[] | null }
): Promise<MasterWorldData> => {
  if (data instanceof FormData) {
    // Use fileApi for multipart/form-data requests
    const response = await fileApi.put<MasterWorldData>(
      `/master_worlds/${id}`,
      data
    );
    return response.data;
  } else {
    // Use apiClient for JSON
    const response = await apiClient.put<MasterWorldData>(
      `/master_worlds/${id}`,
      data
    );
    return response.data;
  }
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
  image_url?: string | null; // For display only
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
  master_world_id: string;
  // Do NOT include image_url or original_image_name
}

export interface LoreEntryUpdateData {
  name?: string;
  entry_type?: string;
  description?: string | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  faction_id?: string | null;
  // Do NOT include image_url or original_image_name
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
  data: LoreEntryCreateData | FormData
): Promise<LoreEntryData> => {
  if (data instanceof FormData) {
    const response = await fileApi.post<LoreEntryData>(
      `/master_worlds/${masterWorldId}/lore_entries`,
      data
    );
    return response.data;
  } else {
    const response = await apiClient.post<LoreEntryData>(
      `/master_worlds/${masterWorldId}/lore_entries`,
      data
    );
    return response.data;
  }
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
  data: LoreEntryUpdateData | FormData
): Promise<LoreEntryData> => {
  if (data instanceof FormData) {
    const response = await fileApi.put<LoreEntryData>(
      `/lore_entries/${entryId}`,
      data
    );
    return response.data;
  } else {
    const response = await apiClient.put<LoreEntryData>(
      `/lore_entries/${entryId}`,
      data
    );
    return response.data;
  }
};

export const deleteLoreEntry = async (entryId: string): Promise<void> => {
  await apiClient.delete(`/lore_entries/${entryId}`);
};

// --- Chat Sessions & Messages ---
export const createOrGetCardChat = async (cardType: 'character'|'scenario', cardId: string): Promise<string> => {
  const response = await apiClient.post<{ id: string }>(`/chat/sessions/${cardType}/${cardId}`);
  return response.data.id;
};

export interface ChatMessageData {
  id: string;
  chat_session_id: string;
  sender_type: "USER" | "AI" | "SYSTEM";
  content: string;
  timestamp: string;
  message_metadata?: Record<string, any> | null;
}

export interface ChatSessionBaseData {
  scenario_id?: string; // now optional
  gm_character_id?: string; // now optional
  user_persona_id?: string; // now optional
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
  card_type?: string;
  card_id?: string;
  card_name?: string;
  card_image_url?: string;
}

export const createChatSession = async (
  data: ChatSessionCreateData
): Promise<ChatSessionData> => {
  // Remove empty string fields before sending
  const cleanData: Record<string, any> = { ...data };
  if (cleanData.scenario_id === "") delete cleanData.scenario_id;
  if (cleanData.gm_character_id === "") delete cleanData.gm_character_id;
  if (cleanData.user_persona_id === "") delete cleanData.user_persona_id;
  try {
    const response = await apiClient.post<ChatSessionData>('/chat/', cleanData);
    return response.data;
  } catch (error) {
    console.error('Error creating chat session:', error);
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
    const response = await apiClient.get<ChatSessionData>(`/chat/${chatId}`);
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
      `/chat/${chatId}/messages`
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
      `/chat/${chatId}/messages`,
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
    const response = await apiClient.put<ChatSessionData>(`/chat/${chatId}`, {
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
    await apiClient.delete(`/chat/${chatId}`);
  } catch (error) {
    console.error(`Error deleting chat session ${chatId}:`, error);
    throw error;
  }
};

export const checkExistingChatSession = async (params: {
  gm_character_id?: string;
  scenario_id?: string;
  user_persona_id?: string;
}): Promise<ChatSessionData | null> => {
  // Remove empty string fields before sending
  const cleanParams: Record<string, any> = { ...params };
  if (cleanParams.scenario_id === "") delete cleanParams.scenario_id;
  if (cleanParams.gm_character_id === "") delete cleanParams.gm_character_id;
  if (cleanParams.user_persona_id === "") delete cleanParams.user_persona_id;
  try {
    const response = await apiClient.get<ChatSessionData>('/chat/check', { params: cleanParams });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

// Não se esqueça do export default se ainda o estiver usando para o apiClient
export default apiClient;
