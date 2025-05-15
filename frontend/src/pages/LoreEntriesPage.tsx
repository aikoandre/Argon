import React, { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select, { type SingleValue } from 'react-select';
import ReactTagInput from "@pathofdev/react-tag-input";
import "@pathofdev/react-tag-input/build/index.css";
import {
  getAllLoreEntriesForMasterWorld,
  createLoreEntryForMasterWorld,
  updateLoreEntry,
  deleteLoreEntry,
  getMasterWorldById,
  type LoreEntryData,
  type LoreEntryCreateData,
  type LoreEntryUpdateData,
  type MasterWorldData
} from '../services/api';

const VALID_ENTRY_TYPES = ["CHARACTER_LORE", "LOCATION", "FACTION", "ITEM", "CONCEPT"];

// Define the desired order for displaying sections
const DISPLAY_ENTRY_TYPES_ORDER = ["CHARACTER_LORE", "LOCATION", "FACTION", "ITEM", "CONCEPT"];

interface SelectOption { value: string; label: string; }
interface ModalProps { isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string; }

// --- DEFINE THE MODAL COMPONENT *OUTSIDE* THE MAIN PAGE COMPONENT ---
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg">
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
  faction_id: string | null;
  tags: string[];
  aliases: string[];
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
    // Adicione outros tipos que você possa ter
    default:
      // Capitaliza e remove underscores para tipos não mapeados explicitamente
      return entryType.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }
};

const initialFormData: LoreEntryFormData = {
  name: '',
  entry_type: VALID_ENTRY_TYPES[0],
  description: '',
  faction_id: null,
  tags: [],
  aliases: [],
};


