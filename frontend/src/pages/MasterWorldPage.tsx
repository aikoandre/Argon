// frontend/src/pages/MasterWorldPageContext.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select, { type SingleValue } from 'react-select';
import {
  getAllLoreEntriesForMasterWorld,
  getAllLoreEntries,
  updateLoreEntry,
  deleteLoreEntry,
  getAllMasterWorlds,
  createMasterWorld,
  type LoreEntryData,
  type MasterWorldData,
} from '../services/api';
import { useLayout } from '../contexts/LayoutContext';
import { useInstantAutoSave } from '../hooks/useInstantAutoSave';
import LoreEntryEditPanel from '../components/Editing/LoreEntryEditPanel';

const iconBaseClass = "material-icons-outlined text-2xl flex-shrink-0";
const DeleteIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>delete</span>
);

interface SelectOption {
  value: string;
  label: string;
}

const VALID_ENTRY_TYPES = ["CHARACTER_LORE", "LOCATION", "FACTION", "ITEM", "CONCEPT", "NARRATIVE_EVENT"];
const DISPLAY_ENTRY_TYPES_ORDER = ["CHARACTER_LORE", "LOCATION", "FACTION", "ITEM", "CONCEPT", "NARRATIVE_EVENT"];

export const getFriendlyEntryTypeName = (entryType: string): string => {
  switch (entryType) {
    case "CHARACTER_LORE":
      return "Character";
    case "LOCATION":
      return "Location";
    case "FACTION":
      return "Group";
    case "ITEM":
      return "Item";
    case "CONCEPT":
      return "Concept";
    case "NARRATIVE_EVENT":
      return "Event";
    default:
      return entryType.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }
};

