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

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  imageFile?: File | null;
  editingPersona?: UserPersonaData | null;
  onImageClick?: () => void;
  isSubmitting?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, imageFile, editingPersona, onImageClick, isSubmitting }) => {
  if (!isOpen) return null;
  return (
    <>
      {/* Modal overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-75 z-[60]" />
      {/* Modal content - centered */}
      <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
        <div className="bg-app-bg rounded-2xl shadow-xl text-white relative w-full max-w-xl lg:max-w-2xl max-h-[60vh] h-[60vh] flex flex-row overflow-hidden">
          {/* Left column - Image preview and buttons */}
          <div className="flex-shrink-0 p-6 flex flex-col md:w-auto w-full relative">
            {/* Title */}
            <h2 className="text-2xl font-semibold mb-6 z-10">{title}</h2>
            
            {/* Image Preview */}
            <div className="w-[280px] flex items-center justify-center rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '3/4.5' }}>
              <ModalImagePreview 
                inlineOnly 
                imageFile={imageFile}
                editingPersona={editingPersona}
                onImageClick={onImageClick}
              />
            </div>
            
            {/* Save & Export Buttons */}
            <div className="flex gap-2 justify-center">
              <button
                type="submit"
                form="persona-form"
                className="bg-app-accent-2 text-app-surface font-semibold px-2 rounded-lg shadow-md"
                disabled={isSubmitting}
              >
                {isSubmitting ? (editingPersona ? "Saving..." : "Creating...") : (editingPersona ? "Save Changes" : "Create Persona")}
              </button>
              {editingPersona && (
                <ExportButton cardData={editingPersona} cardType="user_persona" imageUrl={editingPersona.image_url} />
              )}
            </div>
          </div>
          {/* Form content container - ensure scroll works */}
          <div className="flex-1 p-6 md:pl-0 flex flex-col min-w-[320px] min-h-0 h-full overflow-y-auto max-h-[75vh] scrollbar-thin">
            <div className="flex items-center flex-shrink-0 relative">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-3xl flex-shrink-0 absolute right-0 mt-4"
              >
                ×
              </button>
            </div>
            <div className="flex-1">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ModalImagePreview component for personas
const ModalImagePreview: React.FC<{ 
  inlineOnly?: boolean; 
  imageFile?: File | null; 
  editingPersona?: UserPersonaData | null; 
  onImageClick?: () => void;
}> = ({ inlineOnly, imageFile, editingPersona, onImageClick }) => {
  // Use props if provided, otherwise fall back to window data
  const data = inlineOnly ? { imageFile, editingPersona } : (window as any)._modalImagePreviewData;
  if (!data && !inlineOnly) return null;
  
  const { imageFile: dataImageFile, editingPersona: dataEditingPersona } = data || {};
  const showImage = dataImageFile || (dataEditingPersona && dataEditingPersona.image_url);
  
  if (inlineOnly) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onImageClick}
      >
        {showImage ? (
          <img
            src={dataImageFile ? URL.createObjectURL(dataImageFile) : dataEditingPersona?.image_url || ''}
            className="rounded-lg object-cover w-full h-full border border-gray-700 shadow-lg"
            style={{ aspectRatio: '3/4.5' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 rounded-lg border border-gray-700">
            <span className="material-icons-outlined text-5xl">image</span>
          </div>
        )}
      </div>
    );
  }
  
  if (!showImage) return null;
  
  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-[calc(100%+80px)] -translate-y-1/2 z-50 animate-slide-in-left pointer-events-none">
      <img
        src={dataImageFile ? URL.createObjectURL(dataImageFile) : dataEditingPersona?.image_url || ''}
        className="rounded-lg object-cover w-full h-full border border-gray-700 shadow-lg"
        style={{ aspectRatio: '3/4.5' }}
      />
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
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [imageRemoved, setImageRemoved] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  // Handle image click to open file picker
  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleImageChangeOrDelete(file || null);
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
    // Clear window data for ModalImagePreview
    (window as any)._modalImagePreviewData = null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) {
      setError("Name is required.");
      return;
    }

    setIsSubmitting(true);
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
      setIsSubmitting(false);
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

  // Prepare options for the Master World dropdown
  const masterWorldOptionsForForm: SelectOption[] = masterWorlds.map((w) => ({
    value: w.id,
    label: w.name,
  }));
  // Add a "No Master World" option
  masterWorldOptionsForForm.unshift({ value: "", label: "No Master World" });

  // Update window data for ModalImagePreview whenever relevant state changes
  useEffect(() => {
    if (isModalOpen) {
      (window as any)._modalImagePreviewData = { imageFile, editingPersona };
    }
  }, [isModalOpen, imageFile, editingPersona]);

  if (isLoading && personas.length === 0 && isLoadingWorlds) {
    // Mostra loading só na primeira carga
    return (
      <p className="text-center text-gray-400 p-10">Loading personas...</p>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-h-screen overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Personas</h1>
        <div>
          <button
            onClick={() => importFileInputRef.current?.click()}
            className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md mr-2"
          >
            Import
          </button>
          <input
            type="file"
            accept=".png,.zip"
            style={{ display: 'none' }}
            ref={importFileInputRef}
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
            onClick={() => handleOpenModal(persona)}
            title="Click to open modal"
          >
            <CardImage
              imageUrl={persona.image_url ?? null}
              className="absolute inset-0"
            />
              <button
                onClick={e => { e.stopPropagation(); handleDelete(persona.id); }}
                className="absolute top-2 right-3 z-20 text-app-accent hover:text-red-500 p-1.5 rounded-full transition-colors"
                title="Delete Persona"
              >
                <DeleteIcon className="w-5 h-5" />
              </button>
            <div className="absolute bottom-0 left-0 w-full bg-black/30 backdrop-blur-sm p-3 flex items-center rounded-b-lg">
              <h2 className="text-lg font-semibold text-white break-words whitespace-normal flex-1 leading-snug truncate" title={persona.name}>{persona.name}</h2>
              <button
                onClick={e => { e.stopPropagation(); handleActivatePersona(persona.id); }}
                className={`ml-2 text-black px-3 py-1 rounded-2xl text-sm font-semibold transition-colors ${
                  activePersonaId === persona.id 
                    ? 'bg-app-accent text-app-surface hover:bg-app-accent/80' 
                    : 'bg-gray-600 text-white hover:bg-gray-500'
                }`}
                title={activePersonaId === persona.id ? 'Click to deactivate' : 'Click to activate'}
              >
                {activePersonaId === persona.id ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingPersona ? "Edit Persona" : "Create New Persona"}
        imageFile={imageFile}
        editingPersona={editingPersona}
        onImageClick={handleImageClick}
        isSubmitting={isSubmitting}
      >
        <form
          id="persona-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {error && isModalOpen && (
            <p className="g-app-accent-2/20 border border-app-accent-3 text-app-accent p-3 rounded-md text-sm">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-app-accent-2 mb-2">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="persona-master_world" className="block text-sm font-medium text-gray-300 mb-1">Master World (Optional)</label>
            <Select<SelectOption>
              inputId="persona-master_world"
              options={masterWorldOptionsForForm}
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
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              name="description"
              id="description"
              rows={8}
              value={formData.description || ""}
              onChange={handleInputChange}
              className="w-full p-2 bg-app-surface border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PersonasPage;
