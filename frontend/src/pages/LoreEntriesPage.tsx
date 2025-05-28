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
  searchLoreEntries, // Import the new search function
  type LoreEntryData,
  type LoreEntryCreateData,
  type LoreEntryUpdateData,
  type MasterWorldData
} from '../services/api';

import { useRef } from 'react';
import { CardImage } from '../components/CardImage';
import useDebounce from '../hooks/useDebounce';

const iconBaseClass = "material-icons-outlined text-2xl flex-shrink-0";
const DeleteIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>delete</span>
);
const ImageIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>image</span>
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
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
  faction_id: string | null;
  tags: string[];
  aliases: string[];
  // event_data is not used for NARRATIVE_EVENT
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
  const [searchQuery, setSearchQuery] = useState<string>(''); // New state for search query
  const [isSearching, setIsSearching] = useState<boolean>(false); // New state for search loading
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // 500ms debounce
 
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<LoreEntryData | null>(null);
  const [formData, setFormData] = useState<LoreEntryFormData>(initialFormData);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null); // Track current image
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setCurrentImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
 
    const performSearch = async () => {
      setIsSearching(true);
      setError(null);
      if (debouncedSearchQuery.trim() !== '') { // Only search if query is not empty
        try {
          const results = await searchLoreEntries(masterWorldId, debouncedSearchQuery);
          setLoreEntries(results);
        } catch (err) {
          setError('Failed to search lore entries.');
          console.error(err);
        } finally {
          setIsSearching(false);
        }
      }
    };
 
    if (debouncedSearchQuery.trim() === '') {
      fetchPageData();
    } else {
      performSearch();
    }
  }, [masterWorldId, navigate, debouncedSearchQuery]); // Add debouncedSearchQuery to dependencies

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
    setImageFile(null);
    
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
      setCurrentImageUrl(entry.image_url || null); // Add this line as per MasterWorldsPage.tsx
    } else {
      setEditingEntry(null);
      setFormData(initialFormData);
      setCurrentImageUrl(null); // Add this line as per MasterWorldsPage.tsx
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
    if (!masterWorldId) { setError("Cannot save: Master World context is missing."); setIsSubmitting(false); return; }
    if (!formData.name.trim()) { setError("Name is required."); setIsSubmitting(false); return; }
    if (!formData.entry_type) { setError("Entry Type is required."); setIsSubmitting(false); return; }

    const isEdit = Boolean(editingEntry);
    const formDataToSend = new FormData();
    const payload = {
      name: formData.name,
      entry_type: formData.entry_type,
      description: formData.description || '',
      tags: formData.tags,
      aliases: formData.aliases,
      faction_id: formData.entry_type === "CHARACTER_LORE" ? formData.faction_id : null,
      event_data: formData.entry_type === "EVENT" ? null : undefined,
      ...(!isEdit && { master_world_id: masterWorldId })
    };

    formDataToSend.append('data', JSON.stringify(payload));

    if (imageFile) {
      formDataToSend.append('image', imageFile);
    }

    setError(null);
    try {
      if (isEdit) {
        await updateLoreEntry(masterWorldId, editingEntry!.id, formDataToSend);
      } else {
        await createLoreEntryForMasterWorld(masterWorldId, formDataToSend);
      }
      handleCloseModal();
      setImageFile(null);
      const entriesData = await getAllLoreEntriesForMasterWorld(masterWorldId);
      setLoreEntries(entriesData);
      const factionsData = await getAllLoreEntriesForMasterWorld(masterWorldId, "FACTION");
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
    if (window.confirm('Are you sure you want to delete this lore entry?')) {
      setIsLoading(true);
      try {
        await deleteLoreEntry(masterWorldId!, entryId);
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

  // Helper function for truncating filenames
  const truncateFilename = (filename: string | null | undefined, maxLength = 20): string => {
    if (!filename) return "Select Image";
    if (filename.length <= maxLength) return filename;
    return filename.substring(0, maxLength - 3) + '...';
  };

  if (isLoading || isSearching) {
    return <p className="text-center text-gray-400 p-10">{isLoading ? 'Loading lore entries...' : 'Searching lore entries...'}</p>;
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8 max-h-screen overflow-y-auto custom-scrollbar">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-white font-quintessential">
              {currentMasterWorld?.name || 'Lore Entries'}
            </h1>
            <button 
              onClick={() => handleOpenModal()} 
              className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
            >
              + New
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search lore entries by name, description, tags, or aliases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 bg-app-surface border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-app-accent"
            autoComplete="off"
          />
        </div>

        {error && <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">{error}</p>}

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
                        className="bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer group"
                        onClick={() => handleOpenModal(entry)}
                      >
                        <CardImage
                            imageUrl={entry.image_url || null}
                            className="absolute inset-0"
                        />
                        <div className="absolute top-2 right-2 flex space-x-2 z-10">
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full"
                            title="Delete Lore Entry"
                          >
                            <DeleteIcon className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="absolute bottom-0 left-0 w-full bg-black/30 backdrop-blur-sm p-3 flex flex-col items-start rounded-b-lg">
                          <div className="flex w-full items-start">
                            <h2 className="text-lg font-semibold text-white break-words whitespace-normal mr-2 flex-1 leading-snug" title={entry.name}>{entry.name}</h2>
                            <p className={`text-xs px-2 py-0.5 rounded-full font-semibold w-fit
                              ${entry.entry_type === 'CHARACTER_LORE' ? 'bg-app-accent text-app-bg' :
                                entry.entry_type === 'LOCATION' ? 'bg-app-accent text-app-bg' :
                                entry.entry_type === 'FACTION' ? 'bg-app-accent text-app-bg' :
                                entry.entry_type === 'ITEM' ? 'bg-app-accent text-app-bg' :
                                entry.entry_type === 'CONCEPT' ? 'bg-app-accent text-app-bg' :
                                'bg-app-accent text-app-bg'}`}>
                              {getFriendlyEntryTypeName(entry.entry_type)}
                            </p>
                          </div>
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 mb-1">
                              {entry.tags.map((tagValue) => (
                                <span key={tagValue} className="text-xs bg-app-surface text-gray-300 px-2 py-0.5 rounded">
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

:start_line:437
-------
        <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingEntry ? 'Edit Lore Entry' : 'Create New Lore Entry'}>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-1 pr-2 custom-scrollbar">
            {/* Campo de imagem opcional - agora antes do campo Name, label em cima */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Image</label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={handleSelectImageClick}
                  className="flex-1 bg-app-surface text-white font-semibold py-2 rounded-l-md flex items-center justify-center focus:outline-none h-11 overflow-hidden whitespace-nowrap"
                >
                  <ImageIcon className="w-5 h-5 mr-2" />
                  <span>{imageFile ? truncateFilename(imageFile.name) : currentImageUrl ? `Current: ${truncateFilename(currentImageUrl.split('/').pop() as string)}` : "Select Image"}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <span className="h-11 w-px bg-app-surface" />
                <button
                  type="button"
                  className="bg-app-surface hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-r-md flex items-center justify-center focus:outline-none h-11"
                  onClick={handleRemoveImage}
                  disabled={!imageFile && !currentImageUrl}
                  title="Remove image"
                >
                  <DeleteIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
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
                      backgroundColor: "#343a40", // bg-app-surface
                      borderColor: state.isFocused ? "#f8f9fa" : "#343a40", // app-accent or app-surface
                      boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                      '&:hover': { borderColor: "#f8f9fa" },
                      minHeight: "42px",
                    }),
                    singleValue: (base, state) => ({
                      ...base,
                      color: state.isDisabled ? "#6B7280" : "#fff"
                    }),
                    menu: (base) => ({ ...base, backgroundColor: "#343a40", zIndex: 10 }),
                    option: (base, { isFocused, isSelected }) => ({
                      ...base,
                      backgroundColor: isSelected
                        ? "#f8f9fa" // app-accent
                        : isFocused
                        ? "#dee2e6" // app-accent-2
                        : "#343a40", // app-surface
                      color: isSelected || isFocused ? "#212529" : "#fff", // text-app-bg or white
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
                      backgroundColor: "#343a40", // bg-app-surface
                      borderColor: state.isFocused ? "#f8f9fa" : "#343a40", // app-accent or app-surface
                      boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                      '&:hover': { borderColor: "#f8f9fa" },
                      minHeight: "42px",
                    }),
                    singleValue: (base, state) => ({
                      ...base,
                      color: state.isDisabled ? "#6B7280" : "#fff"
                    }),
                    menu: (base) => ({ ...base, backgroundColor: "#343a40", zIndex: 10 }),
                    option: (base, { isFocused, isSelected }) => ({
                      ...base,
                      backgroundColor: isSelected
                        ? "#f8f9fa" // app-accent
                        : isFocused
                        ? "#dee2e6" // app-accent-2
                        : "#343a40", // app-surface
                      color: isSelected || isFocused ? "#212529" : "#fff", // text-app-bg or white
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
            <div>
              <label htmlFor="le-description" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea name="description" id="le-description" rows={3} value={formData.description} onChange={handleInputChange}
                        className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white" autoComplete="off"/>
            </div>

            <div>
              <label htmlFor="le-tags" className="block text-sm font-medium text-gray-300 mb-1">Tags</label>
              <ReactTagInput
                key={`tags-${editingEntry?.id || 'new'}`}
                tags={[...formData.tags]} // Ensure a new array reference is always passed
                onChange={(newTags) => setFormData(prev => ({ ...prev, tags: newTags }))}
                placeholder="Add tags (press enter, comma, or space)"
              />
            </div>
            <div>
              <label htmlFor="le-aliases" className="block text-sm font-medium text-gray-300 mb-1">Aliases/Keywords</label>
              <ReactTagInput
                key={`aliases-${editingEntry?.id || 'new'}`}
                tags={[...formData.aliases]} // Ensure a new array reference is always passed
                onChange={(newAliases) => setFormData(prev => ({ ...prev, aliases: newAliases }))}
                placeholder="Add aliases (press enter, comma, or space)"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-app-accent-2 text-app-surface rounded-md font-medium disabled:opacity-50">
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
