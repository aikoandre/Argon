// frontend/src/pages/SettingsPage.tsx
import React, { useState, useEffect, useMemo, useCallback, type FormEvent } from "react";
import Select, { type SingleValue } from "react-select";
import { useLayout } from "../contexts/LayoutContext";
import {
  getUserSettings,
  updateUserSettings,
  getLLMModels,
  type LLMModelData,
} from "../services/api";
import type { UserSettingsUpdateData } from "../types/settings";
import ParameterSection from "../components/Settings/ParameterSection";
import { getVisibleParameters } from "../utils/providerCapabilities";

interface SelectOption {
  value: string;
  label: string;
  provider?: string;
  isDisabled?: boolean;
}

const SettingsPage: React.FC = () => {
  const { setLeftPanelVisible, setRightPanelVisible } = useLayout();
  const [settings, setSettings] = useState<UserSettingsUpdateData>({
    // Legacy fields (keep for backward compatibility)
    selected_llm_model: "",
    primary_llm_api_key: "",
    analysis_llm_api_key: "",
    mistral_api_key: "",
    analysis_llm_model: "",
    
    // Simplified LLM configuration - only Primary LLM settings needed
    primary_llm_provider: "",
    primary_llm_model: "",
    primary_llm_api_key_new: "",
    
    // Simple feature toggles for Analysis and Maintenance (use Primary LLM key when enabled)
    analysis_enabled: true,
    maintenance_enabled: true,
    
    // Embedding configuration (requires separate API key due to rate limiting)
    embedding_enabled: true,
    embedding_llm_provider: "",
    embedding_llm_model: "",
    embedding_llm_api_key: "",
    
    // Primary LLM parameters (defaults)
    primary_llm_temperature: 1.0,
    primary_llm_top_p: 1.0,
    primary_llm_max_tokens: undefined,
    primary_llm_reasoning_effort: "Medium",
    primary_llm_custom_prompt: "",
    
    // Analysis LLM parameters (defaults)
    analysis_llm_temperature: 1.0,
    analysis_llm_top_p: 1.0,
    analysis_llm_max_tokens: undefined,
    analysis_llm_reasoning_effort: "Medium",
    analysis_llm_custom_prompt: "",
    
    // Maintenance LLM parameters (defaults)
    maintenance_llm_temperature: 1.0,
    maintenance_llm_top_p: 1.0,
    maintenance_llm_max_tokens: undefined,
    maintenance_llm_reasoning_effort: "Medium",
    maintenance_llm_custom_prompt: "",
  });
  const [activeTab, setActiveTab] = useState<string>("primary");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);

  const [availableModels, setAvailableModels] = useState<LLMModelData[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Provider options for dropdowns
  const providerOptions: SelectOption[] = [
    { value: "openrouter", label: "OpenRouter" },
    { value: "mistral", label: "Mistral" },
    { value: "google", label: "Google AI Studio" },
  ];

  // Helper function to create model options for a specific provider
  const createModelOptionsForProvider = (provider: string | null | undefined): SelectOption[] => {
    if (!provider) return [];
    
    const providerModels = availableModels.filter(model => {
      if (provider === "openrouter") return model.provider === "OpenRouter";
      if (provider === "mistral") return model.provider === "Mistral";
      if (provider === "google") return model.provider === "Google";
      return false;
    });

    return providerModels.map(model => ({
      value: model.id,
      label: model.name || model.id,
      provider: model.provider
    }));
  };

  // Primary LLM model options (only service that needs provider/model selection)
  const primaryModelOptions = useMemo((): SelectOption[] => {
    return createModelOptionsForProvider(settings.primary_llm_provider);
  }, [availableModels, settings.primary_llm_provider]);

  const selectedPrimaryModelOption = useMemo((): SelectOption | null => {
    return primaryModelOptions.find(option => option.value === settings.primary_llm_model) || null;
  }, [primaryModelOptions, settings.primary_llm_model]);

  // Embedding LLM model options (requires separate API key due to rate limiting)
  const embeddingModelOptions = useMemo((): SelectOption[] => {
    return createModelOptionsForProvider(settings.embedding_llm_provider);
  }, [availableModels, settings.embedding_llm_provider]);

  const selectedEmbeddingModelOption = useMemo((): SelectOption | null => {
    return embeddingModelOptions.find(option => option.value === settings.embedding_llm_model) || null;
  }, [embeddingModelOptions, settings.embedding_llm_model]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setError(null);
      setModelsError(null);
      try {
        const [settingsData, modelsDataFromApi] = await Promise.all([
          getUserSettings(),
          getLLMModels(),
        ]);
        
        if (settingsData) {
          setSettings({
            // Legacy fields (keep for backward compatibility)
            selected_llm_model: settingsData.selected_llm_model || "",
            primary_llm_api_key: settingsData.primary_llm_api_key || "",
            analysis_llm_api_key: settingsData.analysis_llm_api_key || "",
            mistral_api_key: settingsData.mistral_api_key || "",
            analysis_llm_model: settingsData.analysis_llm_model || "",
            
            // Simplified LLM configuration - only Primary LLM settings needed
            primary_llm_provider: settingsData.primary_llm_provider || "",
            primary_llm_model: settingsData.primary_llm_model || "",
            primary_llm_api_key_new: settingsData.primary_llm_api_key_new || "",
            
            // Simple feature toggles for Analysis and Maintenance (default to enabled if not set)
            analysis_enabled: settingsData.analysis_enabled ?? true,
            maintenance_enabled: settingsData.maintenance_enabled ?? true,
            
            // Embedding configuration (requires separate API key due to rate limiting)
            embedding_enabled: settingsData.embedding_enabled ?? true,
            embedding_llm_provider: settingsData.embedding_llm_provider || "",
            embedding_llm_model: settingsData.embedding_llm_model || "",
            embedding_llm_api_key: settingsData.embedding_llm_api_key || "",
            
            // Primary LLM parameters (defaults if not set)
            primary_llm_temperature: settingsData.primary_llm_temperature ?? 1.0,
            primary_llm_top_p: settingsData.primary_llm_top_p ?? 1.0,
            primary_llm_max_tokens: settingsData.primary_llm_max_tokens || undefined,
            primary_llm_reasoning_effort: settingsData.primary_llm_reasoning_effort || "Medium",
            primary_llm_custom_prompt: settingsData.primary_llm_custom_prompt || "",
            
            // Analysis LLM parameters (defaults if not set)
            analysis_llm_temperature: settingsData.analysis_llm_temperature ?? 1.0,
            analysis_llm_top_p: settingsData.analysis_llm_top_p ?? 1.0,
            analysis_llm_max_tokens: settingsData.analysis_llm_max_tokens || undefined,
            analysis_llm_reasoning_effort: settingsData.analysis_llm_reasoning_effort || "Medium",
            analysis_llm_custom_prompt: settingsData.analysis_llm_custom_prompt || "",
            
            // Maintenance LLM parameters (defaults if not set)
            maintenance_llm_temperature: settingsData.maintenance_llm_temperature ?? 1.0,
            maintenance_llm_top_p: settingsData.maintenance_llm_top_p ?? 1.0,
            maintenance_llm_max_tokens: settingsData.maintenance_llm_max_tokens || undefined,
            maintenance_llm_reasoning_effort: settingsData.maintenance_llm_reasoning_effort || "Medium",
            maintenance_llm_custom_prompt: settingsData.maintenance_llm_custom_prompt || "",
          });
        } else {
          setSettings({
            // Legacy fields (keep for backward compatibility)
            selected_llm_model: "",
            primary_llm_api_key: "",
            analysis_llm_api_key: "",
            mistral_api_key: "",
            analysis_llm_model: "",
            
            // Simplified LLM configuration - only Primary LLM settings needed
            primary_llm_provider: "",
            primary_llm_model: "",
            primary_llm_api_key_new: "",
            
            // Simple feature toggles for Analysis and Maintenance (default to enabled)
            analysis_enabled: true,
            maintenance_enabled: true,
            
            // Embedding configuration (requires separate API key due to rate limiting)
            embedding_enabled: true,
            embedding_llm_provider: "",
            embedding_llm_model: "",
            embedding_llm_api_key: "",
            
            // Primary LLM parameters (defaults)
            primary_llm_temperature: 1.0,
            primary_llm_top_p: 1.0,
            primary_llm_max_tokens: undefined,
            primary_llm_reasoning_effort: "Medium",
            primary_llm_custom_prompt: "",
            
            // Analysis LLM parameters (defaults)
            analysis_llm_temperature: 1.0,
            analysis_llm_top_p: 1.0,
            analysis_llm_max_tokens: undefined,
            analysis_llm_reasoning_effort: "Medium",
            analysis_llm_custom_prompt: "",
            
            // Maintenance LLM parameters (defaults)
            maintenance_llm_temperature: 1.0,
            maintenance_llm_top_p: 1.0,
            maintenance_llm_max_tokens: undefined,
            maintenance_llm_reasoning_effort: "Medium",
            maintenance_llm_custom_prompt: "",
          });
        }
        setAvailableModels(modelsDataFromApi);
      } catch (err: any) {
        setError("Failed to load settings or models.");
        console.error("Error fetching initial data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Hide panels for settings page
  useEffect(() => {
    setLeftPanelVisible(true);
    setRightPanelVisible(true);
  }, [setLeftPanelVisible, setRightPanelVisible]);

  // Auto-save function
  const autoSaveSettings = useCallback(async (newSettings: UserSettingsUpdateData) => {
    if (isAutoSaving || isLoading) return; // Prevent concurrent saves
    
    setIsAutoSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      await updateUserSettings(newSettings);
      // Auto-save silently without showing success message
    } catch (err) {
      console.error("Auto-save failed:", err);
      setError("Auto-save failed. Please try saving manually.");
      // Clear error message after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsAutoSaving(false);
    }
  }, [isAutoSaving, isLoading]);

  // Primary LLM configuration handlers (only service with provider/model/key config)
  const handlePrimaryProviderChange = (selectedOption: SingleValue<SelectOption>) => {
    const newSettings = {
      ...settings,
      primary_llm_provider: selectedOption ? selectedOption.value : "",
      primary_llm_model: "", // Reset model when provider changes
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  const handlePrimaryModelChangeNew = (selectedOption: SingleValue<SelectOption>) => {
    const newSettings = {
      ...settings,
      primary_llm_model: selectedOption ? selectedOption.value : "",
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  const handlePrimaryApiKeyChangeNew = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSettings = {
      ...settings,
      primary_llm_api_key_new: e.target.value,
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  // Simple toggle handlers for optional services (all use Primary LLM when enabled)
  const handleAnalysisEnabledChange = (enabled: boolean) => {
    const newSettings = {
      ...settings,
      analysis_enabled: enabled,
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  const handleMaintenanceEnabledChange = (enabled: boolean) => {
    const newSettings = {
      ...settings,
      maintenance_enabled: enabled,
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  const handleEmbeddingEnabledChange = (enabled: boolean) => {
    const newSettings = {
      ...settings,
      embedding_enabled: enabled,
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  // Embedding LLM configuration handlers (requires separate API key due to rate limiting)
  const handleEmbeddingProviderChange = (selectedOption: SingleValue<SelectOption>) => {
    const newSettings = {
      ...settings,
      embedding_llm_provider: selectedOption ? selectedOption.value : "",
      embedding_llm_model: "", // Reset model when provider changes
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  const handleEmbeddingModelChange = (selectedOption: SingleValue<SelectOption>) => {
    const newSettings = {
      ...settings,
      embedding_llm_model: selectedOption ? selectedOption.value : "",
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  const handleEmbeddingApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSettings = {
      ...settings,
      embedding_llm_api_key: e.target.value,
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  // Primary LLM parameter handlers
  const handlePrimaryParameterChange = (field: keyof UserSettingsUpdateData, value: any) => {
    const newSettings = {
      ...settings,
      [field]: value,
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  // Analysis LLM parameter handlers
  const handleAnalysisParameterChange = (field: keyof UserSettingsUpdateData, value: any) => {
    const newSettings = {
      ...settings,
      [field]: value,
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  // Maintenance LLM parameter handlers
  const handleMaintenanceParameterChange = (field: keyof UserSettingsUpdateData, value: any) => {
    const newSettings = {
      ...settings,
      [field]: value,
    };
    setSettings(newSettings);
    setSuccessMessage(null);
    setError(null);
    autoSaveSettings(newSettings);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await updateUserSettings(settings);
      setSuccessMessage("Settings updated successfully!");
    } catch (err) {
      setError("Failed to update settings.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <p className="text-center text-gray-400 p-10">Loading settings...</p>
    );
  }
  return (
    <div className="text-white h-full max-h-[calc(90vh-65px)] overflow-hidden flex flex-col">
      <h1 className="text-4xl font-bold text-white mb-8 flex-shrink-0">
        Application Settings
      </h1>
      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center flex-shrink-0">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="bg-green-700 text-white p-3 rounded-md mb-4 text-center flex-shrink-0">
          {successMessage}
        </p>
      )}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border hover:scrollbar-thumb-app-text">
        <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-lg mx-auto pb-4">
        <div className="flex justify-between border-b border-gray-700 mb-6">
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "primary"
                ? "border-b-2 border-app-text-2 text-app-text-2"
                : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("primary")}
          >
            Primary
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "analysis"
                ? "border-b-2 border-app-text-2 text-app-text-2"
                : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("analysis")}
          >
            Analysis
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "maintenance"
                ? "border-b-2 border-app-text-2 text-app-text-2"
                : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("maintenance")}
          >
            Maintenance
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "embedding"
                ? "border-b-2 border-app-text-2 text-app-text-2"
                : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("embedding")}
          >
            Embedding
          </button>
        </div>
        
        {activeTab === "primary" && (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="primary_llm_provider_input"
                className="block text-sm font-medium text-app-text-2 mb-1"
              >
                Primary LLM Provider:
              </label>
              <Select<SelectOption>
                inputId="primary_llm_provider_input"
                options={providerOptions}
                value={providerOptions.find(option => option.value === settings.primary_llm_provider) || null}
                onChange={handlePrimaryProviderChange}
                isLoading={isLoading}
                isClearable
                isSearchable
                placeholder="-- Select a Provider --"
                noOptionsMessage={() => "No providers found"}
                isDisabled={isLoading}
                className="react-select-container"
                classNamePrefix="react-select"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    backgroundColor: "#212529",
                    borderColor: state.isFocused ? "#f8f9fa" : "#343a40",
                    boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                    "&:hover": { borderColor: "#f8f9fa" },
                    minHeight: "42px",
                  }),
                  singleValue: (base) => ({ ...base, color: "white" }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: "#495057",
                    zIndex: 10,
                  }),
                  option: (base, { isFocused, isSelected }) => ({
                    ...base,
                    backgroundColor: isSelected
                      ? "#adb5bd"
                      : isFocused
                      ? "#dee2e6"
                      : "#495057",
                    color: isSelected || isFocused ? "#212529" : "#fff",
                    ":active": { backgroundColor: "#f8f9fa", color: "#212529" },
                  }),
                  placeholder: (base) => ({ ...base, color: "#9CA3AF" }),
                  input: (base) => ({ ...base, color: "white" }),
                  dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
                  clearIndicator: (base) => ({
                    ...base,
                    color: "#9CA3AF",
                    ":hover": { color: "white" },
                  }),
                  indicatorSeparator: (base) => ({
                    ...base,
                    backgroundColor: "#343a40",
                  }),
                }}
              />
            </div>
            <div>
              <label
                htmlFor="primary_llm_model_input"
                className="block text-sm font-medium text-app-text-2 mb-1"
              >
                Primary LLM Model:
              </label>
              {modelsError && (
                <p className="text-red-400 text-xs mt-1">
                  Error loading models: {modelsError}
                </p>
              )}
              <Select<SelectOption>
                inputId="primary_llm_model_input"
                options={primaryModelOptions}
                value={selectedPrimaryModelOption}
                onChange={handlePrimaryModelChangeNew}
                isLoading={isLoading}
                isClearable
                isSearchable
                placeholder="-- Type or select a Model --"
                noOptionsMessage={() =>
                  !settings.primary_llm_provider
                    ? "Select a provider first"
                    : isLoading
                    ? "Loading models..."
                    : modelsError
                    ? "Could not load"
                    : "No models found"
                }
                isDisabled={isLoading || modelsError !== null || !settings.primary_llm_provider}
                className="react-select-container"
                classNamePrefix="react-select"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    backgroundColor: "#212529",
                    borderColor: state.isFocused ? "#f8f9fa" : "#343a40",
                    boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                    "&:hover": { borderColor: "#f8f9fa" },
                    minHeight: "42px",
                  }),
                  singleValue: (base) => ({ ...base, color: "white" }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: "#495057",
                    zIndex: 10,
                  }),
                  option: (base, { isFocused, isSelected }) => ({
                    ...base,
                    backgroundColor: isSelected
                      ? "#adb5bd"
                      : isFocused
                      ? "#dee2e6"
                      : "#495057",
                    color: isSelected || isFocused ? "#212529" : "#fff",
                    ":active": { backgroundColor: "#f8f9fa", color: "#212529" },
                  }),
                  placeholder: (base) => ({ ...base, color: "#9CA3AF" }),
                  input: (base) => ({ ...base, color: "white" }),
                  dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
                  clearIndicator: (base) => ({
                    ...base,
                    color: "#9CA3AF",
                    ":hover": { color: "white" },
                  }),
                  indicatorSeparator: (base) => ({
                    ...base,
                    backgroundColor: "#343a40",
                  }),
                }}
              />
            </div>
            <div>
              <label
                htmlFor="primary_llm_api_key_new"
                className="block text-sm font-medium text-app-text-2 mb-1"
              >
                Primary LLM API Key:
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  id="primary_llm_api_key_new"
                  name="primary_llm_api_key_new"
                  autoComplete="current-password"
                  value={settings.primary_llm_api_key_new || ""}
                  onChange={handlePrimaryApiKeyChangeNew}
                  disabled={isLoading}
                  placeholder="sk-or-... / sk-... / AIz..."
                  className="w-full p-2.5 bg-app-bg border border-app-border rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white focus:outline-none"
                  aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
                >
                  <span className="material-icons">
                    {showApiKey ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
            
            <ParameterSection
              temperature={settings.primary_llm_temperature}
              topP={settings.primary_llm_top_p}
              maxTokens={settings.primary_llm_max_tokens}
              reasoningEffort={settings.primary_llm_reasoning_effort || "Medium"}
              customPrompt={settings.primary_llm_custom_prompt || ""}
              onTemperatureChange={(value) => handlePrimaryParameterChange('primary_llm_temperature', value)}
              onTopPChange={(value) => handlePrimaryParameterChange('primary_llm_top_p', value)}
              onMaxTokensChange={(value) => handlePrimaryParameterChange('primary_llm_max_tokens', value || undefined)}
              onReasoningEffortChange={(value) => handlePrimaryParameterChange('primary_llm_reasoning_effort', value)}
              onCustomPromptChange={(value) => handlePrimaryParameterChange('primary_llm_custom_prompt', value)}
              {...getVisibleParameters(settings.primary_llm_provider)}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="space-y-6">
            <div className="p-4 bg-app-bg border border-gray-600 rounded-lg">
              <label className="flex items-center">
                <input 
                  type="checkbox" 
                  checked={settings.analysis_enabled || false}
                  onChange={(e) => handleAnalysisEnabledChange(e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-app-text font-medium">Enable Query Analysis</span>
                  <p className="text-sm text-app-text-secondary mt-1">
                    Uses Primary LLM to optimize queries. Auto-retry: 2 attempts, then skip if failed.
                  </p>
                </div>
              </label>
            </div>
            
            {settings.analysis_enabled && (
              <ParameterSection
                temperature={settings.analysis_llm_temperature}
                topP={settings.analysis_llm_top_p}
                maxTokens={settings.analysis_llm_max_tokens}
                reasoningEffort={settings.analysis_llm_reasoning_effort || "Medium"}
                customPrompt={settings.analysis_llm_custom_prompt || ""}
                onTemperatureChange={(value) => handleAnalysisParameterChange('analysis_llm_temperature', value)}
                onTopPChange={(value) => handleAnalysisParameterChange('analysis_llm_top_p', value)}
                onMaxTokensChange={(value) => handleAnalysisParameterChange('analysis_llm_max_tokens', value || undefined)}
                onReasoningEffortChange={(value) => handleAnalysisParameterChange('analysis_llm_reasoning_effort', value)}
                onCustomPromptChange={(value) => handleAnalysisParameterChange('analysis_llm_custom_prompt', value)}
                {...getVisibleParameters(settings.primary_llm_provider)}
                showMaxTokens={false}
                isLoading={isLoading}
              />
            )}
          </div>
        )}

        {activeTab === "maintenance" && (
          <div className="space-y-6">
            <div className="p-4 bg-app-bg border border-app-border rounded-lg">
              <label className="flex items-center">
                <input 
                  type="checkbox" 
                  checked={settings.maintenance_enabled || false}
                  onChange={(e) => handleMaintenanceEnabledChange(e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-app-text font-medium">Enable Memory Maintenance</span>
                  <p className="text-sm text-app-text-secondary mt-1">
                    Uses Primary LLM for memory updates. Auto-retry: 2 attempts, then skip if failed.
                  </p>
                </div>
              </label>
            </div>
            
            {settings.maintenance_enabled && (
              <ParameterSection
                temperature={settings.maintenance_llm_temperature}
                topP={settings.maintenance_llm_top_p}
                maxTokens={settings.maintenance_llm_max_tokens}
                reasoningEffort={settings.maintenance_llm_reasoning_effort || "Medium"}
                customPrompt={settings.maintenance_llm_custom_prompt || ""}
                onTemperatureChange={(value) => handleMaintenanceParameterChange('maintenance_llm_temperature', value)}
                onTopPChange={(value) => handleMaintenanceParameterChange('maintenance_llm_top_p', value)}
                onMaxTokensChange={(value) => handleMaintenanceParameterChange('maintenance_llm_max_tokens', value || undefined)}
                onReasoningEffortChange={(value) => handleMaintenanceParameterChange('maintenance_llm_reasoning_effort', value)}
                onCustomPromptChange={(value) => handleMaintenanceParameterChange('maintenance_llm_custom_prompt', value)}
                {...getVisibleParameters(settings.primary_llm_provider)}
                showMaxTokens={false}
                isLoading={isLoading}
              />
            )}
          </div>
        )}
        
        {activeTab === "embedding" && (
          <div className="space-y-6">
            <div className="p-4 bg-app-bg border border-gray-600 rounded-lg">
              <label className="flex items-center mb-4">
                <input
                  type="checkbox"
                  checked={settings.embedding_enabled || false}
                  onChange={(e) => handleEmbeddingEnabledChange(e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="text-app-text font-medium">Enable RAG with Vector Search</span>
                  <p className="text-sm text-app-text-secondary mt-1">
                    Uses separate Embedding API with rate limiting (1 req/sec). Requires dedicated API key.
                  </p>
                </div>
              </label>
            </div>
            
            {settings.embedding_enabled && (
              <>
                <div>
                  <label
                    htmlFor="embedding_llm_provider_input"
                    className="block text-sm font-medium text-app-text-2 mb-1"
                  >
                    Embedding LLM Provider:
                  </label>
                  <Select<SelectOption>
                    inputId="embedding_llm_provider_input"
                    options={providerOptions}
                    value={providerOptions.find(option => option.value === settings.embedding_llm_provider) || null}
                    onChange={handleEmbeddingProviderChange}
                    isLoading={isLoading}
                    isClearable
                    isSearchable
                    placeholder="-- Select a Provider --"
                    noOptionsMessage={() => "No providers found"}
                    isDisabled={isLoading}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        backgroundColor: "#212529",
                        borderColor: state.isFocused ? "#f8f9fa" : "#343a40",
                        boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                        "&:hover": { borderColor: "#f8f9fa" },
                        minHeight: "42px",
                      }),
                      singleValue: (base) => ({ ...base, color: "white" }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: "#495057",
                        zIndex: 10,
                      }),
                      option: (base, { isFocused, isSelected }) => ({
                        ...base,
                        backgroundColor: isSelected
                          ? "#adb5bd"
                          : isFocused
                          ? "#dee2e6"
                          : "#495057",
                        color: isSelected || isFocused ? "#212529" : "#fff",
                        ":active": { backgroundColor: "#f8f9fa", color: "#212529" },
                      }),
                      placeholder: (base) => ({ ...base, color: "#9CA3AF" }),
                      input: (base) => ({ ...base, color: "white" }),
                      dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
                      clearIndicator: (base) => ({
                        ...base,
                        color: "#9CA3AF",
                        ":hover": { color: "white" },
                      }),
                      indicatorSeparator: (base) => ({
                        ...base,
                        backgroundColor: "#343a40",
                      }),
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="embedding_llm_model_input"
                    className="block text-sm font-medium text-app-text-2 mb-1"
                  >
                    Embedding LLM Model:
                  </label>
                  <Select<SelectOption>
                    inputId="embedding_llm_model_input"
                    options={embeddingModelOptions}
                    value={selectedEmbeddingModelOption}
                    onChange={handleEmbeddingModelChange}
                    isLoading={isLoading}
                    isClearable
                    isSearchable
                    placeholder="-- Type or select an Embedding Model --"
                    noOptionsMessage={() =>
                      !settings.embedding_llm_provider
                        ? "Select a provider first"
                        : isLoading
                        ? "Loading models..."
                        : modelsError
                        ? "Could not load"
                        : "No models found"
                    }
                    isDisabled={isLoading || modelsError !== null || !settings.embedding_llm_provider}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        backgroundColor: "#212529",
                        borderColor: state.isFocused ? "#f8f9fa" : "#343a40",
                        boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                        "&:hover": { borderColor: "#f8f9fa" },
                        minHeight: "42px",
                      }),
                      singleValue: (base) => ({ ...base, color: "white" }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: "#495057",
                        zIndex: 10,
                      }),
                      option: (base, { isFocused, isSelected }) => ({
                        ...base,
                        backgroundColor: isSelected
                          ? "#adb5bd"
                          : isFocused
                          ? "#dee2e6"
                          : "#495057",
                        color: isSelected || isFocused ? "#212529" : "#fff",
                        ":active": { backgroundColor: "#f8f9fa", color: "#212529" },
                      }),
                      placeholder: (base) => ({ ...base, color: "#9CA3AF" }),
                      input: (base) => ({ ...base, color: "white" }),
                      dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
                      clearIndicator: (base) => ({
                        ...base,
                        color: "#9CA3AF",
                        ":hover": { color: "white" },
                      }),
                      indicatorSeparator: (base) => ({
                        ...base,
                        backgroundColor: "#343a40",
                      }),
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="embedding_llm_api_key"
                    className="block text-sm font-medium text-app-text-2 mb-1"
                  >
                    Embedding LLM API Key:
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      id="embedding_llm_api_key"
                      name="embedding_llm_api_key"
                      autoComplete="current-password"
                      value={settings.embedding_llm_api_key || ""}
                      onChange={handleEmbeddingApiKeyChange}
                      disabled={isLoading}
                      placeholder="sk-or-... / sk-... / AIz..."
                      className="w-full p-2.5 bg-app-bg border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white focus:outline-none"
                      aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
                    >
                      <span className="material-icons">
                        {showApiKey ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full mt-2 px-4 py-2.5 text-sm text-app-surface bg-app-text-2 hover:bg-app-text-3 rounded-md font-medium disabled:bg-gray-700 disabled:opacity-70 transition-colors"
        >
          {isSubmitting ? "Saving..." : "Save Settings"}
        </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
