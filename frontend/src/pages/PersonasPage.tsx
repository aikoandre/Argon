// frontend/src/pages/PersonasPage.tsx
import React, { useState, useEffect, type FormEvent, useRef } from "react";
import Select, { type SingleValue } from "react-select";
import {
  getAllUserPersonas,
  createUserPersona,
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
import { AnimatePresence, motion } from 'framer-motion';
import ExportButton from '../components/ExportButton';

const iconBaseClass = "material-icons-outlined text-2xl flex-shrink-0";
const EditIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>edit</span>
);
const DeleteIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>delete</span>
);

// Define the SelectOption interface here
interface SelectOption {
  value: string;
  label: string;
}

// Define a form data interface to avoid type errors
interface PersonaFormData {
  name: string;
  description: string | null;
  master_world_id: string | null;
}

// Componente de Modal simples (você pode criar um arquivo separado para ele depois)
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-app-bg p-6 rounded-2xl shadow-xl w-full max-w-lg text-white transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">{title}</h2>
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

const PersonasPage: React.FC = () => {
  const [personas, setPersonas] = useState<UserPersonaData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPersona, setEditingPersona] = useState<UserPersonaData | null>(
    null
  );
  const [formData, setFormData] = useState<PersonaFormData>({
    name: "",
    description: null,
    master_world_id: null
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageRemoved, setImageRemoved] = useState<boolean>(false);

  // State for MasterWorld dropdown
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState<boolean>(true);
  const [selectedMasterWorldForForm, setSelectedMasterWorldForForm] =
    useState<SingleValue<SelectOption>>(null);

  // Handler for Master World dropdown change <-- THIS WAS ADDED PREVIOUSLY AND IS NEEDED AGAIN
  const handleMasterWorldChangeForForm = (
    selectedOption: SingleValue<SelectOption>
  ) => {
    setSelectedMasterWorldForForm(selectedOption);
  };

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

  // Effect to fetch Master Worlds
  useEffect(() => {
    const fetchWorlds = async () => {
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
    fetchWorlds();
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, []);

  useEffect(() => {
    getUserSettings().then((settings) => {
      setActivePersonaId(settings?.active_persona_id || null);
    });
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Helper to handle image change or delete (unified logic)
  const handleImageChangeOrDelete = (file: File | null) => {
    if (file) {
      setImageFile(file);
      setImageRemoved(false); // New image selected, not removed
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setImageFile(null);
      if (editingPersona && editingPersona.image_url) {
        setImageRemoved(true); // Mark for removal if editing and there was an image
      } else {
        setImageRemoved(false); // Just clear selection if creating new
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleImageChangeOrDelete(file || null);
  };
  const handleRemoveImage = () => {
    handleImageChangeOrDelete(null);
  };

  const handleOpenModal = (persona?: UserPersonaData) => {
    setError(null);
    if (persona) {
      setEditingPersona(persona);
      setFormData({
        name: persona.name,
        description: persona.description || null,
        master_world_id: persona.master_world_id || null
      });
      setImageFile(null);
      setImageRemoved(false); // Reset imageRemoved when editing

      // Set selected Master World in the form dropdown
      const worldOption = masterWorlds.find(
        (w) => w.id === persona.master_world_id
      );
      setSelectedMasterWorldForForm(
        worldOption ? { value: worldOption.id, label: worldOption.name } : null
      );
    } else {
      setEditingPersona(null);
      setFormData({ 
        name: "", 
        description: null,
        master_world_id: null
      });
      setImageFile(null);
      setImageRemoved(false); // Reset imageRemoved when creating
      setSelectedMasterWorldForForm(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPersona(null);
    setFormData({ 
      name: "", 
      description: null,
      master_world_id: null
    });
    setImageFile(null);
    setImageRemoved(false);
    setSelectedMasterWorldForForm(null);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) {
      setError("Name is required.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const personaFormData = new FormData();
      personaFormData.append('name', formData.name);

      // Append description, ensuring null becomes empty string if backend expects it
      personaFormData.append('description', formData.description || '');

      // Append master_world_id
      if (selectedMasterWorldForForm?.value) {
        personaFormData.append('master_world_id', selectedMasterWorldForForm.value);
      } else {
        personaFormData.append('master_world_id', '');
      }

      if (imageFile) {
        personaFormData.append('image', imageFile);
      } else if (editingPersona && imageRemoved) {
        personaFormData.append('remove_image', 'true');
      }

      if (editingPersona) {
        // Call the unified updateUserPersona function
        await updateUserPersona(editingPersona.id, personaFormData);
      } else {
        // Call createUserPersona
        await createUserPersona(personaFormData);
      }
      
      // After successful operation, clean up and refresh
      handleCloseModal();
      fetchPersonas();
    } catch (err: any) {
      setError(
        err.message || (editingPersona
          ? "Failed to update persona."
          : "Failed to create persona.")
      );
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (personaId: string) => {{
      setIsLoading(true);
      try {
        await deleteUserPersona(personaId);
        fetchPersonas(); // Recarrega a lista
      } catch (err) {
        setError("Failed to delete persona.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleActivatePersona = async (personaId: string) => {
    // Se já está ativa, desativa
    if (activePersonaId === personaId) {
      try {
        await updateUserSettings({ active_persona_id: null });
        setActivePersonaId(null);
      } catch (err) {
        setError("Failed to deactivate persona.");
        console.error(err);
      }
      return;
    }
    // Ativa normalmente
    try {
      await updateUserSettings({ active_persona_id: personaId });
      setActivePersonaId(personaId);
    } catch (err) {
      setError("Failed to activate persona.");
      console.error(err);
    }
  };

  // Add handleExport function for persona export
  const handleExport = async (persona: UserPersonaData) => {
    try {
      // Use ExportButton logic: prefer PNG unless persona has a masterWorld
      // (If you want ZIP with masterWorld/lore, you can extend this logic)
      const pngBlob = await createPNGWithEmbeddedData(persona, 'user_persona', persona.image_url);
      const filename = `${(persona.name || 'persona').replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50)}.png`;
      const url = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export persona');
      console.error(err);
    }
  };

  // New handler for file import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      if (file.name.endsWith('.png')) {
        // Use extractJSONFromPNG for PNG import
        const { extractJSONFromPNG } = await import('../utils/pngExport');
        const data = await extractJSONFromPNG(file);
        if (data && data.data) {
          handleOpenModal(data.data);
        } else {
          setError('No persona data found in PNG.');
        }
      } else if (file.name.endsWith('.zip')) {
        // Use extractDataFromZip for ZIP import
        const { extractDataFromZip } = await import('../utils/zipExport');
        const data = await extractDataFromZip(file);
        if (data && data.data) {
          handleOpenModal(data.data as UserPersonaData);
        } else {
          setError('No persona data found in ZIP.');
        }
      } else {
        setError('Invalid file type. Please upload a PNG or ZIP file.');
      }
    } catch (err) {
      setError('Failed to import file.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function for truncating filenames
  const truncateFilename = (filename: string | null | undefined, maxLength = 20): string => {
    if (!filename) return "Select Image";
    if (filename.length <= maxLength) return filename;
    return filename.substring(0, maxLength - 3) + '...';
  };

  // Prepare options for the Master World dropdown <-- Added this mapping inside the component
  const masterWorldOptionsForForm: SelectOption[] = masterWorlds.map((w) => ({
    value: w.id,
    label: w.name,
  }));
  // Add a "No Master World" option
  masterWorldOptionsForForm.unshift({ value: "", label: "No Master World" });

  if (isLoading && personas.length === 0 && isLoadingWorlds) {
    // Mostra loading só na primeira carga
    return (
      <p className="text-center text-gray-400 p-10">Loading personas...</p>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Personas</h1>
        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md mr-2"
          >
            Import
          </button>
          <input
            type="file"
            accept=".png,.zip"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleImportFile}
          />
          <button
            onClick={() => handleOpenModal()}
            className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            New +
          </button>
        </div>
      </div>

      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}

      {personas.length === 0 && !isLoading && !isLoadingWorlds && (
        <div className="text-center py-10">
          <p className="text-xl text-gray-500 mb-4">No persona created yet. Click in + to create one</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 justify-items-start w-full">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className="bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer group"
            onClick={() => handleActivatePersona(persona.id)}
            title={activePersonaId === persona.id ? 'Active' : 'Click to activate'}
          >
            <CardImage
              imageUrl={persona.image_url ?? null}
              className="absolute inset-0"
            />
            <div className="absolute top-2 right-2 flex space-x-2 z-10">
              <button
                onClick={e => { e.stopPropagation(); handleOpenModal(persona); }}
                className="text-gray-400 hover:text-app-accent transition-colors"
                title="Edit Persona"
              >
                <EditIcon className="h-5 w-5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(persona.id); }}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full"
                title="Delete Persona"
              >
                <DeleteIcon className="h-5 w-5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleExport(persona); }}
                className="text-gray-400 hover:text-green-500 transition-colors p-1 rounded-full"
                title="Export Persona"
              >
                <span className="material-icons-outlined h-5 w-5">file_download</span>
              </button>
            </div>
            <div className="absolute bottom-0 left-0 w-full bg-black/30 backdrop-blur-sm p-3 flex items-center rounded-b-lg">
              <h2 className="text-lg font-semibold text-white break-words whitespace-normal flex-1 leading-snug truncate" title={persona.name}>{persona.name}</h2>
              {activePersonaId === persona.id && (
                <span className="ml-2 bg-app-accent text-app-surface text-xs px-2 py-0.5 rounded-full font-semibold">Active</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingPersona ? "Edit Persona" : "Create New Persona"}
      >
        <div className="flex flex-row gap-4 min-h-[320px] items-center justify-center">
          {/* Form section */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 space-y-2 max-h-[70vh] overflow-y-auto p-1 pr-4 custom-scrollbar min-w-[320px]"
            style={{ maxWidth: 400 }}
          >
            {error && isModalOpen && (
              <p className="bg-red-700 text-white p-3 rounded-md text-sm text-center">
                {error}
              </p>
            )}
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Image</label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-app-surface hover:bg-gray-600 text-white font-semibold py-2 rounded-l-md flex items-center justify-center focus:outline-none h-11 overflow-hidden whitespace-nowrap"
                >
                  <span className="material-icons-outlined w-5 h-5 mr-2 flex-shrink-0">image</span>
                  <span className="block truncate">
                    {imageFile
                      ? truncateFilename(imageFile.name)
                      : (imageRemoved
                          ? "Select Image"
                          : (editingPersona && editingPersona.image_url
                              ? truncateFilename(editingPersona.image_url.split('/').pop() as string)
                              : "Select Image"))}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <span className="h-11 w-px bg-gray-600" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="bg-app-surface hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-r-md flex items-center justify-center focus:outline-none h-11"
                  disabled={!(imageFile || (editingPersona && editingPersona.image_url && !imageRemoved))}
                >
                  <DeleteIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="persona-master_world" className="block text-sm font-medium text-gray-300 mb-1">Master World (Optional)</label>
              <Select<SelectOption>
                inputId="persona-master_world"
                options={masterWorlds.map((w) => ({ value: w.id, label: w.name }))}
                value={selectedMasterWorldForForm}
                onChange={handleMasterWorldChangeForForm}
                isDisabled={isLoadingWorlds}
                placeholder="Select Master World..."
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
                    backgroundColor: isSelected
                      ? "#adb5bd"
                      : isFocused
                      ? "#dee2e6"
                      : "#495057",
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
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="name"
                id="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full p-2 bg-app-surface border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                name="description"
                id="description"
                rows={4}
                value={formData.description || ""}
                onChange={handleInputChange}
                className="w-full p-2 bg-app-surface border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
                disabled={isLoading}
              >
                {isLoading ? (editingPersona ? "Saving..." : "Creating...") : (editingPersona ? "Save Changes" : "Create Persona")}
              </button>
              {/* Export button inside modal */}
              {editingPersona && (
                <ExportButton cardData={editingPersona} cardType="user_persona" imageUrl={editingPersona.image_url} />
              )}
            </div>
          </form>
          {/* Image preview section, always 3/4.5 aspect ratio, large, centered, with framer-motion pop-up */}
          <div className="flex-shrink-0 flex items-center justify-center" style={{ minWidth: 240, maxWidth: 320 }}>
            <div className="w-[240px] max-w-[320px] aspect-[3/4.5] flex items-center justify-center">
              <AnimatePresence>
                {(imageFile || (editingPersona && editingPersona.image_url && !imageRemoved)) ? (
                  <motion.img
                    key="persona-image-preview"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    src={imageFile ? URL.createObjectURL(imageFile) : editingPersona?.image_url || ''}
                    alt="Preview"
                    className="rounded-lg object-cover w-full h-full border border-gray-700 shadow"
                    style={{ aspectRatio: '3/4.5' }}
                  />
                ) : (
                  <motion.div
                    key="persona-image-placeholder"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 rounded-lg border border-gray-700"
                    style={{ aspectRatio: '3/4.5' }}
                  >
                    <span className="material-icons-outlined text-5xl">image</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PersonasPage;
