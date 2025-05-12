// src/services/apiService.ts
import React, { useEffect, useState } from 'react';
import type { ScenarioCard, CharacterCard, GlobalLoreEntry, UserSettings, ChatInput, ChatResponse, NewChatRequest, NewChatResponse } from "../types/models";

const API_BASE_URL = 'http://localhost:8000/api';

// --- User Settings ---
export const getUserSettings = async (): Promise<UserSettings> => {
  const response = await fetch(\`\${API_BASE_URL}/settings\`);
  if (!response.ok) {
    console.error("API Error fetching settings:", response.status, await response.text());
    throw new Error('Failed to fetch settings');
  }
  return response.json();
};

export const saveUserSettings = async (settingsData: UserSettings): Promise<UserSettings> => {
  const response = await fetch(\`\${API_BASE_URL}/settings\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settingsData),
  });
  if (!response.ok) {
    console.error("API Error saving settings:", response.status, await response.text());
    throw new Error('Failed to save settings');
  }
  return response.json();
};

// --- Scenario Cards ---
export const getScenarios = async (): Promise<ScenarioCard[]> => {
  const response = await fetch(\`\${API_BASE_URL}/scenarios\`);
  if (!response.ok) throw new Error('Failed to fetch scenarios');
  return response.json();
};

export const getScenarioById = async (scenarioId: string): Promise<ScenarioCard> => {
  const response = await fetch(\`\${API_BASE_URL}/scenarios/\${scenarioId}\`);
  if (!response.ok) throw new Error(\`Failed to fetch scenario \${scenarioId}\`);
  return response.json();
};

export const createScenario = async (scenarioData: Omit<ScenarioCard, 'id'>): Promise<ScenarioCard> => {
  const response = await fetch(\`\${API_BASE_URL}/scenarios\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenarioData),
  });
  if (!response.ok) {
    console.error("API Error fetching settings:", response.status, await response.text());
    throw new Error('Failed to create scenario');
  }
  return response.json();
};

export const updateScenario = async (scenarioId: string, scenarioData: ScenarioCard): Promise<ScenarioCard> => {
  const response = await fetch(\`\${API_BASE_URL}/scenarios/\${scenarioId}\`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenarioData),
  });
  if (!response.ok) throw new Error(\`Failed to update scenario \${scenarioId}\`);
  return response.json();
};

export const deleteScenario = async (scenarioId: string): Promise<void> => {
  const response = await fetch(\`\${API_BASE_URL}/scenarios/\${scenarioId}\`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(\`Failed to delete scenario \${scenarioId}\`);
  return;
};

// --- Character Cards (GM/NPCs e Usuário) ---
export const getCharacters = async (): Promise<CharacterCard[]> => {
  const response = await fetch(\`\${API_BASE_URL}/characters\`);
  if (!response.ok) throw new Error('Failed to fetch characters');
  return response.json();
};

export const createCharacter = async (characterData: Omit<CharacterCard, 'id'>): Promise<CharacterCard> => {
  const response = await fetch(\`\${API_BASE_URL}/characters\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(characterData),
  });
  if (!response.ok) {
    console.error("API Error fetching settings:", response.status, await response.text());
    throw new Error('Failed to create character');
  }
  return response.json();
};

export const updateCharacter = async (characterId: string, characterData: CharacterCard): Promise<CharacterCard> => {
    const response = await fetch(\`\${API_BASE_URL}/characters/\${characterId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData),
    });
    if (!response.ok) throw new Error(\`Failed to update character \${characterId}\`);
    return response.json();
};

export const deleteCharacter = async (characterId: string): Promise<void> => {
    const response = await fetch(\`\${API_BASE_URL}/characters/\${characterId}\`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error(\`Failed to delete character \${characterId}\`);
    return;
};

// --- Global Lore Entries ---
export const getGlobalLoreEntries = async (): Promise<GlobalLoreEntry[]> => {
  const response = await fetch(\`\${API_BASE_URL}/global_lore\`);
  if (!response.ok) throw new Error('Failed to fetch global lore');
  return response.json();
};

export const createGlobalLoreEntry = async (loreData: Omit<GlobalLoreEntry, 'id'>): Promise<GlobalLoreEntry> => {
  const response = await fetch(\`\${API_BASE_URL}/global_lore\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loreData),
  });
  if (!response.ok) {
    console.error("API Error fetching settings:", response.status, await response.text());
    throw new Error('Failed to create lore entry');
  }
  return response.json();
};

export const updateGlobalLoreEntry = async (loreEntryId: string, loreData: GlobalLoreEntry): Promise<GlobalLoreEntry> => {
    const response = await fetch(\`\${API_BASE_URL}/global_lore/\${loreEntryId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loreData),
    });
    if (!response.ok) throw new Error(\`Failed to update global lore entry \${loreEntryId}\`);
    return response.json();
};

export const deleteGlobalLoreEntry = async (loreEntryId: string): Promise<void> => {
    const response = await fetch(\`\${API_BASE_URL}/global_lore/\${loreEntryId}\`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error(\`Failed to delete global lore entry \${loreEntryId}\`);
    return;
};

// --- Chat Sessions & Messages ---
export const createNewChatSession = async (newChatRequestData: NewChatRequest): Promise<NewChatResponse> => {
  const response = await fetch(\`\${API_BASE_URL}/chats\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newChatRequestData),
  });
  if (!response.ok) {
    console.error("API Error fetching settings:", response.status, await response.text());
    throw new Error('Failed to create chat session');
  }
  return response.json();
};

export const getChatSessions = async (): Promise<NewChatResponse[]> => {
    const response = await fetch(\`\${API_BASE_URL}/chats\`);
    if (!response.ok) throw new Error('Failed to fetch chat sessions');
    return response.json();
};

export const getChatMessages = async (chatId: string): Promise<ChatResponse[]> => {
  const response = await fetch(\`\${API_BASE_URL}/chats/\${chatId}/messages\`);
  if (!response.ok) throw new Error(\`Failed to fetch messages for chat \${chatId}\`);
  return response.json();
};

export const postChatMessage = async (chatId: string, userInput: string, sceneInfo?: any): Promise<ChatResponse> => {
  const payload = {
    chat_id: chatId,
    user_input: userInput,
    ...sceneInfo // current_scene_time, current_scene_location, etc.
  };
  const response = await fetch(\`\${API_BASE_URL}/chat\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error("API Error fetching settings:", response.status, await response.text());
    throw new Error('Failed to post chat message');
  }
  return response.json();
};
