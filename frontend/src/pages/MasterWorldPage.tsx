import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select, { type SingleValue } from 'react-select';
import {
  getAllLoreEntriesForMasterWorld,
  createLoreEntryForMasterWorld,
  deleteLoreEntry,
  getAllMasterWorlds,
  createMasterWorld,
  deleteMasterWorld,
  type LoreEntryData,
  type MasterWorldData,
} from '../services/api';
import { useLayout } from '../contexts/LayoutContext';
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
  const { setLeftPanelContent, setRightPanelContent, setLeftPanelVisible, setRightPanelVisible } = useLayout();
  
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
  const [showCreateWorldModal, setShowCreateWorldModal] = useState<boolean>(false);
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
  const fetchLoreEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let entriesData: LoreEntryData[] = [];
      let factionsForWorld: LoreEntryData[] = [];

      if (selectedMasterWorld?.value) {
        [entriesData, factionsForWorld] = await Promise.all([
          getAllLoreEntriesForMasterWorld(selectedMasterWorld.value),
          getAllLoreEntriesForMasterWorld(selectedMasterWorld.value, "FACTION")
        ]);
      }
      // If no master world is selected, don't load any entries
      
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
  }, [selectedMasterWorld, masterWorlds]);

  useEffect(() => {
    fetchMasterWorlds();
  }, []);

  // Set panels visible when MasterWorldPage loads
  useEffect(() => {
    setLeftPanelVisible(true);
    setRightPanelVisible(true);
  }, [setLeftPanelVisible, setRightPanelVisible]);

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
  }, [fetchLoreEntries, isLoadingWorlds]);

  // Update panel content when editingEntry changes
  useEffect(() => {
    if (editingEntry) {
      updateLayoutContent(editingEntry);
    }
  }, [editingEntry]);

  // Auto-save functionality - disabled since we handle saves manually in handleEditFieldChange
  // useInstantAutoSave(
  //   editingEntry || {} as LoreEntryData,
  //   async (data: LoreEntryData) => {
  //     if (data && data.id && data.id !== 'new' && data.master_world_id) {
  //       await updateLoreEntry(data.master_world_id, data.id, data);
  //     }
  //   },
  //   { debounceMs: 300 }
  // );

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
    }
    // Don't clear panels when entry is null
    // Let it preserve content from other pages until a new lore entry is selected
  };

  const handleSaveNewEntry = useCallback(async (entryData: LoreEntryData) => {
    try {
      const { id, created_at, updated_at, ...createData } = entryData;
      const createdEntry = await createLoreEntryForMasterWorld(entryData.master_world_id, createData);
      
      // Replace the temporary entry with the real one in the list
      setLoreEntries(prev => prev.map(entry => 
        entry.id === 'new' ? createdEntry : entry
      ));
      
      // Update the editing entry with the real ID
      setEditingEntry(createdEntry);
      // DON'T call updateLayoutContent here - it causes the component to lose focus
      // The LoreEntryEditPanel will automatically get the updated loreEntry prop
      
      // Don't need to call fetchLoreEntries since we updated the list manually
    } catch (err) {
      console.error('Failed to create lore entry:', err);
      setError('Failed to save new lore entry.');
      
      // Remove the temporary entry from the list on error
      setLoreEntries(prev => prev.filter(entry => entry.id !== 'new'));
      setEditingEntry(null);
      setLeftPanelContent(null);
      setRightPanelContent(null);
    }
  }, [setLeftPanelContent, setRightPanelContent]);

  const handleEditFieldChange = useCallback((field: string, value: any) => {
    if (editingEntry) {
      const updatedEntry = { ...editingEntry, [field]: value };
      setEditingEntry(updatedEntry);
      
      // Update the entry in the lore entries list so the card updates in real-time
      setLoreEntries(prev => prev.map(entry => 
        entry.id === editingEntry.id ? updatedEntry : entry
      ));
      
      // If this is a new entry and we have enough data, save it
      if (updatedEntry.id === 'new' && updatedEntry.name && updatedEntry.name !== 'New Lore Entry' && updatedEntry.master_world_id) {
        handleSaveNewEntry(updatedEntry);
      }
    }
  }, [editingEntry, handleSaveNewEntry]);

  const handleDelete = async (entryId: string) => {
    // Handle deleting a new entry that hasn't been saved yet
    if (entryId === 'new') {
      if (!window.confirm('Are you sure you want to discard this new lore entry?')) return;
      
      // Remove from the list and clear editing state
      setLoreEntries(prev => prev.filter(entry => entry.id !== 'new'));
      setEditingEntry(null);
      setLeftPanelContent(null);
      setRightPanelContent(null);
      return;
    }
    
    // Find the entry to get its master_world_id
    const entryToDelete = loreEntries.find(entry => entry.id === entryId);
    if (!entryToDelete?.master_world_id) {
      setError("Cannot delete lore entry: missing master world information.");
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this lore entry?')) return;
    
    try {
      await deleteLoreEntry(entryToDelete.master_world_id, entryId);
      
      // Remove from the local list
      setLoreEntries(prev => prev.filter(entry => entry.id !== entryId));
      
      if (editingEntry?.id === entryId) {
        setEditingEntry(null);
        // Only clear panels if we're deleting the currently edited lore entry
        setLeftPanelContent(null);
        setRightPanelContent(null);
      }
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
      setShowCreateWorldModal(false);
      setSelectedMasterWorld({ value: newWorld.id, label: newWorld.name });
      navigate(`/world-lore/${newWorld.id}/entries`, { replace: true });
    } catch (err) {
      setError("Failed to create a new world.");
      console.error(err);
    }
  };

  const handleDeleteWorld = async (worldId: string) => {
    if (!window.confirm('Are you sure you want to delete this Master World? This will also delete all associated lore entries.')) {
      return;
    }

    try {
      await deleteMasterWorld(worldId);
      
      // Remove from local state
      setMasterWorlds(prev => prev.filter(w => w.id !== worldId));
      setSelectedMasterWorld(null);
      setEditingEntry(null);
      setLeftPanelContent(null);
      setRightPanelContent(null);
      navigate('/world-lore/entries', { replace: true });
      
      // Refresh lore entries
      fetchLoreEntries();
    } catch (err) {
      setError('Failed to delete Master World.');
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
    
    // Add the new entry to the lore entries list so it appears as a card
    setLoreEntries(prev => [newEntry, ...prev]);
    
    // Set it as the editing entry and update panels
    handleEditEntry(newEntry);
  };

  if (isLoading || isLoadingWorlds) {
    return <p className="text-center text-gray-400 p-10">Loading lore entries...</p>;
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)] overflow-hidden">
      {/* Header and controls */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold text-white font-quintessential">
            MasterWorld
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateWorldModal(true)}
              className="bg-app-text text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md flex items-center gap-2"
            >
              New <span className="material-icons-outlined">public</span>
            </button>
            {selectedMasterWorld && (
              <button
                onClick={handleCreateNewEntry}
                className="bg-app-text text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
              >
                + New Lore
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Master World Dropdown with Delete Button */}
      <div className="mb-4 flex-shrink-0">
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
                  backgroundColor: "#212529",
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
          {selectedMasterWorld && (
            <button
              onClick={() => handleDeleteWorld(selectedMasterWorld.value)}
              className="bg-red-600 hover:bg-red-700 text-white px-1 py-0.5 rounded-lg shadow-md transition-colors"
              title="Delete Master World"
            >
              <DeleteIcon className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-2 text-center flex-shrink-0">
          {error}
        </p>
      )}

      {/* Scrollable section titles and cards */}
      <div className="overflow-y-auto flex-1 min-h-0 space-y-8 pb-4 scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border hover:scrollbar-thumb-app-text">
        {!selectedMasterWorld ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <span className="material-icons-outlined text-6xl text-gray-500 mb-4">public</span>
            <h3 className="text-2xl font-semibold text-gray-400 mb-2">No Master World Selected</h3>
            <p className="text-gray-500 max-w-md">
              Please select a Master World from the dropdown above to view and manage its lore entries.
            </p>
          </div>
        ) : (
          DISPLAY_ENTRY_TYPES_ORDER.map(entryType => {
            const friendlyTypeName = getFriendlyEntryTypeName(entryType);
            const entriesOfType = loreEntries.filter(entry => entry.entry_type === entryType);

            return (
              <div key={entryType}>
                <h3 className="text-2xl font-semibold text-app-text mb-2 border-b border-gray-700 pb-2 font-quintessential">
                  {friendlyTypeName}
                </h3>
                {entriesOfType.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Empty section</p>
                ) : (
                  <div className="grid gap-6 justify-items-start p-2" style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
                  }}>
                    {entriesOfType.map(entry => (
                      <div
                        key={entry.id}
                        className="bg-app-bg rounded-lg shadow-lg flex flex-col items-start justify-center w-full h-24 p-3 relative overflow-hidden cursor-pointer group transition-transform hover:scale-105"
                        onClick={() => handleEditEntry(entry)}
                      >
                        <div className="flex flex-col items-start justify-center w-full h-full p-1">
                          <h2 className="text-lg font-semibold text-white leading-tight mb-1 w-full text-left overflow-hidden" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word'
                          }} title={entry.name}>
                            {entry.name}
                          </h2>
                          <p className="text-xs px-2 py-0.5 rounded-full font-semibold bg-app-text text-app-bg text-left truncate max-w-full mt-auto">
                            {getFriendlyEntryTypeName(entry.entry_type)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create World Modal */}
      {showCreateWorldModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-app-surface rounded-lg p-6 w-96 mx-4">
            <h2 className="text-xl font-semibold mb-4 text-white">Create New Master World</h2>
            <input
              type="text"
              value={newWorldName}
              onChange={(e) => setNewWorldName(e.target.value)}
              className="w-full p-3 bg-app-bg border border-gray-600 rounded-md text-white mb-4"
              placeholder="Enter world name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateNewWorld();
                } else if (e.key === 'Escape') {
                  setShowCreateWorldModal(false);
                  setNewWorldName("");
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreateWorldModal(false);
                  setNewWorldName("");
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewWorld}
                disabled={!newWorldName.trim()}
                className="px-4 py-2 bg-app-text text-app-surface rounded-lg hover:bg-app-text/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MasterWorldPageContext;
