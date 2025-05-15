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
    openrouter_api_key: "",
  });
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
      label: `${model.name || model.id} (${model.id.split("/").pop()})`, // Mostra apenas o nome do modelo após a última /
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
            openrouter_api_key: settingsData.openrouter_api_key || "",
          });
        } else {
          setSettings({ selected_llm_model: "", openrouter_api_key: "" });
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
    /* ... como antes ... */
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
    // Ajuste max-w- para controlar a largura do conteúdo centralizado
    <div className="container mx-auto py-12 px-4 flex flex-col items-center min-h-[calc(100vh-var(--nav-height,80px))]">
      {" "}
      {/* Ajuste --nav-height */}
      <div className="w-full max-w-lg bg-gray-800 p-8 rounded-xl shadow-2xl">
        {" "}
        {/* Card para o formulário */}
        <h1 className="text-3xl font-bold mb-8 text-center text-white">
          Application Settings
        </h1>
        {/* Exibe o erro geral do carregamento inicial, se houver */}
        {!isLoading && error && !modelsError && (
          <p className="text-red-500 mb-4 text-center">{error}</p>
        )}
        {successMessage && (
          <p className="text-green-500 mb-6 text-center">{successMessage}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {" "}
          {/* Adicionado space-y-6 */}
          <div>
            <label
              htmlFor="selected_llm_model_input"
              className="block text-sm font-medium text-gray-300 mb-1"
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
              isLoading={isLoading} // isLoading cobre o carregamento de modelos agora
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
              className="react-select-container" // Classe para estilização global se necessário
              classNamePrefix="react-select" // Para estilização interna
              styles={{
                // Estilos para tema escuro (ajuste as cores)
                control: (base, state) => ({
                  ...base,
                  backgroundColor: "#1F2937", // bg-gray-800
                  borderColor: state.isFocused ? "#3B82F6" : "#4B5563", // border-blue-500 (focus), border-gray-600
                  boxShadow: state.isFocused ? "0 0 0 1px #3B82F6" : "none",
                  "&:hover": { borderColor: "#6B7280" }, // border-gray-500 (hover)
                  minHeight: "42px", // Para alinhar com inputs padrão
                }),
                singleValue: (base) => ({ ...base, color: "white" }),
                menu: (base) => ({
                  ...base,
                  backgroundColor: "#1F2937",
                  zIndex: 10,
                }),
                option: (base, { isFocused, isSelected }) => ({
                  ...base,
                  backgroundColor: isSelected
                    ? "#3B82F6"
                    : isFocused
                    ? "#374151"
                    : "#1F2937", // bg-blue-600 (selected), bg-gray-700 (focus)
                  color: "white",
                  ":active": { backgroundColor: "#2563EB" }, // bg-blue-700 (active)
                }),
                placeholder: (base) => ({ ...base, color: "#9CA3AF" }), // text-gray-400
                input: (base) => ({ ...base, color: "white" }),
                dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
                clearIndicator: (base) => ({
                  ...base,
                  color: "#9CA3AF",
                  ":hover": { color: "white" },
                }),
                indicatorSeparator: (base) => ({
                  ...base,
                  backgroundColor: "#4B5563",
                }),
              }}
            />
          </div>
          <div>
            {" "}
            {/* Removido mt-4, space-y-6 no form cuida disso */}
            <label
              htmlFor="openrouter_api_key"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              OpenRouter API Key:
            </label>
            <input
              type="password"
              id="openrouter_api_key"
              name="openrouter_api_key"
              autoComplete="current-password" // Sugestão para campos de senha
              value={settings.openrouter_api_key || ""}
              onChange={handleApiKeyChange}
              disabled={isLoading} // Desabilita se estiver carregando settings iniciais
              placeholder="sk-or-..."
              className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400" // Ajustei padding para p-2.5
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || isLoading} // Desabilita também durante carregamento inicial
            className="w-full mt-2 px-4 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium disabled:bg-gray-700 disabled:opacity-70 transition-colors"
          >
            {isSubmitting ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
