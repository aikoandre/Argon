// frontend/src/pages/SettingsPage.tsx
import React, { useState, useEffect, useMemo, type FormEvent } from "react";
import Select, { type SingleValue } from "react-select"; // MultiValue não é necessário aqui
import {
  getUserSettings,
  updateUserSettings,
  getLLMModels,
  type LLMModelData,
} from "../services/api";
import type { UserSettingsUpdateData } from "../types/settings";

interface SelectOption {
  value: string;
  label: string;
  provider?: string; // Add provider property
  isDisabled?: boolean; // Add isDisabled property
}

const SettingsPage: React.FC = () => {  const [settings, setSettings] = useState<UserSettingsUpdateData>({
    selected_llm_model: "",
    primary_llm_api_key: "",
    analysis_llm_api_key: "",
    mistral_api_key: "",
    analysis_llm_model: "",
    
    // New LiteLLM provider-based fields
    primary_llm_provider: "",
    primary_llm_model: "",
    primary_llm_api_key_new: "",
    
    analysis_llm_provider: "",
    analysis_llm_model_new: "",
    analysis_llm_api_key_new: "",
    
    maintenance_llm_provider: "",
    maintenance_llm_model: "",
    maintenance_llm_api_key: "",
    
    embedding_llm_provider: "",
    embedding_llm_model: "",
    embedding_llm_api_key: "",
  });
  const [activeTab, setActiveTab] = useState<string>("primary"); // New state for active tab
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Primary LLM model options
  const primaryModelOptions = useMemo((): SelectOption[] => {
    return createModelOptionsForProvider(settings.primary_llm_provider);
  }, [availableModels, settings.primary_llm_provider]);

  const selectedPrimaryModelOption = useMemo((): SelectOption | null => {
    return primaryModelOptions.find(option => option.value === settings.primary_llm_model) || null;
  }, [primaryModelOptions, settings.primary_llm_model]);

  // Analysis LLM model options
  const analysisModelOptions = useMemo((): SelectOption[] => {
    return createModelOptionsForProvider(settings.analysis_llm_provider);
  }, [availableModels, settings.analysis_llm_provider]);

  const selectedAnalysisModelOption = useMemo((): SelectOption | null => {
    return analysisModelOptions.find(option => option.value === settings.analysis_llm_model_new) || null;
  }, [analysisModelOptions, settings.analysis_llm_model_new]);

  // Maintenance LLM model options
  const maintenanceModelOptions = useMemo((): SelectOption[] => {
    return createModelOptionsForProvider(settings.maintenance_llm_provider);
  }, [availableModels, settings.maintenance_llm_provider]);

  const selectedMaintenanceModelOption = useMemo((): SelectOption | null => {
    return maintenanceModelOptions.find(option => option.value === settings.maintenance_llm_model) || null;
  }, [maintenanceModelOptions, settings.maintenance_llm_model]);

  // Embedding LLM model options
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
        ]);        if (settingsData) {
          setSettings({
            selected_llm_model: settingsData.selected_llm_model || "",
            primary_llm_api_key: settingsData.primary_llm_api_key || "",
            analysis_llm_api_key: settingsData.analysis_llm_api_key || "",
            mistral_api_key: settingsData.mistral_api_key || "",
            analysis_llm_model: settingsData.analysis_llm_model || "",
            
            // New LiteLLM provider-based fields
            primary_llm_provider: settingsData.primary_llm_provider || "",
            primary_llm_model: settingsData.primary_llm_model || "",
            primary_llm_api_key_new: settingsData.primary_llm_api_key_new || "",
            
            analysis_llm_provider: settingsData.analysis_llm_provider || "",
            analysis_llm_model_new: settingsData.analysis_llm_model_new || "",
            analysis_llm_api_key_new: settingsData.analysis_llm_api_key_new || "",
            
            maintenance_llm_provider: settingsData.maintenance_llm_provider || "",
            maintenance_llm_model: settingsData.maintenance_llm_model || "",
            maintenance_llm_api_key: settingsData.maintenance_llm_api_key || "",
            
            embedding_llm_provider: settingsData.embedding_llm_provider || "",
            embedding_llm_model: settingsData.embedding_llm_model || "",
            embedding_llm_api_key: settingsData.embedding_llm_api_key || "",
          });        } else {
          setSettings({
            selected_llm_model: "",
            primary_llm_api_key: "",
            analysis_llm_api_key: "",
            mistral_api_key: "",
            analysis_llm_model: "",
            
            // New LiteLLM provider-based fields
            primary_llm_provider: "",
            primary_llm_model: "",
            primary_llm_api_key_new: "",
            
            analysis_llm_provider: "",
            analysis_llm_model_new: "",
            analysis_llm_api_key_new: "",
            
            maintenance_llm_provider: "",
            maintenance_llm_model: "",
            maintenance_llm_api_key: "",
            
            embedding_llm_provider: "",
            embedding_llm_model: "",
            embedding_llm_api_key: "",
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


  // New LiteLLM provider change handlers
  const handlePrimaryProviderChange = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      primary_llm_provider: selectedOption ? selectedOption.value : "",
      primary_llm_model: "", // Reset model when provider changes
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handlePrimaryModelChangeNew = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      primary_llm_model: selectedOption ? selectedOption.value : "",
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handlePrimaryApiKeyChangeNew = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      primary_llm_api_key_new: e.target.value,
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleAnalysisProviderChange = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      analysis_llm_provider: selectedOption ? selectedOption.value : "",
      analysis_llm_model_new: "", // Reset model when provider changes
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleAnalysisModelChangeNew = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      analysis_llm_model_new: selectedOption ? selectedOption.value : "",
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleAnalysisApiKeyChangeNew = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      analysis_llm_api_key_new: e.target.value,
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleMaintenanceProviderChange = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      maintenance_llm_provider: selectedOption ? selectedOption.value : "",
      maintenance_llm_model: "", // Reset model when provider changes
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleMaintenanceModelChange = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      maintenance_llm_model: selectedOption ? selectedOption.value : "",
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleMaintenanceApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      maintenance_llm_api_key: e.target.value,
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleEmbeddingProviderChange = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      embedding_llm_provider: selectedOption ? selectedOption.value : "",
      embedding_llm_model: "", // Reset model when provider changes
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleEmbeddingModelChange = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      embedding_llm_model: selectedOption ? selectedOption.value : "",
    }));
    setSuccessMessage(null);
    setError(null);
  };  const handleEmbeddingApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      embedding_llm_api_key: e.target.value,
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); // Inicia o estado de submissão
    setError(null);
    setSuccessMessage(null);
    try {
      await updateUserSettings(settings);
      setSuccessMessage("Settings updated successfully!");
    } catch (err) {
      setError("Failed to update settings.");
      console.error(err);
    } finally {
      setIsSubmitting(false); // Finaliza o estado de submissão
    }
  };

  if (isLoading) {
    // Um único loading para os dados iniciais
    return (
      <p className="text-center text-gray-400 p-10">Loading settings...</p>
    );
  }

  return (
    <div className="text-white">
      <h1 className="text-4xl font-bold text-white font-quintessential mb-8">
        Application Settings
      </h1>
      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="bg-green-700 text-white p-3 rounded-md mb-4 text-center">
          {successMessage}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-lg mx-auto">        <div className="flex justify-between border-b border-gray-700 mb-6">
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
        </div>{activeTab === "primary" && (
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
                    backgroundColor: "#343a40",
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
                    backgroundColor: "#343a40",
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
                  className="w-full p-2.5 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 pr-10"
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
          </div>        )}

        {activeTab === "analysis" && (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="analysis_llm_provider_input"
                className="block text-sm font-medium text-app-text-2 mb-1"
              >
                Analysis LLM Provider:
              </label>
              <Select<SelectOption>
                inputId="analysis_llm_provider_input"
                options={providerOptions}
                value={providerOptions.find(option => option.value === settings.analysis_llm_provider) || null}
                onChange={handleAnalysisProviderChange}
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
                    backgroundColor: "#343a40",
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
                htmlFor="analysis_llm_model_input"
                className="block text-sm font-medium text-app-text-2 mb-1"
              >
                Analysis LLM Model:
              </label>
              <Select<SelectOption>
                inputId="analysis_llm_model_input"
                options={analysisModelOptions}
                value={selectedAnalysisModelOption}
                onChange={handleAnalysisModelChangeNew}
                isLoading={isLoading}
                isClearable
                isSearchable
                placeholder="-- Type or select an Analysis Model --"
                noOptionsMessage={() =>
                  !settings.analysis_llm_provider
                    ? "Select a provider first"
                    : isLoading
                    ? "Loading models..."
                    : modelsError
                    ? "Could not load"
                    : "No models found"
                }
                isDisabled={isLoading || modelsError !== null || !settings.analysis_llm_provider}
                className="react-select-container"
                classNamePrefix="react-select"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    backgroundColor: "#343a40",
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
                htmlFor="analysis_llm_api_key_new"
                className="block text-sm font-medium text-app-text-2 mb-1"
              >
                Analysis LLM API Key:
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  id="analysis_llm_api_key_new"
                  name="analysis_llm_api_key_new"
                  autoComplete="current-password"
                  value={settings.analysis_llm_api_key_new || ""}
                  onChange={handleAnalysisApiKeyChangeNew}
                  disabled={isLoading}
                  placeholder="sk-or-... / sk-... / AIz..."
                  className="w-full p-2.5 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 pr-10"
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
          </div>        )}

        {activeTab === "maintenance" && (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="maintenance_llm_provider_input"
                className="block text-sm font-medium text-app-text-2 mb-1"
              >
                Maintenance LLM Provider:
              </label>
              <Select<SelectOption>
                inputId="maintenance_llm_provider_input"
                options={providerOptions}
                value={providerOptions.find(option => option.value === settings.maintenance_llm_provider) || null}
                onChange={handleMaintenanceProviderChange}
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
                    backgroundColor: "#343a40",
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
                htmlFor="maintenance_llm_model_input"
                className="block text-sm font-medium text-app-text-2 mb-1"
              >
                Maintenance LLM Model:
              </label>
              <Select<SelectOption>
                inputId="maintenance_llm_model_input"
                options={maintenanceModelOptions}
                value={selectedMaintenanceModelOption}
                onChange={handleMaintenanceModelChange}
                isLoading={isLoading}
                isClearable
                isSearchable
                placeholder="-- Type or select a Maintenance Model --"
                noOptionsMessage={() =>
                  !settings.maintenance_llm_provider
                    ? "Select a provider first"
                    : isLoading
                    ? "Loading models..."
                    : modelsError
                    ? "Could not load"
                    : "No models found"
                }
                isDisabled={isLoading || modelsError !== null || !settings.maintenance_llm_provider}
                className="react-select-container"
                classNamePrefix="react-select"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    backgroundColor: "#343a40",
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
                htmlFor="maintenance_llm_api_key"
                className="block text-sm font-medium text-app-text-2 mb-1"
              >
                Maintenance LLM API Key:
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  id="maintenance_llm_api_key"
                  name="maintenance_llm_api_key"
                  autoComplete="current-password"
                  value={settings.maintenance_llm_api_key || ""}
                  onChange={handleMaintenanceApiKeyChange}
                  disabled={isLoading}
                  placeholder="sk-or-... / sk-... / AIz..."
                  className="w-full p-2.5 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 pr-10"
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
          </div>
        )}        {activeTab === "embedding" && (
          <div className="space-y-6">
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
                    backgroundColor: "#343a40",
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
                    backgroundColor: "#343a40",
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
                  className="w-full p-2.5 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 pr-10"
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
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full mt-2 px-4 py-2.5 text-sm text-app-surface bg-app-text-2 hover:bg-app-text-3 rounded-md font-medium disabled:bg-gray-700 disabled:opacity-70 transition-colors"
        >
          {isSubmitting ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;
