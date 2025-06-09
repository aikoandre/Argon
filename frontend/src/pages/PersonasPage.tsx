// frontend/src/pages/PersonasPageContext.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  getAllUserPersonas,
  updateUserPersona,
  deleteUserPersona,
  getUserSettings,
  updateUserSettings,
  getAllMasterWorlds,
  type UserPersonaData,
  type MasterWorldData,
} from "../services/api";
import { CardImage } from '../components/CardImage';
import { createPNGWithEmbeddedData } from '../utils/pngExport';
import { useLayout } from '../contexts/LayoutContext';
import PersonaEditPanel from '../components/Editing/PersonaEditPanel';
import { useInstantAutoSave } from '../hooks/useInstantAutoSave';
import { personaToFormData } from '../utils/formDataHelpers';

const PersonasPageContext: React.FC = () => {
  const { setLeftPanelContent, setRightPanelContent } = useLayout();
  
  const [personas, setPersonas] = useState<UserPersonaData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<UserPersonaData | null>(null);
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState<boolean>(true);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save functionality
  const { saveStatus, error: autoSaveError, retry } = useInstantAutoSave(
    editingPersona || {} as UserPersonaData,
    async (data: UserPersonaData) => {
      if (data && data.id) {
        const formData = personaToFormData(data);
        await updateUserPersona(data.id, formData);
      }
    },
    { 
      debounceMs: 300
    }
  );

  // Load personas
  const fetchPersonas = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllUserPersonas();
      // Filter out the default "User" persona
      const filteredData = data.filter(persona => persona.name !== "User");
      setPersonas(filteredData);
    } catch (err) {
      setError("Failed to load personas.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load master worlds
  const fetchMasterWorlds = async () => {
    setIsLoadingWorlds(true);
    try {
      const data = await getAllMasterWorlds();
      setMasterWorlds(data);
    } catch (err) {
      console.error("Failed to load master worlds:", err);
    } finally {
      setIsLoadingWorlds(false);
    }
  };

  // Load user settings to get active persona
  const loadActivePersona = async () => {
    try {
      const settings = await getUserSettings();
      setActivePersonaId(settings?.active_persona_id || null);
    } catch (err) {
      console.error("Failed to load user settings:", err);
    }
  };

  useEffect(() => {
    fetchPersonas();
    fetchMasterWorlds();
    loadActivePersona();
  }, []);

  // Handle editing persona
  const handleEditPersona = (persona: UserPersonaData) => {
    setEditingPersona(persona);
    updateLayoutContent(persona);
  };

  const updateLayoutContent = (persona: UserPersonaData | null) => {
    if (persona) {
      // Left panel: show image if available
      if (persona.image_url) {
        setLeftPanelContent(
          <img
            src={persona.image_url}
            alt={persona.name}
            className="w-full h-full object-cover rounded-lg"
            style={{ aspectRatio: '3/4.5' }}
          />
        );
      } else {
        setLeftPanelContent(null);
      }

      // Right panel: editing panel
      setRightPanelContent(
        <PersonaEditPanel
          persona={persona}
          masterWorlds={masterWorlds}
          onChange={handleEditFieldChange}
          onDelete={() => handleDelete(persona.id)}
          onImport={() => importFileInputRef.current?.click()}
          onExport={handleExport}
          onExpressions={() => {}}
          onImageChange={handleEditImageChange}
          autoSaveStatus={saveStatus}
          disabled={saveStatus === 'saving'}
          onRetryAutoSave={retry}
          lastSaved={null}
          error={autoSaveError}
        />
      );
    } else {
      setLeftPanelContent(null);
      setRightPanelContent(null);
    }
  };

  const handleEditFieldChange = (field: string, value: any) => {
    if (editingPersona) {
      const updatedPersona = { ...editingPersona, [field]: value };
      setEditingPersona(updatedPersona);
      updateLayoutContent(updatedPersona);
    }
  };

  const handleDelete = async (personaId: string) => {
    if (!window.confirm('Are you sure you want to delete this persona?')) return;
    
    try {
      await deleteUserPersona(personaId);
      if (editingPersona?.id === personaId) {
        setEditingPersona(null);
        updateLayoutContent(null);
      }
      fetchPersonas();
    } catch (err) {
      setError('Failed to delete persona.');
      console.error(err);
    }
  };

  const handleExport = async () => {
    if (!editingPersona) return;
    
    try {
      const png = await createPNGWithEmbeddedData(
        editingPersona,
        'user_persona',
        editingPersona.image_url || null
      );
      
      const link = document.createElement('a');
      link.download = `${editingPersona.name}_persona.png`;
      link.href = URL.createObjectURL(png);
      link.click();
    } catch (err) {
      setError('Failed to export persona.');
      console.error(err);
    }
  };

  const handleEditImageChange = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingPersona) {
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

  const handleSetActivePersona = async (personaId: string) => {
    try {
      const currentSettings = await getUserSettings();
      await updateUserSettings({
        ...currentSettings,
        active_persona_id: personaId
      });
      setActivePersonaId(personaId);
    } catch (err) {
      setError('Failed to set active persona.');
      console.error(err);
    }
  };

  if (isLoading && personas.length === 0 && isLoadingWorlds) {
    return <p className="text-center text-gray-400 p-10">Loading personas...</p>;
  }

  return (
    <div className="container p-4 md:p-8 h-full">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Personas</h1>
        <div>
          <button
            onClick={() => importFileInputRef.current?.click()}
            className="bg-app-text-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md mr-2"
          >
            Import
          </button>
          <button
            onClick={() => handleEditPersona({ 
              id: 'new', 
              name: 'New Persona', 
              description: 'Enter description...'
            } as UserPersonaData)}
            className="bg-app-text-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
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

      {personas.length === 0 && !isLoading && !isLoadingWorlds && (
        <div className="text-center py-10">
          <p className="text-xl text-gray-500 mb-4">No persona created yet. Click + to create one</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 justify-items-start">
        {personas.map((persona) => {
          const cacheBuster = persona.updated_at 
            ? `?cb=${encodeURIComponent(persona.updated_at)}`
            : `?cb=${persona.id}`;
          const imageUrl = persona.image_url ? `${persona.image_url}${cacheBuster}` : null;
          const isActive = activePersonaId === persona.id;
          
          return (
            <div
              key={persona.id}
              className={`bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer group ${
                isActive ? 'ring-2 ring-app-text' : ''
              }`}
              onClick={() => handleEditPersona(persona)}
            >
              <CardImage
                imageUrl={imageUrl}
                className="absolute inset-0"
              />
              
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-2 left-2 bg-app-text text-app-bg px-2 py-1 rounded-full text-xs font-semibold">
                  Active
                </div>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(persona.id);
                }}
                className="absolute top-2 right-2 z-20 text-app-text hover:text-red-500 p-1.5 rounded-full transition-colors"
                title="Delete Persona"
              >
                <span className="material-icons-outlined text-2xl">delete</span>
              </button>
              
              <div className="absolute bottom-0 left-0 w-full">
                <div className="w-full bg-black/30 backdrop-blur-sm p-3 flex flex-row items-center justify-between rounded-b-lg">
                  <div className="font-semibold text-lg text-white drop-shadow-md break-words flex-1" title={persona.name}>
                    {persona.name}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetActivePersona(persona.id);
                    }}
                    className={`px-3 py-1 rounded-2xl text-sm font-semibold ml-2 transition-colors ${
                      isActive 
                        ? 'bg-gray-500 text-white cursor-default' 
                        : 'bg-app-text text-black hover:bg-app-text/80'
                    }`}
                    disabled={isActive}
                  >
                    {isActive ? 'Active' : 'Set Active'}
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

export default PersonasPageContext;
