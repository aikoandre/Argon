// frontend/src/pages/ScenariosPageContext.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  createOrGetCardChat,
  getAllScenarioCards,
  deleteScenarioCard,
  getAllMasterWorlds,
  updateScenarioCard,
  type MasterWorldData,
  type ScenarioCardData,
} from "../services/api";
import { CardImage } from '../components/CardImage';
import { LeftPanelImage } from '../components/Layout';
import { createPNGWithEmbeddedData } from '../utils/pngExport';
import { scenarioToFormData } from '../utils/formDataHelpers';
import { useLayout } from '../contexts/LayoutContext';
import { useInstantAutoSave } from '../hooks/useInstantAutoSave';
import ScenarioEditPanel from '../components/Editing/ScenarioEditPanel';

const ScenariosPageContext: React.FC = () => {
  const navigate = useNavigate();
  const { setLeftPanelContent, setRightPanelContent, setLeftPanelVisible, setRightPanelVisible } = useLayout();
  
  const [scenarios, setScenarios] = useState<ScenarioCardData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingScenario, setEditingScenario] = useState<ScenarioCardData | null>(null);
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Load scenarios
  const fetchScenarios = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllScenarioCards();
      setScenarios(data);
    } catch (err) {
      setError("Failed to load scenarios.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load master worlds
  const fetchMasterWorlds = async () => {
    try {
      const worldsData = await getAllMasterWorlds();
      setMasterWorlds(worldsData);
    } catch (err) {
      console.error("Failed to load master worlds", err);
      setError("Could not load master worlds.");
    }
  };

  useEffect(() => {
    fetchScenarios();
    fetchMasterWorlds();
  }, []);

  // Set panels visible when ScenariosPage loads
  useEffect(() => {
    setLeftPanelVisible(true);
    setRightPanelVisible(true);
  }, [setLeftPanelVisible, setRightPanelVisible]);

  // Auto-save functionality - only for existing scenarios
  useInstantAutoSave(
    editingScenario || {} as ScenarioCardData,
    async (data: ScenarioCardData) => {
      if (data && data.id) {
        const formData = scenarioToFormData(data);
        await updateScenarioCard(data.id, formData);
      }
    },
    { debounceMs: 300 }
  );

  // Handle editing scenario
  const handleEditScenario = (scenario: ScenarioCardData) => {
    setEditingScenario(scenario);
    updateLayoutContent(scenario);
  };

  const updateLayoutContent = (scenario: ScenarioCardData | null) => {
    if (scenario) {
      // Left panel: show image if available
      if (scenario.image_url) {
        setLeftPanelContent(
          <LeftPanelImage
            src={scenario.image_url}
            alt={scenario.name}
          />
        );
      } else {
        setLeftPanelContent(null);
      }

      // Right panel: editing panel
      setRightPanelContent(
        <ScenarioEditPanel
          scenario={scenario}
          masterWorlds={masterWorlds}
          onChange={handleEditFieldChange}
          onDelete={() => handleDelete(scenario.id)}
          onImport={() => importFileInputRef.current?.click()}
          onExport={handleExport}
          onExpressions={() => {}}
          onImageChange={handleEditImageChange}
        />
      );
    }
    // Don't clear panels when scenario is null
    // Let it preserve content from other pages until a new scenario is selected
  };

  const handleEditFieldChange = (field: string, value: any) => {
    if (editingScenario) {
      const updatedScenario = { ...editingScenario, [field]: value };
      setEditingScenario(updatedScenario);
      updateLayoutContent(updatedScenario);
    }
  };

  const handleDelete = async (scenarioId: string) => {
    if (!window.confirm('Are you sure you want to delete this scenario?')) return;
    
    try {
      await deleteScenarioCard(scenarioId);
      if (editingScenario?.id === scenarioId) {
        setEditingScenario(null);
        // Only clear panels if we're deleting the currently edited scenario
        setLeftPanelContent(null);
        setRightPanelContent(null);
      }
      fetchScenarios();
    } catch (err) {
      setError('Failed to delete scenario.');
      console.error(err);
    }
  };

  const handleExport = async () => {
    if (!editingScenario) return;
    
    try {
      const png = await createPNGWithEmbeddedData(
        editingScenario,
        'scenario_card',
        editingScenario.image_url || null
      );
      
      const link = document.createElement('a');
      link.download = `${editingScenario.name}_scenario.png`;
      link.href = URL.createObjectURL(png);
      link.click();
    } catch (err) {
      setError('Failed to export scenario.');
      console.error(err);
    }
  };

  const handleEditImageChange = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingScenario) {
      // TODO: Handle image upload logic
      console.log('Image change not yet implemented');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TODO: Handle import logic
    console.log('Import not yet implemented');
  };

  const handleScenarioClick = async (scenarioId: string) => {
    try {
      const sessionId = await createOrGetCardChat('scenario', scenarioId);
      navigate(`/chat/${sessionId}`);
    } catch (err) {
      console.error("Failed to create/get chat:", err);
      setError("Failed to start chat with scenario.");
    }
  };

  if (isLoading) {
    return <p className="text-center text-gray-400 p-10">Loading scenarios...</p>;
  }

  return (
    <div className="h-full">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Scenarios</h1>
        <div>
          <button
            onClick={() => importFileInputRef.current?.click()}
            className="bg-app-text text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md mr-2"
          >
            Import
          </button>
          <button
            onClick={() => handleEditScenario({ 
              id: 'new', 
              name: 'New Scenario', 
              description: 'Enter description...',
              instructions: 'Enter instructions...'
            } as ScenarioCardData)}
            className="bg-app-text text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            New +
          </button>
        </div>
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={importFileInputRef}
        type="file"
        accept=".png,.zip"
        className="hidden"
        onChange={handleImportFile}
      />

      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}

      {scenarios.length === 0 && !isLoading && (
        <div className="text-center py-10">
          <p className="text-xl text-gray-500 mb-4">No scenarios created yet. Click + to create one</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 justify-items-start">
        {scenarios.map((scenario) => {
          const cacheBuster = scenario.updated_at 
            ? `?cb=${encodeURIComponent(scenario.updated_at)}`
            : `?cb=${scenario.id}`;
          const imageUrl = scenario.image_url ? `${scenario.image_url}${cacheBuster}` : null;
          
          return (
            <div
              key={scenario.id}
              className="bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer group"
              onClick={() => handleEditScenario(scenario)}
            >
              <CardImage
                imageUrl={imageUrl}
                className="absolute inset-0"
              />
              
              <div className="absolute bottom-0 left-0 w-full">
                <div className="w-full bg-black/30 backdrop-blur-sm p-3 flex flex-row items-center justify-between rounded-b-lg">
                  <div className="font-semibold text-lg text-white drop-shadow-md break-words flex-1" title={scenario.name}>
                    {scenario.name}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScenarioClick(scenario.id);
                    }}
                    className="bg-app-text text-black px-3 py-1 rounded-2xl text-sm font-semibold ml-2 hover:bg-app-text/80 transition-colors"
                  >
                    Chat
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScenariosPageContext;
