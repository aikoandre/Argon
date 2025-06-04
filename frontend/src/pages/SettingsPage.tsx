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

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettingsUpdateData>({
    selected_llm_model: "",
    primary_llm_api_key: "",
    extraction_llm_api_key: "",
    analysis_llm_api_key: "",
    mistral_api_key: "",
    extraction_llm_model: "",
    analysis_llm_model: "",
  });
  const [activeTab, setActiveTab] = useState<string>("primary"); // New state for active tab
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [availableModels, setAvailableModels] = useState<LLMModelData[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const modelOptions = useMemo((): SelectOption[] => {
    const groupedOptions: SelectOption[] = [];
    const openRouterModels = availableModels.filter(model => model.provider === "OpenRouter");
    const mistralModels = availableModels.filter(model => model.provider === "Mistral");

    if (openRouterModels.length > 0) {
      groupedOptions.push({ value: "OpenRouter-Header", label: "--- OpenRouter Models ---", isDisabled: true });
      openRouterModels.forEach(model => {
        groupedOptions.push({ value: model.id, label: model.name || model.id, provider: model.provider });
      });
    }

    if (mistralModels.length > 0) {
      groupedOptions.push({ value: "Mistral-Header", label: "--- Mistral Models ---", isDisabled: true });
      mistralModels.forEach(model => {
        groupedOptions.push({ value: model.id, label: model.name || model.id, provider: model.provider });
      });
    }

    return groupedOptions;
  }, [availableModels]);

  const selectedModelOption = useMemo((): SelectOption | null => {
    return (
      modelOptions.find(
        (option) => option.value === settings.selected_llm_model && !option.isDisabled
      ) || null
    );
  }, [modelOptions, settings.selected_llm_model]);

  const extractionModelOptions = useMemo((): SelectOption[] => {
    const openRouterModels = availableModels.filter(model => model.provider === "OpenRouter");
    const groupedOptions: SelectOption[] = [];

    if (openRouterModels.length > 0) {
      groupedOptions.push({ value: "OpenRouter-Header", label: "--- OpenRouter Models ---", isDisabled: true });
      openRouterModels.forEach(model => {
        groupedOptions.push({ value: model.id, label: model.name || model.id, provider: model.provider });
      });
    }
    return groupedOptions;
  }, [availableModels]);

  const selectedExtractionModelOption = useMemo((): SelectOption | null => {
    return (
      extractionModelOptions.find(
        (option) => option.value === settings.extraction_llm_model && !option.isDisabled
      ) || null
    );
  }, [extractionModelOptions, settings.extraction_llm_model]);

  const analysisModelOptions = useMemo((): SelectOption[] => {
    const openRouterModels = availableModels.filter(model => model.provider === "OpenRouter");
    const groupedOptions: SelectOption[] = [];

    if (openRouterModels.length > 0) {
      groupedOptions.push({ value: "OpenRouter-Header", label: "--- OpenRouter Models ---", isDisabled: true });
      openRouterModels.forEach(model => {
        groupedOptions.push({ value: model.id, label: model.name || model.id, provider: model.provider });
      });
    }
    return groupedOptions;
  }, [availableModels]);

  const selectedAnalysisModelOption = useMemo((): SelectOption | null => {
    return (
      analysisModelOptions.find(
        (option) => option.value === settings.analysis_llm_model && !option.isDisabled
      ) || null
    );
  }, [analysisModelOptions, settings.analysis_llm_model]);

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
            selected_llm_model: settingsData.selected_llm_model || "",
            primary_llm_api_key: settingsData.primary_llm_api_key || "",
            extraction_llm_api_key: settingsData.extraction_llm_api_key || "",
            analysis_llm_api_key: settingsData.analysis_llm_api_key || "",
            mistral_api_key: settingsData.mistral_api_key || "",
            extraction_llm_model: settingsData.extraction_llm_model || "",
            analysis_llm_model: settingsData.analysis_llm_model || "",
          });
        } else {
          setSettings({
            selected_llm_model: "",
            primary_llm_api_key: "",
            extraction_llm_api_key: "",
            analysis_llm_api_key: "",
            mistral_api_key: "",
            extraction_llm_model: "",
            analysis_llm_model: "",
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

  const handleModelChange = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      selected_llm_model: selectedOption ? selectedOption.value : "",
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleExtractionModelChange = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      extraction_llm_model: selectedOption ? selectedOption.value : "",
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleAnalysisModelChange = (selectedOption: SingleValue<SelectOption>) => {
    setSettings((prev) => ({
      ...prev,
      analysis_llm_model: selectedOption ? selectedOption.value : "",
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handlePrimaryApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      primary_llm_api_key: e.target.value,
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleExtractionApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      extraction_llm_api_key: e.target.value,
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleAnalysisApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      analysis_llm_api_key: e.target.value,
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleMistralApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      mistral_api_key: e.target.value,
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
    <div className="container p-4 md:p-8 text-white">
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
      <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-lg mx-auto">
        <div className="flex border-b border-gray-700 mb-6">
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "primary"
                ? "border-b-2 border-app-accent-2 text-app-accent-2"
                : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("primary")}
          >
            Primary
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "extraction"
                ? "border-b-2 border-app-accent-2 text-app-accent-2"
                : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("extraction")}
          >
            Extraction
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "analysis"
                ? "border-b-2 border-app-accent-2 text-app-accent-2"
                : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("analysis")}
          >
            Analysis
          </button>
          <button
            type="button"
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === "embedding"
                ? "border-b-2 border-app-accent-2 text-app-accent-2"
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
                htmlFor="selected_llm_model_input"
                className="block text-sm font-medium text-app-accent-2 mb-1"
              >
                Primary LLM Model:
              </label>
              {modelsError && (
                <p className="text-red-400 text-xs mt-1">
                  Error loading models: {modelsError}
                </p>
              )}
              <Select<SelectOption>
                inputId="selected_llm_model_input"
                options={modelOptions}
                value={selectedModelOption}
                onChange={handleModelChange}
                isLoading={isLoading}
                isClearable
                isSearchable
                placeholder="-- Type or select a Model --"
                noOptionsMessage={() =>
                  isLoading
                    ? "Loading models..."
                    : modelsError
                    ? "Could not load"
                    : "No models found"
                }
                isDisabled={isLoading || modelsError !== null}
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
                htmlFor="primary_llm_api_key"
                className="block text-sm font-medium text-app-accent-2 mb-1"
              >
                Primary LLM API Key:
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  id="primary_llm_api_key"
                  name="primary_llm_api_key"
                  autoComplete="current-password"
                  value={settings.primary_llm_api_key || ""}
                  onChange={handlePrimaryApiKeyChange}
                  disabled={isLoading}
                  placeholder="sk-or-..."
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

        {activeTab === "extraction" && (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="extraction_llm_model_input"
                className="block text-sm font-medium text-app-accent-2 mb-1"
              >
                Extraction LLM Model (OpenRouter):
              </label>
              <Select<SelectOption>
                inputId="extraction_llm_model_input"
                options={extractionModelOptions}
                value={selectedExtractionModelOption}
                onChange={handleExtractionModelChange}
                isLoading={isLoading}
                isClearable
                isSearchable
                placeholder="-- Type or select an Extraction Model --"
                noOptionsMessage={() =>
                  isLoading
                    ? "Loading models..."
                    : modelsError
                    ? "Could not load"
                    : "No models found"
                }
                isDisabled={isLoading || modelsError !== null}
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
                htmlFor="extraction_llm_api_key"
                className="block text-sm font-medium text-app-accent-2 mb-1"
              >
                Extraction LLM API Key:
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  id="extraction_llm_api_key"
                  name="extraction_llm_api_key"
                  autoComplete="current-password"
                  value={settings.extraction_llm_api_key || ""}
                  onChange={handleExtractionApiKeyChange}
                  disabled={isLoading}
                  placeholder="sk-or-..."
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

        {activeTab === "analysis" && (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="analysis_llm_model_input"
                className="block text-sm font-medium text-app-accent-2 mb-1"
              >
                Analysis LLM Model (OpenRouter):
              </label>
              <Select<SelectOption>
                inputId="analysis_llm_model_input"
                options={analysisModelOptions}
                value={selectedAnalysisModelOption}
                onChange={handleAnalysisModelChange}
                isLoading={isLoading}
                isClearable
                isSearchable
                placeholder="-- Type or select an Analysis Model --"
                noOptionsMessage={() =>
                  isLoading
                    ? "Loading models..."
                    : modelsError
                    ? "Could not load"
                    : "No models found"
                }
                isDisabled={isLoading || modelsError !== null}
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
                htmlFor="analysis_llm_api_key"
                className="block text-sm font-medium text-app-accent-2 mb-1"
              >
                Analysis LLM API Key:
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  id="analysis_llm_api_key"
                  name="analysis_llm_api_key"
                  autoComplete="current-password"
                  value={settings.analysis_llm_api_key || ""}
                  onChange={handleAnalysisApiKeyChange}
                  disabled={isLoading}
                  placeholder="sk-or-..."
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

        {activeTab === "embedding" && (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="embedding_llm_model_input"
                className="block text-sm font-medium text-app-accent-2 mb-1"
              >
                Embedding LLM Model:
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="embedding_llm_model_input"
                  name="embedding_llm_model_input"
                  value="Mistral Embed"
                  disabled
                  className="w-full p-2.5 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 pr-10"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="mistral_api_key"
                className="block text-sm font-medium text-app-accent-2 mb-1"
              >
                Mistral AI API Key (for Embedding Model):
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  id="mistral_api_key"
                  name="mistral_api_key"
                  autoComplete="current-password"
                  value={settings.mistral_api_key || ""}
                  onChange={handleMistralApiKeyChange}
                  disabled={isLoading}
                  placeholder="sk-..."
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
          className="w-full mt-2 px-4 py-2.5 text-sm text-app-surface bg-app-accent-2 hover:bg-app-accent-3 rounded-md font-medium disabled:bg-gray-700 disabled:opacity-70 transition-colors"
        >
          {isSubmitting ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;
