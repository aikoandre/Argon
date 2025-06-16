// frontend/src/services/api.ts
import axios from "axios";
import type {
  UserSettingsData,
  UserSettingsUpdateData,
} from "../types/settings";
import type { PanelData } from "../types/chat";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:7000/api",
  timeout: 120000, // Increased timeout to 120 seconds (2 minutes) for long LLM calls
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
export const uploadImage = async (file: File, entityType: string = 'persona', entityName?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (entityName) {
    formData.append('entity_name', entityName);
  }
  const response = await apiClient.post(`/images/upload/${entityType}`, formData, {
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
  provider?: string;
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

export const createUserPersona = async (
  data: FormData // Expects a fully prepared FormData object from the component
): Promise<UserPersonaData> => {
  try {
    const response = await apiClient.post<UserPersonaData>("/personas", data, {
      headers: {
        'Content-Type': 'multipart/form-data' // Essential for FormData
      }
    });
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
  formData: FormData // Expects a fully prepared FormData object from the component
): Promise<UserPersonaData> => {
  try {
    const response = await apiClient.put<UserPersonaData>(
      `/personas/${personaId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data' // Essential for FormData
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Error updating user persona ${personaId}:`, error);
    throw error;
  }
}

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
       // Use apiClient instead of fileApi and add explicit headers
       const response = await apiClient.put<ScenarioCardData>(
         `/scenarios/${scenarioId}`,
         scenarioFormData,
         {
           headers: { 'Content-Type': 'multipart/form-data' } // Crucial for FormData
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

export const deleteScenarioCard = async (scenarioId: string): Promise<void> => {
  await apiClient.delete(`/scenarios/${scenarioId}`);
};

// --- Master Worlds ---
export interface MasterWorldData {
  id: string;
  name: string;
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
  data: { name: string }
): Promise<MasterWorldData> => {
  // Backend expects multipart/form-data with 'name' as a form field
  const formData = new FormData();
  formData.append('name', data.name);
  const response = await apiClient.post<MasterWorldData>("/master_worlds", formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const updateMasterWorld = async (
  id: string,
  data: { name?: string }
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

export const getAllLoreEntries = async (
  entryType?: string
): Promise<LoreEntryData[]> => {
  const params: Record<string, string> = {};
  if (entryType) {
    params.entry_type = entryType;
  }
  const response = await apiClient.get<LoreEntryData[]>(
    `/lore_entries`,
    { params }
  );
  return response.data;
};

export const createLoreEntryForMasterWorld = async (
  masterWorldId: string,
  data: LoreEntryCreateData | FormData
): Promise<LoreEntryData> => {
  let formData: FormData;
  if (data instanceof FormData) {
    formData = data;
  } else {
    formData = new FormData();
    formData.append('data', JSON.stringify(data));
  }
  const response = await apiClient.post<LoreEntryData>(
    `/master_worlds/${masterWorldId}/lore_entries`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' }
    }
  );
  return response.data;
};

export const updateLoreEntry = async (
  masterWorldId: string,
  loreEntryId: string,
  data: LoreEntryUpdateData
): Promise<LoreEntryData> => {
  const response = await apiClient.put<LoreEntryData>(
    `/master_worlds/${masterWorldId}/lore_entries/${loreEntryId}`,
    data
  );
  return response.data;
};

export const deleteLoreEntry = async (
  masterWorldId: string,
  loreEntryId: string
): Promise<void> => {
  await apiClient.delete(
    `/master_worlds/${masterWorldId}/lore_entries/${loreEntryId}`
  );
};

// --- Chat Sessions & Messages ---
export const createOrGetCardChat = async (
  cardType: 'character'|'scenario',
  cardId: string,
  userPersonaId: string | null = null // Add optional userPersonaId parameter
): Promise<string> => {
  const params: Record<string, string> = {};
  if (userPersonaId) {
    params.user_persona_id = userPersonaId;
  }
  const response = await apiClient.post<{ id: string }>(
    `/chat/sessions/${cardType}/${cardId}`,
    {}, // Empty body for POST with query params
    { params } // Pass params here
  );
  return response.data.id;
};

export const searchLoreEntries = async (masterWorldId: string, queryText: string): Promise<LoreEntryData[]> => {
  try {
    const response = await apiClient.post<LoreEntryData[]>(
      `/master_worlds/${masterWorldId}/lore_entries/search`,
      { query: { query_text: queryText } }
    );
    return response.data;
  } catch (error) {
    console.error("Error searching lore entries:", error);
    throw error;
  }
};


export interface ChatSessionData {
  id: string;
  created_at: string;
  last_active_at: string;
  scenario_id?: string;
  gm_character_id?: string;
  user_persona_id?: string;
  title?: string | null;
  card_type?: string;
  card_id?: string;
  panel_data?: PanelData | null;
}

export interface ChatSessionListedData {
  id: string;
  title?: string | null;
  last_active_at: string;
  card_type?: string;
  card_id?: string;
  card_name?: string;
  card_image_url?: string;
  user_message_count?: number; // Changed to count only user messages
}

// --- Chat Messages ---
// ChatMessageData is now defined in types/chat.ts, do not redefine or re-import it here.

export const getAllChatSessions = async (): Promise<
  ChatSessionListedData[]
> => {
  try {
    const response = await apiClient.get<ChatSessionListedData[]>("/chat");
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

import { type ChatTurnResponse, type ChatMessageData } from "../types/chat"; // Corrected import for ChatTurnResponse and ChatMessageData

export const addMessageToSession = async (
  chatId: string,
  messageData: {
    content: string;
    sender_type: "USER" | "AI" | "SYSTEM";
    user_persona_id?: string | null; // Add this field
    message_metadata?: Record<string, any> | null;
    active_persona_name?: string | null; // New field
    active_persona_image_url?: string | null; // New field
    current_beginning_message_index?: number; // New field for beginning message navigation
  },
  abortSignal?: AbortSignal
): Promise<ChatTurnResponse> => { // Changed return type to ChatTurnResponse
  try {
    if (!messageData.content || messageData.content.trim().length === 0) {
      throw new Error("Message content cannot be empty.");
    }
    const response = await apiClient.post<ChatTurnResponse>( // Changed generic type to ChatTurnResponse
      `/chat/${chatId}/messages`,
      messageData, // Send the entire messageData object
      {
        signal: abortSignal // Add abort signal support
      }
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
