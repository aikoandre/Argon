// frontend/src/pages/SettingsPage.tsx
import React, { useState, useEffect, useMemo, type FormEvent } from 'react'; // Adicionado useMemo
// Importe o componente Select
import Select from 'react-select';
import { getUserSettings, updateUserSettings, getLLMModels, type LLMModelData } from '../services/api';
import type { UserSettingsUpdateData } from '../types/settings';

// Interface para os modelos *depois* de formatados para react-select
interface SelectOption {
  value: string; // Corresponde ao model ID
  label: string; // Nome para exibição (e busca)
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettingsUpdateData>({
    selected_llm_model: '',
    openrouter_api_key: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [availableModels, setAvailableModels] = useState<LLMModelData[]>([]); // Mantém o formato original da API
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Formata os modelos para react-select, usando useMemo para evitar recálculo desnecessário
  const modelOptions = useMemo((): SelectOption[] => {
    return availableModels.map(model => ({
      value: model.id,
      label: `${model.name || model.id} (${model.id})` // Label mais descritivo
    }));
  }, [availableModels]);

  // Encontra o objeto de opção selecionado com base no ID armazenado no estado 'settings'
  const selectedModelOption = useMemo((): SelectOption | null => {
    return modelOptions.find(option => option.value === settings.selected_llm_model) || null;
  }, [modelOptions, settings.selected_llm_model]);


  useEffect(() => {
    // ... (lógica fetchInitialData permanece a mesma, mas agora atualiza setAvailableModels com dados da API) ...
    const fetchInitialData = async () => {
        setIsLoading(true);
        setModelsLoading(true);
        setError(null);
        setModelsError(null);

        try {
          const [settingsData, modelsDataFromApi] = await Promise.all([ // Renomeado para clareza
            getUserSettings(),
            getLLMModels()
          ]);

          if (settingsData) {
            setSettings({
              selected_llm_model: settingsData.selected_llm_model || '',
              openrouter_api_key: settingsData.openrouter_api_key || '',
            });
          } else {
            setSettings({ selected_llm_model: '', openrouter_api_key: '' });
          }

          setAvailableModels(modelsDataFromApi); // Armazena os dados brutos da API

        } catch (err: any) {
          const errorMessage = err.response?.data?.detail || err.message || 'Failed to load initial data.';
          if (err.config?.url?.includes('/llm/models')) {
              setModelsError(errorMessage);
          } else {
              setError(errorMessage);
          }
          console.error("Failed to load initial data", err);
        } finally {
          setIsLoading(false);
          setModelsLoading(false);
        }
      };

      fetchInitialData();
  }, []);

  // O handleChange agora não é usado diretamente pelo react-select
  // O onChange do react-select será tratado por handleModelChange

  // Novo handler para a mudança no react-select
  const handleModelChange = (selectedOption: SelectOption | null) => {
    setSettings(prev => ({
      ...prev,
      // Define o ID do modelo ou null/'' se nada for selecionado
      selected_llm_model: selectedOption ? selectedOption.value : ''
    }));
    setSuccessMessage(null);
    setError(null);
  };

    // Handler para a mudança da API Key (o handleChange original pode ser adaptado)
    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
        setSuccessMessage(null);
        setError(null);
      };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // setIsLoading(true); // Talvez um isSaving
    setError(null);
    setSuccessMessage(null);
    try {
      await updateUserSettings(settings);
      setSuccessMessage('Settings updated successfully!');
    } catch (err) {
      setError('Failed to update settings.');
      console.error(err);
    } finally {
      // setIsLoading(false);
    }
  };

  if (isLoading || modelsLoading) {
       return <p>Loading data...</p>;
  }

  return (
    <div>
      <h1>Application Settings</h1>
      {error && <p style={{ color: 'red' }}>Error loading settings: {error}</p>}
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

      <form onSubmit={handleSubmit}>
        {/* Substitui o <select> por <Select> */}
        <div style={{ marginBottom: '10px' }}> {/* Adicionado margin */}
          <label htmlFor="selected_llm_model_input">Selected LLM Model:</label> {/* Mudei htmlFor pois o id do input interno será diferente */}
          {modelsError && <p style={{ color: 'red' }}>Error loading models: {modelsError}</p>}
          <Select<SelectOption> // Tipagem explícita (opcional)
            inputId="selected_llm_model_input" // ID para o input interno acessível pelo label
            options={modelOptions}
            value={selectedModelOption} // Passa o objeto selecionado
            onChange={handleModelChange} // Usa o novo handler
            isLoading={modelsLoading}
            isClearable // Permite limpar a seleção
            isSearchable // Permite digitar para buscar (padrão, mas explícito)
            placeholder="-- Type or select a Model --"
            noOptionsMessage={() => modelsLoading ? 'Loading...' : 'No models found'}
            isDisabled={isLoading || modelsError !== null} // Desabilita se erro ao carregar modelos
            styles={{ // Exemplo de como ajustar estilos (opcional)
              container: (base) => ({ ...base, width: '300px', color: '#333' })
            }}
          />
        </div>

        <div style={{ marginTop: '10px' }}>
          <label htmlFor="openrouter_api_key">OpenRouter API Key:</label>
          <input
            type="password"
            id="openrouter_api_key"
            name="openrouter_api_key"
            value={settings.openrouter_api_key || ''}
            onChange={handleApiKeyChange} // Usa handler separado para o input
            disabled={isLoading}
            placeholder="sk-or-..."
            style={{ width: '290px', padding: '8px', marginTop: '5px' }} // Estilo exemplo
          />
        </div>
        <button type="submit" disabled={isLoading} style={{ marginTop: '20px' }}>
          Save Settings
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;
