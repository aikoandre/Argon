// frontend/src/pages/PersonasPageContext.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  getAllUserPersonas,
  deleteUserPersona,
  getUserSettings,
  updateUserSettings,
  getAllMasterWorlds,
  updateUserPersona,
  createUserPersona,
  type UserPersonaData,
  type MasterWorldData,
} from "../services/api";
import { CardImage } from '../components/CardImage';
import { LeftPanelImage } from '../components/Layout';
import { createPNGWithEmbeddedData } from '../utils/pngExport';
import { personaToFormData } from '../utils/formDataHelpers';
import { useLayout } from '../contexts/LayoutContext';
import PersonaEditPanel from '../components/Editing/PersonaEditPanel';

const PersonasPageContext: React.FC = () => {
  const { setLeftPanelContent, setRightPanelContent, setLeftPanelVisible, setRightPanelVisible } = useLayout();
  
  const [personas, setPersonas] = useState<UserPersonaData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<UserPersonaData | null>(null);
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState<boolean>(true);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Debounced save function to prevent excessive API calls
  const debouncedSave = useCallback(async (persona: UserPersonaData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = window.setTimeout(async () => {
      if (persona.id && persona.id !== 'new') {
        try {
          const formData = personaToFormData(persona);
          await updateUserPersona(persona.id, formData);
        } catch (err: any) {
          console.error('Failed to save persona:', err);
          if (err.message && err.message.includes('name is required')) {
            setError('Persona name cannot be empty.');
          } else if (err.message && err.message.includes('cannot exceed 100 characters')) {
            setError('Persona name is too long (maximum 100 characters).');
          } else if (err.response?.status === 422) {
            const details = err.response.data.detail;
            if (Array.isArray(details)) {
              const messages = details.map((e: any) => `${e.loc?.[1] || 'field'}: ${e.msg}`).join(', ');
              setError(`Validation error: ${messages}`);
            } else {
              setError(`Validation error: ${details}`);
            }
          } else {
            setError('Failed to save changes.');
          }
        }
      }
    }, 500); // 500ms delay
  }, []);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Set panels visible when PersonasPage loads
  useEffect(() => {
    setLeftPanelVisible(true);
    setRightPanelVisible(true);
  }, [setLeftPanelVisible, setRightPanelVisible]);

  // Right panel content - Persona editor
  useEffect(() => {
    if (editingPersona) {
      updateLayoutContent(editingPersona);
    }
    // Don't clear the right panel when no persona is being edited
    // Let it preserve content from other pages until a new persona is selected
  }, [editingPersona, masterWorlds]); // Include masterWorlds in dependency array since PersonaEditPanel needs it

  // Auto-save functionality - disabled since we handle saves manually in handleEditFieldChange
  // useInstantAutoSave(
  //   editingPersona || {} as UserPersonaData,
  //   async (data: UserPersonaData) => {
  //     if (data && data.id) {
  //       const formData = personaToFormData(data);
  //       await updateUserPersona(data.id, formData);
  //     }
  //   },
  //   { debounceMs: 300 }
  // );

  // Handle editing persona
  const handleEditPersona = (persona: UserPersonaData) => {
    setEditingPersona(persona);
  };

  const updateLeftPanelImage = (persona: UserPersonaData) => {
    if (persona.image_url) {
      const cacheBuster = persona.updated_at 
        ? `?cb=${encodeURIComponent(persona.updated_at)}`
        : `?cb=${Date.now()}`; // Use current timestamp for new images
      setLeftPanelContent(
        <LeftPanelImage
          src={`${persona.image_url}${cacheBuster}`}
          alt={persona.name}
        />
      );
    } else {
      setLeftPanelContent(null);
    }
  };

  const updateLayoutContent = (persona: UserPersonaData | null) => {
    if (persona) {
      // Left panel: show image if available
      if (persona.image_url) {
        const cacheBuster = persona.updated_at 
          ? `?cb=${encodeURIComponent(persona.updated_at)}`
          : `?cb=${Date.now()}`; // Use current timestamp for new images
        setLeftPanelContent(
          <LeftPanelImage
            src={`${persona.image_url}${cacheBuster}`}
            alt={persona.name}
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
        />
      );
    }
    // Don't clear panels when persona is null
    // Let it preserve content from other pages until a new persona is selected
  };

  // Right panel content - Persona editor
  useEffect(() => {
    if (editingPersona) {
      // Only update the left panel image, not the entire right panel content
      if (editingPersona.image_url) {
        const cacheBuster = editingPersona.updated_at 
          ? `?cb=${encodeURIComponent(editingPersona.updated_at)}`
          : `?cb=${Date.now()}`;
        setLeftPanelContent(
          <LeftPanelImage
            src={`${editingPersona.image_url}${cacheBuster}`}
            alt={editingPersona.name}
          />
        );
      } else {
        setLeftPanelContent(null);
      }
    }
  }, [editingPersona?.image_url, editingPersona?.updated_at, editingPersona?.name]); // Only depend on image-related fields

  // Set up the right panel content only once when persona is selected, not on every change
  useEffect(() => {
    if (editingPersona) {
      setRightPanelContent(
        <PersonaEditPanel
          persona={editingPersona}
          masterWorlds={masterWorlds}
          onChange={handleEditFieldChange}
          onDelete={() => handleDelete(editingPersona.id)}
          onImport={() => importFileInputRef.current?.click()}
          onExport={handleExport}
          onExpressions={() => {}}
          onImageChange={handleEditImageChange}
          disabled={false}
        />
      );
    }
  }, [editingPersona?.id, masterWorlds]); // Only depend on persona ID and master worlds, not the entire persona object

  const handleEditFieldChange = useCallback(async (field: string, value: any) => {
    if (editingPersona) {
      const updatedPersona = { ...editingPersona, [field]: value };
      setEditingPersona(updatedPersona);
      
      // Update the personas list immediately for UI consistency
      setPersonas(prev => prev.map(p => p.id === updatedPersona.id ? updatedPersona : p));
      
      // Use debounced save to avoid excessive API calls while typing
      debouncedSave(updatedPersona);
    }
  }, [editingPersona, debouncedSave]);

  const handleDelete = async (personaId: string) => {
    if (!window.confirm('Are you sure you want to delete this persona?')) return;
    
    try {
      await deleteUserPersona(personaId);
      if (editingPersona?.id === personaId) {
        setEditingPersona(null);
        // Only clear panels if we're deleting the currently edited persona
        setLeftPanelContent(null);
        setRightPanelContent(null);
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

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingPersona) {
      try {
        setError(null);
        
        // Create FormData with the image and persona data
        const formData = new FormData();
        formData.append('image', file);
        formData.append('name', editingPersona.name);
        if (editingPersona.description !== null && editingPersona.description !== undefined) {
          formData.append('description', editingPersona.description);
        }
        if (editingPersona.master_world_id !== null && editingPersona.master_world_id !== undefined) {
          formData.append('master_world_id', editingPersona.master_world_id);
        }
        
        // Update the persona with the new image (only for existing personas)
        if (editingPersona.id && editingPersona.id !== 'new') {
          const updatedPersona = await updateUserPersona(editingPersona.id, formData);
          
          // Update local state
          setEditingPersona(updatedPersona);
          updateLeftPanelImage(updatedPersona); // Only update the left panel image
          // Update the personas list to show the new image
          setPersonas(prev => prev.map(p => p.id === updatedPersona.id ? updatedPersona : p));
        }
      } catch (err: any) {
        console.error('Failed to upload image:', err);
        if (err.message && err.message.includes('name is required')) {
          setError('Persona name cannot be empty.');
        } else if (err.message && err.message.includes('cannot exceed 100 characters')) {
          setError('Persona name is too long (maximum 100 characters).');
        } else if (err.response?.status === 422) {
          const details = err.response.data.detail;
          if (Array.isArray(details)) {
            const messages = details.map((e: any) => `${e.loc?.[1] || 'field'}: ${e.msg}`).join(', ');
            setError(`Validation error: ${messages}`);
          } else {
            setError(`Validation error: ${details}`);
          }
        } else {
          setError('Failed to upload image.');
        }
      }
    }
    // Clear the file input so the same file can be selected again
    e.target.value = '';
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TODO: Handle import logic
    console.log('Import not yet implemented');
  };

  const handleCreateNewPersona = async () => {
    try {
      setError(null);
      const newPersonaData = {
        name: 'New Persona',
        description: 'Enter description...',
        master_world_id: null
      };
      
      const formData = personaToFormData(newPersonaData);
      const createdPersona = await createUserPersona(formData);
      setPersonas(prev => [...prev, createdPersona]);
      setEditingPersona(createdPersona);
    } catch (err: any) {
      setError('Failed to create new persona.');
      console.error('Full error details:', err);
      if (err.response) {
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
      }
    }
  };

  const handleSetActivePersona = async (personaId: string | null) => {
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
    <div className="h-full">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Personas</h1>
        <div>
          <button
            onClick={() => importFileInputRef.current?.click()}
            className="bg-app-text text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md mr-2"
          >
            Import
          </button>
          <button
            onClick={handleCreateNewPersona}
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
              
              <div className="absolute bottom-0 left-0 w-full">
                <div className="w-full bg-black/30 backdrop-blur-sm p-3 flex flex-row items-start justify-between rounded-b-lg">
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="font-semibold text-lg text-white drop-shadow-md break-words" title={persona.name}>
                      {persona.name}
                    </div>
                    {persona.master_world_id && (
                      <div className="text-sm text-white/80 drop-shadow-md break-words line-clamp-2" title={masterWorlds.find(w => w.id === persona.master_world_id)?.name || 'Unknown World'}>
                        {masterWorlds.find(w => w.id === persona.master_world_id)?.name || 'Unknown World'}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isActive) {
                        handleSetActivePersona(null); // Deactivate current persona
                      } else {
                        handleSetActivePersona(persona.id); // Activate this persona
                      }
                    }}
                    className={`px-3 py-1 rounded-2xl text-sm font-semibold  transition-colors flex-shrink-0 ${
                      isActive 
                        ? 'bg-app-primary text-white hover:bg-app-primary/80' 
                        : 'bg-app-text text-black hover:bg-app-text/80'
                    }`}
                  >
                    {isActive ? 'Active' : 'Activate'}
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
