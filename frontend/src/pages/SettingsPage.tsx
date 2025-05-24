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
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettingsUpdateData>({
    selected_llm_model: "",
    llm_api_key: "",
  });
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Carregamento inicial de settings e modelos
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // Para o botão Save
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [availableModels, setAvailableModels] = useState<LLMModelData[]>([]);
  // modelsLoading foi fundido com isLoading, já que ambos são carregados inicialmente
  // const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const modelOptions = useMemo((): SelectOption[] => {
    /* ... como antes ... */
    return availableModels.map((model) => ({
      value: model.id,
      label: model.name || model.id, // Mostra apenas o nome do modelo
    }));
  }, [availableModels]);

  const selectedModelOption = useMemo((): SelectOption | null => {
    /* ... como antes ... */
    return (
      modelOptions.find(
        (option) => option.value === settings.selected_llm_model
      ) || null
    );
  }, [modelOptions, settings.selected_llm_model]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true); // Único estado de loading para dados iniciais
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
            llm_api_key: settingsData.llm_api_key || "",
          });
        } else {
          setSettings({ selected_llm_model: "", llm_api_key: "" });
        }
        setAvailableModels(modelsDataFromApi);
      } catch (err: any) {
        /* ... tratamento de erro como antes ... */
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const handleModelChange = (selectedOption: SingleValue<SelectOption>) => {
    // SingleValue
    setSettings((prev) => ({
      ...prev,
      selected_llm_model: selectedOption ? selectedOption.value : "",
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      llm_api_key: e.target.value,
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
        <div>
          <label
            htmlFor="selected_llm_model_input"
            className="block text-sm font-medium text-app-accent-2 mb-1"
          >
            Selected LLM Model:
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
                backgroundColor: "#343a40", // bg-app-surface
                borderColor: state.isFocused ? "#f8f9fa" : "#343a40", // border-app-accent-2 (focus), bg-app-surface
                boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                "&:hover": { borderColor: "#f8f9fa" },
                minHeight: "42px",
              }),
              singleValue: (base) => ({ ...base, color: "white" }),
              menu: (base) => ({
                ...base,
                backgroundColor: "#495057", // bg-app-surface-2
                zIndex: 10,
              }),
              option: (base, { isFocused, isSelected }) => ({
                ...base,
                backgroundColor: isSelected
                  ? "#adb5bd" // bg-app-accent-2
                  : isFocused
                  ? "#dee2e6" // bg-app-accent-3
                  : "#495057", // bg-app-surface-2
                color: isSelected || isFocused ? "#212529" : "#fff", // text-app-surface
                ":active": { backgroundColor: "#f8f9fa", color: "#212529" }, // bg-app-accent
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
                backgroundColor: "#343a40", // bg-app-surface
              }),
            }}
          />
        </div>
        <div>
          <label
            htmlFor="llm_api_key"
            className="block text-sm font-medium text-app-accent-2 mb-1"
          >
            LLM API Key:
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              id="llm_api_key"
              name="llm_api_key"
              autoComplete="current-password"
              value={settings.llm_api_key || ""}
              onChange={handleApiKeyChange}
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
