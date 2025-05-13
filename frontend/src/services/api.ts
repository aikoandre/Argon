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

export const getApiHealth = async () => {
  try {
    const response = await apiClient.get("/health");
    return response.data;
  } catch (error) {
    console.error("Error fetching API health:", error);
    throw error;
  }
};

export const getUserSettings = async (): Promise<UserSettingsData | null> => {
  try {
    const response = await apiClient.get<UserSettingsData>("/settings");
    return response.data;
  } catch (error) {
    console.error("Error fetching user settings:", error);
    // Retorna null ou lança o erro dependendo de como você quer tratar
    // Pode ser que as configurações ainda não existam
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null; // Ou um objeto de configuração padrão
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

export interface LLMModelData {
  id: string;
  name?: string; // O nome pode ser opcional
}

export const getLLMModels = async (): Promise<LLMModelData[]> => {
  try {
    const response = await apiClient.get<LLMModelData[]>("/llm/models");
    return response.data;
  } catch (error) {
    console.error("Error fetching LLM models:", error);
    // Deixe o componente lidar com a exibição do erro
    throw error;
  }
};

export interface UserPersonaData {
  id: string;
  name: string;
  description?: string | null;
  created_at: string; // Ou Date se for converter
  updated_at?: string | null; // Ou Date
}

export interface UserPersonaCreateData {
  name: string;
  description?: string | null;
}

export interface UserPersonaUpdateData {
  name?: string;
  description?: string | null;
}

// ... (apiClient e outras funções existentes) ...

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

export default apiClient;