const LoreEntriesPage: React.FC = () => {
  const { masterWorldId } = useParams<{ masterWorldId: string }>();
  const navigate = useNavigate();

  const [currentMasterWorld, setCurrentMasterWorld] = useState<MasterWorldData | null>(null);
  const [loreEntries, setLoreEntries] = useState<LoreEntryData[]>([]);
  const [factionsOptions, setFactionsOptions] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<LoreEntryData | null>(null);
  const [formData, setFormData] = useState<LoreEntryFormData>(initialFormData);

  const entryTypeOptions: SelectOption[] = VALID_ENTRY_TYPES.map(type => ({
  value: type,
  label: getFriendlyEntryTypeName(type)
}));

  useEffect(() => {
    if (!masterWorldId) {
      setError("Master World ID is missing from URL.");
      setIsLoading(false);
      return;
    }

    const fetchPageData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [worldDetails, entriesData, factionsData] = await Promise.all([
          getMasterWorldById(masterWorldId),
          getAllLoreEntriesForMasterWorld(masterWorldId),
          getAllLoreEntriesForMasterWorld(masterWorldId, "FACTION")
        ]);
        setCurrentMasterWorld(worldDetails);
        setLoreEntries(entriesData);
        setFactionsOptions(factionsData.map(f => ({ value: f.id, label: f.name })));
      } catch (err) {
        setError('Failed to load lore entries or world details.');
        console.error(err);
        if ((err as any).response?.status === 404) {
            navigate("/world-lore");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchPageData();
  }, [masterWorldId, navigate]);

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
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        name: entry.name,
        entry_type: entry.entry_type,
        description: entry.description || '',
        faction_id: entry.faction_id || null,
        tags: entry.tags ? [...entry.tags] : [],
        aliases: entry.aliases ? [...entry.aliases] : [],
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
    if (!masterWorldId) { setError("Cannot save: Master World context is missing."); return; }
    if (!formData.name.trim()) { setError("Name is required."); return; }
    if (!formData.entry_type) { setError("Entry Type is required."); return; }

    const tagsForApi = formData.tags;
    const aliasesForApi = formData.aliases;

    const payloadForCreate: LoreEntryCreateData = {
      name: formData.name,
      entry_type: formData.entry_type,
      description: formData.description,
      faction_id: formData.entry_type === "CHARACTER_LORE" ? (formData.faction_id || null) : null,
      tags: tagsForApi.length > 0 ? tagsForApi : null,
      aliases: aliasesForApi.length > 0 ? aliasesForApi : null,
      master_world_id: masterWorldId,
    };
    const payloadForUpdate: LoreEntryUpdateData = {
        name: formData.name,
        entry_type: formData.entry_type,
        description: formData.description,
        faction_id: formData.entry_type === "CHARACTER_LORE" ? (formData.faction_id || null) : null,
        tags: tagsForApi.length > 0 ? tagsForApi : [],
        aliases: aliasesForApi.length > 0 ? aliasesForApi : [],
    };

    setIsSubmitting(true);
    setError(null);
    try {
      console.log('Payload enviado para API:', editingEntry ? payloadForUpdate : payloadForCreate);
      if (editingEntry) {
        await updateLoreEntry(editingEntry.id, payloadForUpdate);
      } else {
        await createLoreEntryForMasterWorld(masterWorldId, payloadForCreate);
      }
      handleCloseModal();
      const entriesData = await getAllLoreEntriesForMasterWorld(masterWorldId);
      setLoreEntries(entriesData);
      const factionsData = await getAllLoreEntriesForMasterWorld(masterWorldId, "FACTION");
      setFactionsOptions(factionsData.map(f => ({ value: f.id, label: f.name })));
    } catch (err: any) {
      if (err.response?.data) {
        console.error('Resposta de erro detalhada da API:', err.response.data);
      }
      let apiError = editingEntry ? 'Failed to update lore entry.' : 'Failed to create lore entry.';
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          apiError = err.response.data.detail.map((e: any) => e.msg).join(' | ');
        } else if (typeof err.response.data.detail === 'string') {
          apiError = err.response.data.detail;
        } else if (typeof err.response.data.detail === 'object' && err.response.data.detail.msg) {
          apiError = err.response.data.detail.msg;
        }
      }
      setError(apiError);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (window.confirm('Are you sure you want to delete this lore entry?')) {
      setIsLoading(true);
      try {
        await deleteLoreEntry(entryId);
        const entriesData = await getAllLoreEntriesForMasterWorld(masterWorldId!);
        setLoreEntries(entriesData);
        const factionsData = await getAllLoreEntriesForMasterWorld(masterWorldId!, "FACTION");
        setFactionsOptions(factionsData.map(f => ({ value: f.id, label: f.name })));
      } catch (err: any) {
         setError(err.response?.data?.detail || 'Failed to delete lore entry.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isLoading) {
    return <p className="text-center text-gray-400 p-10">Loading lore entries...</p>;
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-white">
              {currentMasterWorld?.name || 'Lore Entries'}
            </h1>
            <button 
              onClick={() => handleOpenModal()} 
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md"
            >
              + New
            </button>
          </div>
          <p className="text-gray-400">{currentMasterWorld?.description}</p>
        </div>

        {error && <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">{error}</p>}

        {/* Render sections by type */}
        <div className="space-y-8">
          {DISPLAY_ENTRY_TYPES_ORDER.map(entryType => {
            const friendlyTypeName = getFriendlyEntryTypeName(entryType);
            const entriesOfType = loreEntries.filter(entry => entry.entry_type === entryType);

            return (
              <div key={entryType}>
                <h3 className="text-2xl font-semibold text-gray-300 mb-4 border-b border-gray-700 pb-2">
                  {friendlyTypeName}
                </h3>
                {entriesOfType.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Empty section</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {entriesOfType.map(entry => (
                      <div key={entry.id} className="bg-gray-800 rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden">
                        {/* Top right icons */}
                        <div className="absolute top-2 right-2 flex space-x-2 z-10">
                          <button
                            onClick={() => handleOpenModal(entry)}
                            className="text-gray-400 hover:text-blue-500 transition-colors"
                            title="Edit Lore Entry"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete Lore Entry"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 10-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        {/* Bottom left info */}
                        <div className="absolute bottom-0 left-0 w-full bg-black/40 backdrop-blur-sm p-3 flex flex-col items-start rounded-b-lg">
                          <div className="flex w-full items-center justify-between">
                            <h2 className="text-lg font-semibold text-sky-400 truncate mr-2" title={entry.name}>{entry.name}</h2>
                            <p className={`text-xs px-2 py-0.5 rounded-full font-semibold w-fit
                              ${entry.entry_type === 'CHARACTER_LORE' ? 'bg-purple-700 text-purple-200' :
                                entry.entry_type === 'LOCATION' ? 'bg-green-700 text-green-200' :
                                entry.entry_type === 'FACTION' ? 'bg-yellow-700 text-yellow-200' :
                                entry.entry_type === 'ITEM' ? 'bg-pink-700 text-pink-200' :
                                entry.entry_type === 'CONCEPT' ? 'bg-indigo-700 text-indigo-200' :
                                'bg-gray-700 text-gray-300'}`}>
                              {getFriendlyEntryTypeName(entry.entry_type)}
                            </p>
                          </div>
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 mb-1">
                              {entry.tags.map((tagValue) => (
                                <span key={tagValue} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                                  {tagValue}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingEntry ? 'Edit Lore Entry' : 'Create New Lore Entry'}>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-1 pr-2 custom-scrollbar">
            {error && isModalOpen && <p className="bg-red-700 text-white p-3 rounded-md text-sm text-center mb-3">{error}</p>}
            <div>
              <label htmlFor="le-name" className="block text-sm font-medium text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
              <input type="text" name="name" id="le-name" value={formData.name} onChange={handleInputChange} required 
                     className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500" autoComplete="off"/>
            </div>
            <div>
              <label htmlFor="le-entry_type" className="block text-sm font-medium text-gray-300 mb-1">Entry Type <span className="text-red-500">*</span></label>
              <Select<SelectOption>
                  inputId="le-entry_type" name="entry_type" options={entryTypeOptions}
                  value={entryTypeOptions.find(opt => opt.value === formData.entry_type) || null}
                  onChange={(opt) => handleSelectChange(opt as SingleValue<SelectOption>, { name: 'entry_type' })}
                  className="text-black" classNamePrefix="react-select"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      backgroundColor: "#1F2937",
                      borderColor: state.isFocused ? "#3B82F6" : "#4B5563",
                      boxShadow: state.isFocused ? "0 0 0 1px #3B82F6" : "none",
                      "&:hover": { borderColor: "#6B7280" },
                      minHeight: "42px",
                    }),
                    singleValue: (base) => ({ ...base, color: "white" }),
                    menu: (base) => ({ ...base, backgroundColor: "#1F2937", zIndex: 10 }),
                    option: (base, { isFocused, isSelected }) => ({
                      ...base,
                      backgroundColor: isSelected
                        ? "#3B82F6"
                        : isFocused
                        ? "#374151"
                        : "#1F2937",
                      color: "white",
                      ":active": { backgroundColor: "#2563EB" },
                    }),
                    placeholder: (base) => ({ ...base, color: "#9CA3AF" }),
                    input: (base) => ({ ...base, color: "white" }),
                    dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
                    clearIndicator: (base) => ({ ...base, color: "#9CA3AF", ":hover": { color: "white" } }),
                    indicatorSeparator: (base) => ({ ...base, backgroundColor: "#4B5563" }),
                  }}
              />
            </div>
            <div>
              <label htmlFor="le-description" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea name="description" id="le-description" rows={3} value={formData.description} onChange={handleInputChange} 
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500" autoComplete="off"/>
            </div>

            {formData.entry_type === "CHARACTER_LORE" && (
              <div>
                <label htmlFor="le-faction_id" className="block text-sm font-medium text-gray-300 mb-1">Group</label>
                <Select<SelectOption>
                  inputId="le-faction_id" name="faction_id" options={factionsOptions}
                  value={factionsOptions.find(opt => opt.value === formData.faction_id) || null}
                  onChange={(opt) => handleSelectChange(opt as SingleValue<SelectOption>, { name: 'faction_id' })}
                  isClearable placeholder="Select a faction..."
                  className="text-black" classNamePrefix="react-select"
                  noOptionsMessage={() => factionsOptions.length === 0 ? "No groups in this world. Create one first!" : "No options"}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      backgroundColor: "#1F2937",
                      borderColor: state.isFocused ? "#3B82F6" : "#4B5563",
                      boxShadow: state.isFocused ? "0 0 0 1px #3B82F6" : "none",
                      "&:hover": { borderColor: "#6B7280" },
                      minHeight: "42px",
                    }),
                    singleValue: (base) => ({ ...base, color: "white" }),
                    menu: (base) => ({ ...base, backgroundColor: "#1F2937", zIndex: 10 }),
                    option: (base, { isFocused, isSelected }) => ({
                      ...base,
                      backgroundColor: isSelected
                        ? "#3B82F6"
                        : isFocused
                        ? "#374151"
                        : "#1F2937",
                      color: "white",
                      ":active": { backgroundColor: "#2563EB" },
                    }),
                    placeholder: (base) => ({ ...base, color: "#9CA3AF" }),
                    input: (base) => ({ ...base, color: "white" }),
                    dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
                    clearIndicator: (base) => ({ ...base, color: "#9CA3AF", ":hover": { color: "white" } }),
                    indicatorSeparator: (base) => ({ ...base, backgroundColor: "#4B5563" }),
                  }}
                />
              </div>
            )}

            <div>
              <label htmlFor="le-tags" className="block text-sm font-medium text-gray-300 mb-1">Tags</label>
              <ReactTagInput
                tags={formData.tags}
                onChange={(newTags) => setFormData(prev => ({ ...prev, tags: newTags }))}
                placeholder="Add tags (press enter, comma, or space)"
              />
            </div>
            <div>
              <label htmlFor="le-aliases" className="block text-sm font-medium text-gray-300 mb-1">Aliases/Keywords</label>
              <ReactTagInput
                tags={formData.aliases}
                onChange={(newAliases) => setFormData(prev => ({ ...prev, aliases: newAliases }))}
                placeholder="Add aliases (press enter, comma, or space)"
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={handleCloseModal} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50">
                {isSubmitting ? (editingEntry ? 'Saving...' : 'Creating...') : (editingEntry ? 'Save Changes' : 'Create Entry')}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </>
  );
};

export default LoreEntriesPage;
