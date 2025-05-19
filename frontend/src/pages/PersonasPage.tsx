// frontend/src/pages/PersonasPage.tsx
import React, { useState, useEffect, type FormEvent } from "react";
import Select, { type SingleValue } from "react-select";
import {
  getAllUserPersonas,
  createUserPersona,
  updateUserPersona,
  updateUserPersonaWithImage,
  deleteUserPersona,
  getUserSettings,
  updateUserSettings,
  getAllMasterWorlds,
  type UserPersonaData,
  type MasterWorldData,
  type UserPersonaUpdateData
} from "../services/api";
import { PencilSquare, TrashFill } from 'react-bootstrap-icons';
// Importe Framer Motion (se já quiser adicionar animações simples)
// import { motion, AnimatePresence } from 'framer-motion';

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
      setPersonas(data);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        // setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
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
      if (editingPersona) {
        // For updating an existing persona
        if (imageFile) {
          // If there's a new image, use a FormData approach for the update too
          const updateFormData = new FormData();
          updateFormData.append("name", formData.name);
          
          if (formData.description) {
            updateFormData.append("description", formData.description);
          } else {
            updateFormData.append("description", ""); // Send empty string for null
          }
          
          if (selectedMasterWorldForForm?.value) {
            updateFormData.append("master_world_id", selectedMasterWorldForForm.value);
          }
          
          updateFormData.append("image", imageFile);
          
          // Use a single API call that handles both data update and image upload
          await updateUserPersonaWithImage(editingPersona.id, updateFormData);
        } else {
          // No new image, use the regular JSON update
          const updatePayload: UserPersonaUpdateData = {
            name: formData.name,
            description: formData.description,
            master_world_id: selectedMasterWorldForForm?.value || null
          };
          await updateUserPersona(editingPersona.id, updatePayload);
        }
      } else {
        // For creating a new persona, use FormData only if imageFile exists
        if (imageFile) {
          const personaFormData = new FormData();
          personaFormData.append("name", formData.name);
          if (formData.description) {
            personaFormData.append("description", formData.description);
          }
          if (selectedMasterWorldForForm?.value) {
            personaFormData.append("master_world_id", selectedMasterWorldForForm.value);
          }
          personaFormData.append("image", imageFile);
          await createUserPersona(personaFormData);
        } else {
          // No image: send plain JSON
          await createUserPersona({
            name: formData.name,
            description: formData.description,
            master_world_id: selectedMasterWorldForForm?.value || null
          });
        }
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

  const handleDelete = async (personaId: string) => {
    if (window.confirm("Are you sure you want to delete this persona?")) {
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

  // Helper function to get proper image URL for persona images
  const getImageUrl = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('data:')) return imageUrl;
    if (imageUrl.startsWith('/api/images/serve/')) return imageUrl;
    const cleanPath = imageUrl.replace(/^\/static\//, '');
    return `/api/images/serve/${cleanPath}`;
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-4xl font-bold text-white font-quintessential">My Personas</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
        >
          New +
        </button>
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
            className={`bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer transform transition-transform duration-200 hover:scale-105 ${activePersonaId === persona.id ? 'ring-2 ring-app-accent' : ''}`}
            onClick={() => handleActivatePersona(persona.id)}
            title={activePersonaId === persona.id ? 'Active' : 'Click to activate'}
          >
            {persona.image_url && (
              <img 
                src={getImageUrl(persona.image_url) || undefined}
                alt={persona.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute top-2 right-2 flex space-x-2 z-10">
              <button
                onClick={e => { e.stopPropagation(); handleOpenModal(persona); }}
                className="text-gray-400 hover:text-app-accent transition-colors"
                title="Edit Persona"
              >
                <PencilSquare className="h-5 w-5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(persona.id); }}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full"
                title="Delete Persona"
              >
                <TrashFill className="h-5 w-5" />
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
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-2 hide-scrollbar bg-app-bg rounded-lg">
          {error && isModalOpen && (
            <p className="bg-red-700 text-white p-3 rounded-md text-sm text-center">
              {error}
            </p>
          )}
          {/* Image Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Image</label>
            <div className="flex items-center">
              <button type="button" className="flex-1 bg-app-surface hover:bg-gray-600 text-white font-semibold py-2 rounded-l-md flex items-center justify-center focus:outline-none h-11">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
                </svg>
                <span>Select Image</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                />
              </button>
              <span className="h-11 w-px bg-gray-600" />
              <button 
                type="button" 
                onClick={handleRemoveImage}
                className="bg-app-surface hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-r-md flex items-center justify-center focus:outline-none h-11"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 10-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <label
              htmlFor="persona-master_world"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Master World (Optional)
            </label>
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
                menu: (base) => ({
                  ...base,
                  backgroundColor: "#495057",
                  zIndex: 10,
                }),
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
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
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
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              name="description"
              id="description"
              rows={4}
              value={formData.description || ""}
              onChange={handleInputChange}
              className="w-full p-2 bg-app-surface border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-app-accent-2 text-app-surface rounded-md font-medium disabled:opacity-50"
            >
              {editingPersona ? "Save Changes" : "Create Persona"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PersonasPage;