const MasterWorldPageContext: React.FC = () => {
  const navigate = useNavigate();
  const { masterWorldId } = useParams<{ masterWorldId: string }>();
  const { setLeftPanelContent, setRightPanelContent } = useLayout();
  
  // Master World states  
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [selectedMasterWorld, setSelectedMasterWorld] = useState<SingleValue<SelectOption>>(null);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState<boolean>(true);
  
  // Lore Entry states
  const [loreEntries, setLoreEntries] = useState<LoreEntryData[]>([]);
  const [factionsOptions, setFactionsOptions] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [editingEntry, setEditingEntry] = useState<LoreEntryData | null>(null);
  
  // UI states
  const [error, setError] = useState<string | null>(null);
  const [newWorldName, setNewWorldName] = useState<string>("");

  // Create entry type options for the dropdown
  const entryTypeOptions: SelectOption[] = VALID_ENTRY_TYPES.map(type => ({
    value: type,
    label: getFriendlyEntryTypeName(type)
  }));

  // Handler for master world selection
  const handleMasterWorldChange = (selectedOption: SingleValue<SelectOption>) => {
    setSelectedMasterWorld(selectedOption);
    if (selectedOption) {
      navigate(`/world-lore/${selectedOption.value}/entries`, { replace: true });
    } else {
      navigate('/world-lore/entries', { replace: true });
    }
  };

  // Load master worlds
  const fetchMasterWorlds = async () => {
    setIsLoadingWorlds(true);
    try {
      const data = await getAllMasterWorlds();
      setMasterWorlds(data);
    } catch (err) {
      setError("Failed to load master worlds.");
      console.error(err);
    } finally {
      setIsLoadingWorlds(false);
    }
  };

  // Load lore entries based on selected world
  const fetchLoreEntries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let entriesData: LoreEntryData[];
      let factionsForWorld: LoreEntryData[] = [];

      if (selectedMasterWorld?.value) {
        [entriesData, factionsForWorld] = await Promise.all([
          getAllLoreEntriesForMasterWorld(selectedMasterWorld.value),
          getAllLoreEntriesForMasterWorld(selectedMasterWorld.value, "FACTION")
        ]);
      } else {
        entriesData = await getAllLoreEntries();
        if (masterWorlds.length > 0) {
          const allFactionsPromises = masterWorlds.map(mw => getAllLoreEntriesForMasterWorld(mw.id, "FACTION"));
          const allFactionsArrays = await Promise.all(allFactionsPromises);
          factionsForWorld = allFactionsArrays.flat();
        }
      }
      
      setLoreEntries(entriesData);
      setFactionsOptions(factionsForWorld.map(f => ({ value: f.id, label: f.name })));
    } catch (err) {
      setError('Failed to load lore entries or world details.');
      console.error(err);
      setLoreEntries([]);
      setFactionsOptions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterWorlds();
  }, []);

  // Set initial selected world based on URL
  useEffect(() => {
    if (masterWorlds.length > 0 && masterWorldId) {
      if (masterWorldId && masterWorldId !== 'all') {
        const currentWorld = masterWorlds.find(mw => mw.id === masterWorldId);
        if (currentWorld) {
          setSelectedMasterWorld({ value: currentWorld.id, label: currentWorld.name });
        } else {
          navigate('/world-lore/entries', { replace: true });
          setSelectedMasterWorld(null);
        }
      } else {
        setSelectedMasterWorld(null);
      }
    }
  }, [masterWorldId, masterWorlds, navigate]);

  // Fetch lore entries when world selection changes
  useEffect(() => {
    if (!isLoadingWorlds) {
      fetchLoreEntries();
    }
  }, [selectedMasterWorld, isLoadingWorlds, masterWorlds]);

  // Auto-save functionality - only for existing lore entries
  useInstantAutoSave(
    editingEntry || {} as LoreEntryData,
    async (data: LoreEntryData) => {
      if (data && data.id && data.master_world_id) {
        await updateLoreEntry(data.master_world_id, data.id, data);
      }
    },
    { debounceMs: 300 }
  );

  // Handle editing lore entry
  const handleEditEntry = (entry: LoreEntryData) => {
    setEditingEntry(entry);
    updateLayoutContent(entry);
  };

  const updateLayoutContent = (entry: LoreEntryData | null) => {
    if (entry) {
      // Left panel: not used for lore entries (no images)
      setLeftPanelContent(null);

      // Right panel: editing panel
      setRightPanelContent(
        <LoreEntryEditPanel
          loreEntry={entry}
          masterWorlds={masterWorlds}
          factionsOptions={factionsOptions}
          entryTypeOptions={entryTypeOptions}
          onChange={handleEditFieldChange}
          onDelete={() => handleDelete(entry.id)}
          onImport={() => {}}
          onExport={() => {}}
          onExpressions={() => {}}
          onImageChange={() => {}}
        />
      );
    } else {
      setLeftPanelContent(null);
      setRightPanelContent(null);
    }
  };

  const handleEditFieldChange = (field: string, value: any) => {
    if (editingEntry) {
      const updatedEntry = { ...editingEntry, [field]: value };
      setEditingEntry(updatedEntry);
      updateLayoutContent(updatedEntry);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!selectedMasterWorld?.value) {
      setError("Please select a Master World to delete from.");
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this lore entry?')) return;
    
    try {
      await deleteLoreEntry(selectedMasterWorld.value, entryId);
      if (editingEntry?.id === entryId) {
        setEditingEntry(null);
        updateLayoutContent(null);
      }
      fetchLoreEntries();
    } catch (err) {
      setError('Failed to delete lore entry.');
      console.error(err);
    }
  };

  const handleCreateNewWorld = async () => {
    if (!newWorldName.trim()) {
      setError("World name cannot be empty.");
      return;
    }

    try {
      const newWorld = await createMasterWorld({ name: newWorldName.trim() });
      setMasterWorlds(prev => [...prev, newWorld]);
      setNewWorldName("");
      setSelectedMasterWorld({ value: newWorld.id, label: newWorld.name });
      navigate(`/world-lore/${newWorld.id}/entries`, { replace: true });
    } catch (err) {
      setError("Failed to create a new world.");
      console.error(err);
    }
  };

  const handleCreateNewEntry = () => {
    if (!selectedMasterWorld) {
      setError("Please select a Master World before creating a new lore entry.");
      return;
    }
    
    const newEntry: LoreEntryData = {
      id: 'new',
      name: 'New Lore Entry',
      entry_type: 'CHARACTER_LORE',
      description: 'Enter description...',
      tags: [],
      aliases: [],
      faction_id: null,
      master_world_id: selectedMasterWorld.value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    handleEditEntry(newEntry);
  };

  if (isLoading || isLoadingWorlds) {
    return <p className="text-center text-gray-400 p-10">Loading lore entries...</p>;
  }

  return (
    <div className="h-full">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold text-white font-quintessential">
            MasterWorld
          </h1>
          {selectedMasterWorld && (
            <button 
              onClick={handleCreateNewEntry}
              className="bg-app-text-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
            >
              + New Lore
            </button>
          )}
        </div>
      </div>

      {/* Master World Dropdown and New World Creation */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-grow">
            <Select<SelectOption>
              options={masterWorlds.map(w => ({ value: w.id, label: w.name }))}
              value={selectedMasterWorld}
              onChange={handleMasterWorldChange}
              isDisabled={isLoadingWorlds}
              placeholder="Select Master World to view entries..."
              isClearable={true}
              className="text-black"
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
                menu: (base) => ({ ...base, backgroundColor: "#495057", zIndex: 10 }),
                option: (base, { isFocused, isSelected }) => ({
                  ...base,
                  backgroundColor: isSelected ? "#adb5bd" : isFocused ? "#6c757d" : undefined,
                  color: "white",
                }),
                placeholder: (base) => ({ ...base, color: "#adb5bd" }),
              }}
            />
          </div>
        </div>
        
        {/* New World Creation */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newWorldName}
            onChange={(e) => setNewWorldName(e.target.value)}
            className="flex-1 p-2 bg-app-surface border border-gray-600 rounded-md text-white"
            placeholder="Enter new world name..."
          />
          <button
            onClick={handleCreateNewWorld}
            className="bg-app-text text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            Create World
          </button>
        </div>
      </div>

      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}

      {/* Render sections by type */}
      <div className="space-y-8 pb-20">
        {DISPLAY_ENTRY_TYPES_ORDER.map(entryType => {
          const friendlyTypeName = getFriendlyEntryTypeName(entryType);
          const entriesOfType = loreEntries.filter(entry => entry.entry_type === entryType);

          return (
            <div key={entryType}>
              <h3 className="text-2xl font-semibold text-gray-300 mb-4 border-b border-gray-700 pb-2 font-quintessential">
                {friendlyTypeName}
              </h3>
              {entriesOfType.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Empty section</p>
              ) : (
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 justify-items-start">
                  {entriesOfType.map(entry => (
                    <div
                      key={entry.id}
                      className="bg-app-surface rounded-lg shadow-lg flex flex-col items-start justify-center w-36 h-20 md:w-44 md:h-22 lg:w-52 lg:h-24 p-2 relative overflow-hidden cursor-pointer group transition-transform hover:scale-105"
                      onClick={() => handleEditEntry(entry)}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                        className="absolute top-1 right-1 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full z-10 bg-app-surface/80"
                        title="Delete Lore Entry"
                        style={{ lineHeight: 1 }}
                      >
                        <DeleteIcon className="h-5 w-5" />
                      </button>
                      <div className="flex flex-col items-start justify-center w-full h-full p-1">
                        <h2 className="text-lg font-semibold text-white break-words whitespace-normal leading-tight mb-2 w-full truncate text-left" title={entry.name}>
                          {entry.name}
                        </h2>
                        <p className="text-xs px-2 py-0.5 rounded-full font-semibold bg-app-text text-app-bg text-left truncate max-w-full">
                          {getFriendlyEntryTypeName(entry.entry_type)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MasterWorldPageContext;
