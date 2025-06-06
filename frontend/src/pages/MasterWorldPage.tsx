import React, { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select, { type SingleValue } from 'react-select';
import ReactTagInput from '@pathofdev/react-tag-input';
import '@pathofdev/react-tag-input/build/index.css';
import {
  getAllLoreEntriesForMasterWorld,
  getAllLoreEntries,
  createLoreEntryForMasterWorld,
  updateLoreEntry,
  deleteLoreEntry,
  getMasterWorldById,
  getAllMasterWorlds,
  createMasterWorld,
  type LoreEntryData,
  type MasterWorldData,
} from '../services/api';

const iconBaseClass = "material-icons-outlined text-2xl flex-shrink-0";
const DeleteIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>delete</span>
);

const VALID_ENTRY_TYPES = ["CHARACTER_LORE", "LOCATION", "FACTION", "ITEM", "CONCEPT", "NARRATIVE_EVENT"];

// Define the desired order for displaying sections
const DISPLAY_ENTRY_TYPES_ORDER = ["CHARACTER_LORE", "LOCATION", "FACTION", "ITEM", "CONCEPT", "NARRATIVE_EVENT"];

interface SelectOption { value: string; label: string; }
interface ModalProps { isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string; }

// --- DEFINE THE MODAL COMPONENT *OUTSIDE* THE MAIN PAGE COMPONENT ---
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] py-4">
      <div className="bg-app-bg p-6 rounded-2xl shadow-xl w-full max-w-lg text-white transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
// --- END MODAL COMPONENT DEFINITION ---

interface LoreEntryFormData {
  name: string;
  entry_type: string;
  description: string;
  tags: string[];
  aliases: string[];
  faction_id: string | null;
}

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

const initialFormData: LoreEntryFormData = {
  name: '',
  entry_type: VALID_ENTRY_TYPES[0],
  description: '',
  tags: [],
  aliases: [],
  faction_id: null,
};


