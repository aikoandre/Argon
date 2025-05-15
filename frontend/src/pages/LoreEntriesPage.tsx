import React, { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Select, { type SingleValue } from 'react-select';
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

interface SelectOption { value: string; label: string; }
interface ModalProps { isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string; }

interface LoreEntryFormData {
  name: string;
  entry_type: string;
  description: string;
  faction_id: string | null;
  tags_string: string;
  aliases_string: string;
}

const initialFormData: LoreEntryFormData = {
  name: '',
  entry_type: VALID_ENTRY_TYPES[0],
  description: '',
  faction_id: null,
  tags_string: '',
  aliases_string: '',
};

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

  const entryTypeOptions: SelectOption[] = VALID_ENTRY_TYPES.map(type => ({ value: type, label: type.replace(/_/g, ' ') }));

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
        ...(actionMeta.name === 'entry_type' && (selectedOption?.value !== 'CHARACTER_LORE' || !selectedOption) && { faction_id: null })
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
        tags_string: entry.tags ? entry.tags.join(', ') : '',
        aliases_string: entry.aliases ? entry.aliases.join(', ') : '',
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

    const tagsForApi = formData.tags_string.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    const aliasesForApi = formData.aliases_string.split(',').map(alias => alias.trim()).filter(alias => alias.length > 0);

    const payloadForCreate: LoreEntryCreateData = {
      name: formData.name,
      entry_type: formData.entry_type,
      description: formData.description,
      faction_id: formData.entry_type === "CHARACTER_LORE" ? formData.faction_id : null,
      tags: tagsForApi.length > 0 ? tagsForApi : null,
      aliases: aliasesForApi.length > 0 ? aliasesForApi : null,
    };
    const payloadForUpdate: LoreEntryUpdateData = { ...payloadForCreate };

    setIsSubmitting(true);
    setError(null);
    try {
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
      const apiError = err.response?.data?.detail || (editingEntry ? 'Failed to update lore entry.' : 'Failed to create lore entry.');
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
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8">
        <Link to="/world-lore" className="text-blue-400 hover:text-blue-300">← Back to My Worlds</Link>
        <div className="flex justify-between items-center mt-2">
          <h1 className="text-4xl font-bold text-white">
            {currentMasterWorld?.name || 'Lore Entries'}
          </h1>
          <button 
            onClick={() => handleOpenModal()} 
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            + Create New Lore Entry
          </button>
        </div>
        <p className="text-gray-400">{currentMasterWorld?.description}</p>
      </div>

      {error && <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">{error}</p>}

      {loreEntries.length === 0 && !isLoading && (
        <p className="text-center text-gray-500 py-10">No lore entries created for this world yet.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loreEntries.map(entry => (
          <div key={entry.id} className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-semibold text-sky-400 mb-1 truncate" title={entry.name}>{entry.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                  ${entry.entry_type === 'CHARACTER_LORE' ? 'bg-purple-700 text-purple-200' :
                    entry.entry_type === 'LOCATION' ? 'bg-green-700 text-green-200' :
                    entry.entry_type === 'FACTION' ? 'bg-yellow-700 text-yellow-200' :
                    entry.entry_type === 'ITEM' ? 'bg-pink-700 text-pink-200' :
                    entry.entry_type === 'CONCEPT' ? 'bg-indigo-700 text-indigo-200' :
                    'bg-gray-700 text-gray-300'}`}>
                  {entry.entry_type.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-gray-400 mb-2 text-sm line-clamp-2" title={entry.description || undefined}>
                {entry.description || <span className="italic">No description</span>}
              </p>
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {entry.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-3">
              <button 
                onClick={() => handleOpenModal(entry)} 
                className="text-sm bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-md"
              >
                Edit
              </button>
              <button 
                onClick={() => handleDelete(entry.id)} 
                className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingEntry ? 'Edit Lore Entry' : 'Create New Lore Entry'}>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-1 pr-2">
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
            />
          </div>
          <div>
            <label htmlFor="le-description" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea name="description" id="le-description" rows={3} value={formData.description} onChange={handleInputChange} 
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500" autoComplete="off"/>
          </div>

          {formData.entry_type === "CHARACTER_LORE" && (
            <div>
              <label htmlFor="le-faction_id" className="block text-sm font-medium text-gray-300 mb-1">Faction/Group</label>
              <Select<SelectOption>
                inputId="le-faction_id" name="faction_id" options={factionsOptions}
                value={factionsOptions.find(opt => opt.value === formData.faction_id) || null}
                onChange={(opt) => handleSelectChange(opt as SingleValue<SelectOption>, { name: 'faction_id' })}
                isClearable placeholder="Select a faction..."
                className="text-black" classNamePrefix="react-select"
                noOptionsMessage={() => factionsOptions.length === 0 ? "No factions in this world. Create one first!" : "No options"}
              />
            </div>
          )}

          <div>
            <label htmlFor="le-tags" className="block text-sm font-medium text-gray-300 mb-1">Tags (comma-separated)</label>
            <input type="text" name="tags_string" id="le-tags" value={formData.tags_string} onChange={handleInputChange} 
                   placeholder="e.g., important, secret, ancient" 
                   className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500" autoComplete="off"/>
          </div>
          <div>
            <label htmlFor="le-aliases" className="block text-sm font-medium text-gray-300 mb-1">Aliases/Keywords (comma-separated)</label>
            <input type="text" name="aliases_string" id="le-aliases" value={formData.aliases_string} onChange={handleInputChange} 
                   placeholder="e.g., The Wanderer, Prophecy Fragment" 
                   className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500" autoComplete="off"/>
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
  );
};

export default LoreEntriesPage;
