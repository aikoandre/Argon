// frontend/src/services/promptPresetApi.ts
// API service for modular prompt system functionality

import apiClient from './api';

// Types for prompt system
export interface PromptPreset {
  id: string;
  name: string;
  description?: string;
  is_default?: boolean;
  is_sillytavern_compatible?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PromptModule {
  id: string;
  preset_id: string;
  identifier: string;
  name: string;
  category: 'core' | 'style' | 'stance' | 'utility';
  content: string;
  enabled: boolean;
  injection_position?: string;
  injection_depth?: number;
  injection_order?: number;
  forbid_overrides?: boolean;
  role?: string;
  // Service-specific fields
  applicable_services?: string[];  // Services this module applies to
  is_core_module?: boolean;        // Core modules can't be disabled
  service_priority?: number;       // Priority within services
  created_at?: string;
  updated_at?: string;
}

export interface UserPromptConfiguration {
  id: string;
  user_id: string;
  active_preset_id?: string;
  
  // Core Parameters
  temperature?: number;
  top_p?: number;
  reasoning_effort?: string;
  context_size?: number;
  
  // Advanced Sampling
  top_k?: number;
  top_a?: number;
  min_p?: number;
  max_tokens?: number;
  
  // Penalty Controls
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  
  created_at?: string;
  updated_at?: string;
}

export interface ContextRecommendations {
  recommended: number;
  max_possible: number;
  provider_info?: string;
  context_info?: {
    total_context_tokens: number;
    system_prompt_tokens: number;
    response_buffer_tokens: number;
    available_for_history: number;
    max_possible_messages: number;
    avg_tokens_per_message: number;
  };
}

// API Functions

// Preset Management
export const getAllPresets = async (): Promise<PromptPreset[]> => {
  const response = await apiClient.get('/prompt-presets/');
  return response.data;
};

export const getPresetById = async (id: string): Promise<PromptPreset & { modules: PromptModule[] }> => {
  const response = await apiClient.get(`/prompt-presets/${id}`);
  return response.data;
};

export const createPreset = async (preset: Omit<PromptPreset, 'id' | 'created_at' | 'updated_at'>): Promise<PromptPreset> => {
  const response = await apiClient.post('/prompt-presets/', preset);
  return response.data;
};

export const updatePreset = async (id: string, preset: Partial<PromptPreset>): Promise<PromptPreset> => {
  const response = await apiClient.put(`/prompt-presets/${id}`, preset);
  return response.data;
};

export const deletePreset = async (id: string): Promise<void> => {
  await apiClient.delete(`/prompt-presets/${id}`);
};

// SillyTavern Import
export const importSillyTavernPreset = async (file: File): Promise<PromptPreset> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/prompt-presets/import-sillytavern', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// User Configuration
export const getUserPromptConfiguration = async (): Promise<UserPromptConfiguration> => {
  const response = await apiClient.get('/prompt-presets/user/configuration');
  return response.data;
};

export const updateUserPromptConfiguration = async (
  config: Partial<UserPromptConfiguration>
): Promise<UserPromptConfiguration> => {
  const response = await apiClient.put('/prompt-presets/user/configuration', config);
  return response.data;
};

// Module Management
export const createModule = async (
  presetId: string, 
  module: Omit<PromptModule, 'id' | 'preset_id' | 'created_at' | 'updated_at'>
): Promise<PromptModule> => {
  const response = await apiClient.post(`/prompt-presets/${presetId}/modules`, module);
  return response.data;
};

export const deleteModule = async (presetId: string, moduleId: string): Promise<void> => {
  await apiClient.delete(`/prompt-presets/${presetId}/modules/${moduleId}`);
};

export const updateModule = async (
  presetId: string, 
  moduleId: string, 
  module: Partial<PromptModule>
): Promise<PromptModule> => {
  const response = await apiClient.put(`/prompt-presets/${presetId}/modules/${moduleId}`, module);
  return response.data;
};

export const toggleModule = async (presetId: string, moduleId: string, enabled: boolean): Promise<PromptModule> => {
  const response = await apiClient.post(`/prompt-presets/user/toggle-module/${presetId}/${moduleId}`, {
    enabled
  });
  return response.data;
};

// Context Management
export const getContextRecommendations = async (modelName: string): Promise<ContextRecommendations> => {
  const response = await apiClient.get(`/prompt-presets/context-recommendations/${encodeURIComponent(modelName)}`);
  return response.data;
};

export const validateContextSize = async (modelName: string, requestedMessages: number): Promise<{
  is_valid: boolean;
  message: string;
}> => {
  const response = await apiClient.post('/prompt-presets/validate-context-size', {
    model_name: modelName,
    requested_messages: requestedMessages
  });
  return response.data;
};

// Default Preset Creation
export const createDefaultNemoPreset = async (): Promise<PromptPreset> => {
  const response = await apiClient.post('/prompt-presets/create-default-nemo');
  return response.data;
};

export const createDefaultCherryBoxPreset = async (): Promise<PromptPreset> => {
  const response = await apiClient.post('/prompt-presets/create-default-cherrybox');
  return response.data;
};