const MasterWorldPage: React.FC = () => {
  const navigate = useNavigate();

  // Master World states  
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [selectedMasterWorld, setSelectedMasterWorld] = useState<SingleValue<SelectOption>>(null);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState<boolean>(true);
  
  // Lore Entry states
  const [loreEntries, setLoreEntries] = useState<LoreEntryData[]>([]);
  const [factionsOptions, setFactionsOptions] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // UI states
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newWorldModalOpen, setNewWorldModalOpen] = useState<boolean>(false);
  const [newWorldName, setNewWorldName] = useState<string>("");
  const [editingEntry, setEditingEntry] = useState<LoreEntryData | null>(null);
  const [formData, setFormData] = useState<LoreEntryFormData>(initialFormData);

  // Create entry type options for the dropdown
  const entryTypeOptions: SelectOption[] = VALID_ENTRY_TYPES.map(type => ({
    value: type,
    label: getFriendlyEntryTypeName(type)
  }));

  // Handler for master world selection
  const handleMasterWorldChange = (selectedOption: SingleValue<SelectOption>) => {
    setSelectedMasterWorld(selectedOption);
    // Update URL if needed, or simply re-fetch data
    if (selectedOption) {
      navigate(`/world-lore/${selectedOption.value}/entries`, { replace: true });
    } else {
      navigate('/world-lore/entries', { replace: true }); // New route for all entries
    }
  };

  // Effect to fetch master worlds
  useEffect(() => {
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
    fetchMasterWorlds();
  }, []);

  // Effect to set initial selectedMasterWorld based on URL
  const { masterWorldId } = useParams<{ masterWorldId: string }>();

  useEffect(() => {
    if (masterWorlds.length > 0 && masterWorldId) {
      if (masterWorldId && masterWorldId !== 'all') {
        const currentWorld = masterWorlds.find(mw => mw.id === masterWorldId);
        if (currentWorld) {
          setSelectedMasterWorld({ value: currentWorld.id, label: currentWorld.name });
        } else {
          // Master world from URL not found, redirect to all entries
          navigate('/world-lore/entries', { replace: true });
          setSelectedMasterWorld(null);
        }
      } else {
        setSelectedMasterWorld(null); // Represents "All Worlds"
      }
    }
  }, [masterWorldId, masterWorlds, navigate]);


  // Effect to fetch lore entries based on selected master world
  useEffect(() => {
    const fetchLoreEntriesAndWorldDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let entriesData: LoreEntryData[];
        let worldDetails: MasterWorldData | null = null;
        let factionsForWorld: LoreEntryData[] = [];

        if (selectedMasterWorld?.value) {
          // Fetch entries and details for a specific master world
          [worldDetails, entriesData, factionsForWorld] = await Promise.all([
            getMasterWorldById(selectedMasterWorld.value),
            getAllLoreEntriesForMasterWorld(selectedMasterWorld.value),
            getAllLoreEntriesForMasterWorld(selectedMasterWorld.value, "FACTION")
          ]);
        } else {
          // Fetch all lore entries if no specific world is selected (or "All Worlds")
          entriesData = await getAllLoreEntries();
          // How to handle factions for "All Worlds"? For now, clear them or fetch all.
          // To keep it simple, let's clear them. Faction filtering might be complex across all worlds.
          // Alternatively, fetch all factions from all worlds if an API endpoint supports it,
          // or aggregate from individual world calls if necessary (could be slow).
          // For now, let's assume factions are only relevant when a specific world is selected.
          const allFactionsPromises = masterWorlds.map(mw => getAllLoreEntriesForMasterWorld(mw.id, "FACTION"));
          const allFactionsArrays = await Promise.all(allFactionsPromises);
          factionsForWorld = allFactionsArrays.flat();
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

    // Only fetch if master worlds have loaded (to avoid issues with selectedMasterWorld initialization)
    if (!isLoadingWorlds) {
      fetchLoreEntriesAndWorldDetails();
    }
  }, [selectedMasterWorld, isLoadingWorlds, masterWorlds]); // masterWorlds is needed for "All Worlds" faction fetching

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (selectedOption: SingleValue<SelectOption>, actionMeta: { name: string }) => {
    setFormData(prev => ({
        ...prev,
        [actionMeta.name]: selectedOption ? selectedOption.value : null,
        // If changing entry type to non-CHARACTER_LORE, clear faction_id
        ...(actionMeta.name === 'entry_type' && selectedOption?.value !== 'CHARACTER_LORE' && { faction_id: null })
    }));
  };

  const handleOpenModal = (entry?: LoreEntryData) => {
    // If creating a new entry, require a selected master world
    if (!entry && !selectedMasterWorld) {
      setError("Please select a Master World before creating a new lore entry.");
      return;
    }
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        name: entry.name,
        entry_type: entry.entry_type,
        description: entry.description || '',
        tags: entry.tags ? [...entry.tags] : [],
        aliases: entry.aliases ? [...entry.aliases] : [],
        faction_id: entry.faction_id || null,
      });
    } else {
      setEditingEntry(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
    setError(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (!selectedMasterWorld?.value) { 
      setError("Please select a Master World to save the lore entry."); 
      setIsSubmitting(false); 
      return; 
    }
    if (!formData.name.trim()) { setError("Name is required."); setIsSubmitting(false); return; }
    if (!formData.entry_type) { setError("Entry Type is required."); setIsSubmitting(false); return; }

    const isEdit = Boolean(editingEntry);
    const masterWorldId = selectedMasterWorld.value;
    
    // Always include master_world_id as string when creating
    const payload = {
      name: formData.name,
      entry_type: formData.entry_type,
      description: formData.description,
      tags: formData.tags,
      aliases: formData.aliases,
      faction_id: formData.entry_type === "CHARACTER_LORE" ? formData.faction_id : null,
      event_data: formData.entry_type === "EVENT" ? null : undefined,
      master_world_id: masterWorldId
    };

    setError(null);
    try {
      if (isEdit) {
        await updateLoreEntry(masterWorldId, editingEntry!.id, payload);
      } else {
        // Use FormData for creation to match backend expectations
        const formData = new FormData();
        formData.append('data', JSON.stringify(payload));
        await createLoreEntryForMasterWorld(masterWorldId, formData);
      }
      handleCloseModal();
      
      // Refresh lore entries based on current selection
      let entriesData: LoreEntryData[];
      let factionsData: LoreEntryData[];
      
      if (selectedMasterWorld?.value) {
        [entriesData, factionsData] = await Promise.all([
          getAllLoreEntriesForMasterWorld(selectedMasterWorld.value),
          getAllLoreEntriesForMasterWorld(selectedMasterWorld.value, "FACTION")
        ]);
      } else {
        [entriesData, factionsData] = await Promise.all([
          getAllLoreEntries(),
          getAllLoreEntries("FACTION")
        ]);
      }
      
      setLoreEntries(entriesData);
      setFactionsOptions(factionsData.map(f => ({ value: f.id, label: f.name })));
    } catch (err: any) {
      console.log('Full error response:', err.response?.data);
      let apiError = isEdit ? 'Failed to update lore entry.' : 'Failed to create lore entry.';
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          apiError = err.response.data.detail.map((e: any) => {
            const field = e.loc?.join('.') || 'field';
            return `${field}: ${e.msg}`;
          }).join(' | ');
        } else if (typeof err.response.data.detail === 'string') {
          apiError = err.response.data.detail;
        }
      } else if (err.code === 'ECONNABORTED') {
        apiError = 'Request timed out. The server might be slow to respond or there\'s a network issue.';
      }
      setError(apiError);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!selectedMasterWorld?.value) {
      setError("Please select a Master World to delete from.");
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this lore entry?')) {
      setIsLoading(true);
      try {
        await deleteLoreEntry(selectedMasterWorld.value, entryId);
        
        // Refresh lore entries based on current selection
        let entriesData: LoreEntryData[];
        let factionsData: LoreEntryData[];
        
        if (selectedMasterWorld?.value) {
          [entriesData, factionsData] = await Promise.all([
            getAllLoreEntriesForMasterWorld(selectedMasterWorld.value),
            getAllLoreEntriesForMasterWorld(selectedMasterWorld.value, "FACTION")
          ]);
        } else {
          [entriesData, factionsData] = await Promise.all([
            getAllLoreEntries(),
            getAllLoreEntries("FACTION")
          ]);
        }
        
        setLoreEntries(entriesData);
        setFactionsOptions(factionsData.map(f => ({ value: f.id, label: f.name })));
      } catch (err: any) {
         setError(err.response?.data?.detail || 'Failed to delete lore entry.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handler to open the new world modal
  const handleOpenNewWorldModal = () => {
    setNewWorldName("");
    setNewWorldModalOpen(true);
  };

  // Handler to close the new world modal
  const handleCloseNewWorldModal = () => {
    setNewWorldModalOpen(false);
  };

  // Handler to create a new master world
  const handleCreateNewWorld = async () => {
    if (!newWorldName.trim()) {
      setError("World name cannot be empty.");
      return;
    }

    try {
      // Only send { name } to the backend
      const newWorld = await createMasterWorld({ name: newWorldName.trim() });
      setMasterWorlds(prev => [...prev, newWorld]);
      handleCloseNewWorldModal();
      setSelectedMasterWorld({ value: newWorld.id, label: newWorld.name });
      navigate(`/world-lore/${newWorld.id}/entries`, { replace: true });
    } catch (err: any) {
      let apiError = "Failed to create a new world.";
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          apiError = err.response.data.detail.map((e: any) => {
            const field = e.loc?.join('.') || 'field';
            return `${field}: ${e.msg}`;
          }).join(' | ');
        } else if (typeof err.response.data.detail === 'string') {
          apiError = err.response.data.detail;
        } else if (typeof err.response.data.detail === 'object') {
          apiError = JSON.stringify(err.response.data.detail);
        }
      }
      setError(apiError);
      console.error(err);
    }
  };

  // Handler to delete the selected master world
  const handleDeleteSelectedWorld = async () => {
    if (!selectedMasterWorld?.value) return;
    if (!window.confirm('Are you sure you want to delete this MasterWorld? This will remove all its lore entries.')) return;
    setIsLoadingWorlds(true);
    setError(null);
    try {
      // Assume deleteMasterWorld is available in api.ts
      await (await import('../services/api')).deleteMasterWorld(selectedMasterWorld.value);
      setMasterWorlds(prev => prev.filter(w => w.id !== selectedMasterWorld.value));
      setSelectedMasterWorld(null);
      navigate('/world-lore/entries', { replace: true });
    } catch (err: any) {
      let apiError = 'Failed to delete MasterWorld.';
      if (err.response?.data?.detail) {
        apiError = typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail);
      }
      setError(apiError);
      console.error(err);
    } finally {
      setIsLoadingWorlds(false);
    }
  };

  if (isLoading || isLoadingWorlds) {
    return <p className="text-center text-gray-400 p-10">Loading lore entries...</p>;
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8 max-h-screen overflow-y-auto custom-scrollbar">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-white font-quintessential">
              MasterWorld
            </h1>
            {selectedMasterWorld && (
              <button 
                onClick={() => handleOpenModal()} 
                className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
              >
                + New Lore
              </button>
            )}
          </div>
        </div>

        {/* Master World Dropdown with Add and Delete buttons */}
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={handleOpenNewWorldModal}
            className="bg-app-accent text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md flex items-center gap-2"
          >
            <span className="material-icons-outlined">add</span>
          </button>
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
          <button
            onClick={handleDeleteSelectedWorld}
            disabled={!selectedMasterWorld}
            className="bg-app-accent text-app-bg font-semibold py-2 px-4 rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete selected MasterWorld"
          >
            <span className="material-icons-outlined">remove</span>
          </button>
        </div>

        {error && (
          <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
            {Array.isArray(error)
              ? error.map((e, i) => <span key={i}>{typeof e === 'string' ? e : JSON.stringify(e)}</span>)
              : typeof error === 'object'
                ? JSON.stringify(error)
                : error}
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
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 justify-items-start w-full">
                    {entriesOfType.map(entry => (
                      <div
                        key={entry.id}
                        className="bg-app-surface rounded-lg shadow-lg flex flex-col items-start justify-center w-36 h-20 md:w-44 md:h-22 lg:w-52 lg:h-24 p-2 relative overflow-hidden cursor-pointer group transition-transform hover:scale-105"
                        onClick={() => handleOpenModal(entry)}
                      >
                        {/* Delete button as overlay in top-right */}
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                          className="absolute top-1 right-1 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full z-10 bg-app-surface/80"
                          title="Delete Lore Entry"
                          style={{ lineHeight: 1 }}
                        >
                          <DeleteIcon className="h-5 w-5" />
                        </button>
                        {/* Main info left-aligned and vertically centered */}
                        <div className="flex flex-col items-start justify-center w-full h-full p-1">
                          <h2 className="text-lg font-semibold text-white break-words whitespace-normal leading-tight mb-2 w-full truncate text-left" title={entry.name}>{entry.name}</h2>
                          <p className="text-xs px-2 py-0.5 rounded-full font-semibold bg-app-accent text-app-bg text-left truncate max-w-full">
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

        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingEntry ? "Edit Lore Entry" : "Create New Lore Entry"}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full space-y-2 max-h-[70vh] overflow-y-auto p-1 custom-scrollbar"
          >
            <div>
              <label htmlFor="le-name" className="block text-sm font-medium text-gray-300 mb-1">Name <span className="text-app-accent">*</span></label>
              <input type="text" name="name" id="le-name" value={formData.name} onChange={handleInputChange} required
                     className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white" autoComplete="off"/>
            </div>
            <div>
              <label htmlFor="le-entry_type" className="block text-sm font-medium text-gray-300 mb-1">Entry Type <span className="text-app-accent">*</span></label>
              <Select<SelectOption>
                inputId="le-entry_type" name="entry_type" options={entryTypeOptions}
                value={entryTypeOptions.find(opt => opt.value === formData.entry_type) || null}
                onChange={(opt) => handleSelectChange(opt as SingleValue<SelectOption>, { name: 'entry_type' })}
                classNamePrefix="react-select"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    backgroundColor: "#343a40",
                    borderColor: state.isFocused ? "#f8f9fa" : "#343a40",
                    boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                    '&:hover': { borderColor: "#f8f9fa" },
                    minHeight: "42px",
                  }),
                  singleValue: (base, state) => ({ ...base, color: state.isDisabled ? "#6B7280" : "#fff" }),
                  menu: (base) => ({ ...base, backgroundColor: "#343a40", zIndex: 10 }),
                  option: (base, { isFocused, isSelected }) => ({
                    ...base,
                    backgroundColor: isSelected ? "#f8f9fa" : isFocused ? "#dee2e6" : "#343a40",
                    color: isSelected || isFocused ? "#212529" : "#fff",
                    ':active': { backgroundColor: "#f8f9fa", color: "#212529" },
                  }),
                  placeholder: (base) => ({ ...base, color: "#9CA3AF" }),
                  input: (base) => ({ ...base, color: "#fff" }),
                  dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
                  clearIndicator: (base) => ({ ...base, color: "#9CA3AF", ':hover': { color: "#fff" } }),
                  indicatorSeparator: (base) => ({ ...base, backgroundColor: "#343a40" }),
                }}
              />
            </div>
            <div>
              <label htmlFor="le-description" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea name="description" id="le-description" rows={3} value={formData.description} onChange={handleInputChange}
                        className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white" autoComplete="off"/>
            </div>
            <div>
              <label htmlFor="le-tags" className="block text-sm font-medium text-gray-300 mb-1">Tags</label>
              <ReactTagInput
                key={`tags-${editingEntry?.id || 'new'}`}
                tags={[...formData.tags]}
                onChange={(newTags) => setFormData(prev => ({ ...prev, tags: newTags }))}
                placeholder="Add tags (press enter, comma, or space)"
              />
            </div>
            <div>
              <label htmlFor="le-aliases" className="block text-sm font-medium text-gray-300 mb-1">Aliases/Keywords</label>
              <ReactTagInput
                key={`aliases-${editingEntry?.id || 'new'}`}
                tags={[...formData.aliases]}
                onChange={(newAliases) => setFormData(prev => ({ ...prev, aliases: newAliases }))}
                placeholder="Add aliases (press enter, comma, or space)"
              />
            </div>
            {formData.entry_type === "CHARACTER_LORE" && (
              <div>
                <label htmlFor="le-faction_id" className="block text-sm font-medium text-gray-300 mb-1">Group</label>
                <Select<SelectOption>
                  inputId="le-faction_id" name="faction_id" options={factionsOptions}
                  value={factionsOptions.find(opt => opt.value === formData.faction_id) || null}
                  onChange={(opt) => handleSelectChange(opt as SingleValue<SelectOption>, { name: 'faction_id' })}
                  isClearable placeholder="Select a faction..."
                  classNamePrefix="react-select"
                  noOptionsMessage={() => factionsOptions.length === 0 ? "No groups in this world. Create one first!" : "No options"}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      backgroundColor: "#343a40",
                      borderColor: state.isFocused ? "#f8f9fa" : "#343a40",
                      boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                      '&:hover': { borderColor: "#f8f9fa" },
                      minHeight: "42px",
                    }),
                    singleValue: (base, state) => ({ ...base, color: state.isDisabled ? "#6B7280" : "#fff" }),
                    menu: (base) => ({ ...base, backgroundColor: "#343a40", zIndex: 10 }),
                    option: (base, { isFocused, isSelected }) => ({
                      ...base,
                      backgroundColor: isSelected ? "#f8f9fa" : isFocused ? "#dee2e6" : "#343a40",
                      color: isSelected || isFocused ? "#212529" : "#fff",
                      ':active': { backgroundColor: "#f8f9fa", color: "#212529" },
                    }),
                    placeholder: (base) => ({ ...base, color: "#9CA3AF" }),
                    input: (base) => ({ ...base, color: "#fff" }),
                    dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
                    clearIndicator: (base) => ({ ...base, color: "#9CA3AF", ':hover': { color: "#fff" } }),
                    indicatorSeparator: (base) => ({ ...base, backgroundColor: "#343a40" }),
                  }}
                />
              </div>
            )}
            <div className="flex gap-2 mb-1">
              <button
                type="submit"
                className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
                disabled={isSubmitting}
              >
                {isSubmitting ? (editingEntry ? "Saving..." : "Creating...") : (editingEntry ? "Save Changes" : "Create Lore Entry")}
              </button>
            </div>
          </form>
        </Modal>

        {/* New Master World Modal */}
        <Modal
          isOpen={newWorldModalOpen}
          onClose={handleCloseNewWorldModal}
          title="Create New Master World"
        >
          <div className="p-4">
            <div>
              <label htmlFor="new-world-name" className="block text-sm font-medium text-gray-300 mb-1">World Name <span className="text-app-accent">*</span></label>
              <input
                type="text"
                id="new-world-name"
                value={newWorldName}
                onChange={(e) => setNewWorldName(e.target.value)}
                className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white"
                placeholder="Enter the name of the new world"
                autoComplete="off"
                required
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreateNewWorld}
                className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md flex-1"
              >
                Create World
              </button>
              <button
                onClick={handleCloseNewWorldModal}
                className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
};

export default MasterWorldPage;
