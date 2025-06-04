// frontend/src/api/promptInstructions.ts
import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface UserPromptInstructions {
  id: number;
  primary_instructions: string;
  extraction_instructions: string;
  analysis_instructions: string;
}

export interface UserPromptInstructionsUpdate {
  primary_instructions?: string;
  extraction_instructions?: string;
  analysis_instructions?: string;
}

export const getPromptInstructions = async (): Promise<UserPromptInstructions> => {
  try {
    const response = await apiClient.get('/prompt-instructions');
    return response.data;
  } catch (error) {
    console.error('Error fetching prompt instructions:', error);
    throw error;
  }
};

export const updatePromptInstructions = async (
  instructions: UserPromptInstructionsUpdate
): Promise<UserPromptInstructions> => {
  try {
    const response = await apiClient.put('/prompt-instructions', instructions);
    return response.data;
  } catch (error) {
    console.error('Error updating prompt instructions:', error);
    throw error;
  }
};
