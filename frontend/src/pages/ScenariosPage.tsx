// frontend/src/pages/ScenariosPage.tsx
import React, { useState, useEffect, type FormEvent, useRef } from "react";
import Select, { type SingleValue } from "react-select";
import { useNavigate } from "react-router-dom";
import { 
  createOrGetCardChat,
} from "../services/api";
import {
  getAllScenarioCards,
  createScenarioCard,
  updateScenarioCard,
  deleteScenarioCard,
  getAllMasterWorlds,
  type MasterWorldData,
  type ScenarioCardData,
} from "../services/api";
import { CardImage } from '../components/CardImage';
import { createPNGWithEmbeddedData } from '../utils/pngExport';
import { createZipWithEmbeddedData } from '../utils/zipExport';
import { motion, AnimatePresence } from 'framer-motion';
import ExportButton from '../components/ExportButton';

const iconBaseClass = "material-icons-outlined text-2xl flex-shrink-0";
const EditIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>edit</span>
);
const DeleteIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>delete</span>
);

interface SelectOption {
  value: string;
  label: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-app-bg p-6 rounded-lg shadow-xl w-full max-w-lg text-white transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow">
        <div className="flex justify-between items-center mb-6 relative">
          <h2 className="text-xl font-semibold text-app-accent text-center w-full">{title}</h2>
          <button
            onClick={onClose}
            className="text-app-accent-3 hover:text-app-accent transition-colors text-2xl absolute right-6 top-6"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

interface ScenarioFormData {
  name: string;
  description: string;
  instructions: string;
}

const initialFormFields: ScenarioFormData = {
  name: "",
  description: "",
  instructions: "",
};

const initialBeginningMessages = [""];

// Utility function for truncating filenames
function truncateFilename(filename: string | null | undefined, maxLength = 20): string {
  if (!filename) return "Select Image";
  if (filename.length <= maxLength) return filename;
  return filename.substring(0, maxLength - 3) + "...";
}

const ScenariosPage: React.FC = () => {
  const navigate = useNavigate(); // Add this line

  const [scenarios, setScenarios] = useState<ScenarioCardData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingScenario, setEditingScenario] =
    useState<ScenarioCardData | null>(null);
  const [formFields, setFormFields] =
    useState<ScenarioFormData>(initialFormFields);

  // States for Example Dialogues
  const [currentExampleDialogues, setCurrentExampleDialogues] = useState<string[]>([""]);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState<number>(0);
  const [currentBeginningMessages, setCurrentBeginningMessages] = useState<string[]>(initialBeginningMessages);
  const [currentBmgIndex, setCurrentBmgIndex] = useState<number>(0);
  // Image states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState<boolean>(false);

  // Helper to handle image change or delete
  const handleImageChangeOrDelete = (file: File | null) => {
    if (file) {
      // Replacing: set new file, mark for removal if editing and there was an image
      setImageFile(file);
      if (editingScenario && editingScenario.image_url) {
        setImageRemoved(true); // Mark old image for removal
      } else {
        setImageRemoved(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      // Deleting: clear file, mark for removal if editing and there was an image
      setImageFile(null);
      if (editingScenario && editingScenario.image_url) {
        setImageRemoved(true);
      } else {
        setImageRemoved(false);
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

  // Master World states
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [selectedMasterWorldForForm, setSelectedMasterWorldForForm] =
    useState<SingleValue<SelectOption>>(null);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState<boolean>(false);

  useEffect(() => {
    const fetchWorlds = async () => {
      setIsLoadingWorlds(true);
      try {
        const worldsData = await getAllMasterWorlds();
        setMasterWorlds(worldsData);
        if (worldsData.length > 0) {
          // No need to set selected world for list in scenarios page
        }
      } catch (err) {
        console.error("Failed to load master worlds", err);
        setError("Could not load master worlds.");
      } finally {
        setIsLoadingWorlds(false);
      }
    };
    fetchWorlds();
  }, []);

  // Move fetchScens to a named function so it can be called from handleCloseModal
  const fetchScenarios = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllScenarioCards();
      setScenarios(data);
    } catch (err) {
      setError("Failed to load scenarios.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  const handleStaticInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormFields((prev) => ({ ...prev, [name]: value }));
  };

  // --- Handlers for Example Dialogues ---
  const handleCurrentDialogueChange = (value: string) => {
    const newDialogues = [...currentExampleDialogues];
    newDialogues[currentDialogueIndex] = value;
    setCurrentExampleDialogues(newDialogues);
  };

  const addDialogueField = () => {
    setCurrentExampleDialogues((prev) => [...prev, ""]);
    setCurrentDialogueIndex((prev) => prev + 1);
  };

  const removeCurrentDialogueField = () => {
    if (currentExampleDialogues.length > 1) {
      setCurrentExampleDialogues((prev) => {
        const newDialogues = prev.filter((_, i) => i !== currentDialogueIndex);
        return newDialogues.length > 0 ? newDialogues : [""];
      });
      setCurrentDialogueIndex((prev) => Math.min(prev, currentExampleDialogues.length - 2));
    }
  };

  const navigateDialogues = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" 
      ? Math.max(0, currentDialogueIndex - 1)
      : Math.min(currentExampleDialogues.length - 1, currentDialogueIndex + 1);
    setCurrentDialogueIndex(newIndex);
  };
  // --- End Handlers for Example Dialogues ---

  // --- Handlers for Beginning Messages ---
  const handleCurrentBmgChange = (value: string) => {
    const newMessages = [...currentBeginningMessages];
    newMessages[currentBmgIndex] = value;
    setCurrentBeginningMessages(newMessages);
  };

  const addBmgField = () => {
    setCurrentBeginningMessages((prev) => [...prev, ""]);
    setCurrentBmgIndex((prev) => prev + 1);
  };

  const removeCurrentBmgField = () => {
    if (currentBeginningMessages.length > 1) {
      setCurrentBeginningMessages((prev) => {
        const newMessages = prev.filter((_, i) => i !== currentBmgIndex);
        return newMessages.length > 0 ? newMessages : [""];
      });
      setCurrentBmgIndex((prev) => Math.min(prev, currentBeginningMessages.length - 2));
    }
  };

  const navigateBmg = (direction: "prev" | "next") => {
    const newIndex = direction === "prev"
      ? Math.max(0, currentBmgIndex - 1)
      : Math.min(currentBeginningMessages.length - 1, currentBmgIndex + 1);
    setCurrentBmgIndex(newIndex);
  };
  // --- End Handlers for Beginning Messages ---

  const handleMasterWorldChangeForForm = (
    selectedOption: SingleValue<SelectOption>
  ) => {
    setSelectedMasterWorldForForm(selectedOption);
  };

  const handleOpenModal = (scenario?: ScenarioCardData) => {
    setError(null);
    setEditingScenario(scenario || null);
    if (scenario) {
      setImageFile(null);
      setImageRemoved(false);
      setFormFields({
        name: scenario.name,
        description: scenario.description || "",
        instructions: scenario.instructions || "",
      });
      setCurrentExampleDialogues(
        scenario.example_dialogues?.length ? [...scenario.example_dialogues] : [""]
      );
      setCurrentBeginningMessages(
        scenario.beginning_message?.length ? [...scenario.beginning_message] : [""]
      );
      const worldOption = masterWorlds.find(w => w.id === scenario.master_world_id);
      setSelectedMasterWorldForForm(
        worldOption ? { value: worldOption.id, label: worldOption.name } : null
      );
    } else {
      setImageFile(null);
      setImageRemoved(false);
      setFormFields(initialFormFields);
      setCurrentExampleDialogues([""]);
      setCurrentBeginningMessages([""]);
      setSelectedMasterWorldForForm(null);
    }
    setCurrentDialogueIndex(0);
    setCurrentBmgIndex(0);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingScenario(null);
    setFormFields(initialFormFields);
    setSelectedMasterWorldForForm(null);
    setError(null);
    // Always refresh scenarios after closing modal to ensure UI is up to date
    fetchScenarios();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formFields.name.trim()) {
      setError("Name is required.");
      return;
    }

    // Filter out empty strings from arrays
    const filteredExampleDialogues = currentExampleDialogues
      .map(d => d.trim())
      .filter(d => d.length > 0);
    
    const filteredBeginningMessages = currentBeginningMessages
      .map(m => m.trim())
      .filter(m => m.length > 0);

    // Create base scenario data
    const scenarioData = {
      name: formFields.name.trim(),
      description: formFields.description?.trim() || "",
      instructions: formFields.instructions?.trim() || "",
      example_dialogues: filteredExampleDialogues,
      beginning_message: filteredBeginningMessages,
      master_world_id: selectedMasterWorldForForm?.value || ""
    };

    setIsSubmitting(true);
    setError(null);
    try {
      // Always use FormData, append scenarioData as JSON string
      const formData = new FormData();
      formData.append('data', JSON.stringify(scenarioData));
      // Only append image if exists
      if (imageFile) {
        formData.append('image', imageFile);
      }
      // Only append remove_image if editing and imageRemoved
      if (editingScenario && imageRemoved) {
        formData.append('remove_image', 'true');
      }
      // Submit to API
      if (editingScenario) {
        await updateScenarioCard(editingScenario.id, formData);
      } else {
        await createScenarioCard(formData);
      }

      const data = await getAllScenarioCards();
      setScenarios(data);
      handleCloseModal();
    } catch (err: any) {
      console.error("Failed to save scenario:", err);
      setError(err.response?.data?.detail || "Failed to save scenario");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (scenarioId: string) => {
    try {
      await deleteScenarioCard(scenarioId);
      // Refresh the scenarios list
      const data = await getAllScenarioCards();
      setScenarios(data);
    } catch (err) {
      console.error("Failed to delete scenario:", err);
      setError("Failed to delete scenario");
    }
  };

  const handleScenarioClick = async (scenarioId: string) => {
    try {
      const chatId = await createOrGetCardChat('scenario', scenarioId);
      navigate(`/chat/${chatId}`);
    } catch (error) {
      console.error('Error handling scenario session:', error);
      setError('Could not start scenario session');
    }
  };

  // Fix export handler for scenario export
  const handleExport = async (scen: ScenarioCardData) => {
    try {
      const pngBlob = await createPNGWithEmbeddedData(scen, 'scenario_card', scen.image_url);
      const filename = `${(scen.name || 'scenario').replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50)}.png`;
      const url = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export scenario');
      console.error(err);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension === 'png') {
      // Handle PNG import
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        // Extract scenario data from PNG
        const scenarioData = await createPNGWithEmbeddedData(scenario, "scenario_card");
        console.log("Imported scenario data from PNG:", scenarioData);
        // TODO: Populate form fields and open modal for imported scenario
      } catch (err) {
        console.error("Failed to import PNG:", err);
        setError("Failed to import PNG");
      }
    } else if (fileExtension === 'zip') {
      // Handle ZIP import
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        // Extract scenario data from ZIP
        const scenarioData = await createZipWithEmbeddedData(scenario, "scenario_card");
        console.log("Imported scenario data from ZIP:", scenarioData);
        // TODO: Populate form fields and open modal for imported scenario
      } catch (err) {
        console.error("Failed to import ZIP:", err);
        setError("Failed to import ZIP");
      }
    } else {
      setError("Invalid file type. Please upload a PNG or ZIP file.");
    }
  };

  const masterWorldOptions = masterWorlds.map((w) => ({
    value: w.id,
    label: w.name,
  }));

  return (
    <div className="container mx-auto p-4 md:p-8 max-h-screen overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Scenarios</h1>
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

      {isLoading && (
        <p className="text-center text-gray-400 p-10">Loading scenarios...</p>
      )}
      {!isLoading && error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}
      {!isLoading && !error && scenarios.length === 0 && (
        <div className="text-center py-10">
          <p className="text-xl text-gray-500 mb-4">No scenarios created yet. Click in + to create one</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 justify-items-start w-full">
        {scenarios.map((scen) => {
          // Cache-busting: use updated_at if available, else fallback to scenario id and name
          let cacheBuster = '';
          if (scen.updated_at) {
            cacheBuster = `?cb=${encodeURIComponent(scen.updated_at)}`;
          } else {
            cacheBuster = `?cb=${scen.id}`;
          }
          const imageUrl = scen.image_url
            ? `${scen.image_url}${cacheBuster}`
            : null;
          return (
            <div
              key={scen.id}
              className="bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer group"
              onClick={() => handleScenarioClick(scen.id)}
            >
              {/* Use CardImage for scenario images for consistent backend handling */}
              <CardImage
                imageUrl={imageUrl}
                className="absolute inset-0"
              />
              {/* Top right icons */}
              <div className="absolute top-2 right-2 flex space-x-2 z-10">
                <button
                  onClick={e => { e.stopPropagation(); handleOpenModal(scen); }}
                  className="text-gray-400 hover:text-app-accent transition-colors"
                  title="Edit Scenario"
                >
                  <EditIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(scen.id); }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete Scenario"
                >
                  <DeleteIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); handleExport(scen); }}
                  className="text-gray-400 hover:text-green-500 transition-colors p-1 rounded-full"
                  title="Export Scenario"
                >
                  <span className="material-icons-outlined">download</span>
                </button>
              </div>
              {/* Bottom info (footer) */}
              <div className="absolute bottom-0 left-0 w-full">
                <div className="w-full bg-black/30 backdrop-blur-sm p-3 flex flex-col items-start rounded-b-lg">
                  <div className="font-semibold text-lg text-white drop-shadow-md break-words">{scen.name}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingScenario ? "Edit Scenario" : "Create New Scenario"}
      >
        <div className="flex flex-row items-center justify-center gap-8 min-h-[320px]">
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
                          : (editingScenario && editingScenario.image_url
                              ? truncateFilename(editingScenario.image_url.split('/').pop() as string)
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
                  disabled={!(imageFile || (editingScenario && editingScenario.image_url && !imageRemoved))}
                >
                  <DeleteIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="scen-master_world"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Master World
              </label>
              <Select<SelectOption>
                inputId="scen-master_world"
                options={masterWorldOptions}
                value={selectedMasterWorldForForm}
                onChange={handleMasterWorldChangeForForm}
                isDisabled={isLoadingWorlds}
                placeholder="Select Master World..."
                className="text-black"
                classNamePrefix="react-select"
                styles={
                  {
                   // Estilos para tema escuro
                  control: (base, state) => ({
                    ...base,
                    backgroundColor: "#343a40", // bg-gray-800
                    borderColor: state.isFocused ? "#f8f9fa" : "#343a40", // border-blue-500 (focus), border-gray-600
                    boxShadow: state.isFocused ? "0 0 0 1px #f8f9fa" : "none",
                    "&:hover": { borderColor: "#f8f9fa" }, // border-gray-500 (hover)
                    minHeight: "42px", // Para alinhar com inputs padrão
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
                    : "#495057", // bg-blue-600 (selected), bg-gray-700 (focus)
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

            <div>
              <label
                htmlFor="scen-name"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                id="scen-name"
                autoComplete="off"
                value={formFields.name}
                onChange={handleStaticInputChange}
                required
                className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="scen-description"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Description
              </label>
              <textarea
                name="description"
                id="scen-description"
                autoComplete="off"
                rows={4}
                value={formFields.description}
                onChange={handleStaticInputChange}
                className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="scen-instructions"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Instructions
              </label>
              <textarea
                name="instructions"
                id="scen-instructions"
                autoComplete="off"
                rows={4}
                value={formFields.instructions}
                onChange={handleStaticInputChange}
                className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Example Dialogues Section */}
            <div className="space-y-2 mb-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-300">
                  Example Dialogues ({currentDialogueIndex + 1}/{currentExampleDialogues.length})
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={addDialogueField}
                    className="text-xs bg-app-accent-3 hover:bg-app-accent text-black font-semibold py-1 px-2 rounded-md"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={removeCurrentDialogueField}
                    className="text-xs bg-app-accent-3 hover:bg-app-accent text-black font-semibold py-1 px-2 rounded-md disabled:opacity-50"
                    disabled={currentExampleDialogues.length === 1 && currentExampleDialogues[0].trim() === ""}
                  >
                    -
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={currentExampleDialogues[currentDialogueIndex] || ""}
                onChange={(e) => handleCurrentDialogueChange(e.target.value)}
                className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex justify-start space-x-2 mt-2">
                <button
                  type="button"
                  onClick={() => navigateDialogues("prev")}
                  disabled={currentDialogueIndex === 0}
                  className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded-md disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => navigateDialogues("next")}
                  disabled={currentDialogueIndex === currentExampleDialogues.length - 1}
                  className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="space-y-2 mt-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-300">
                  Beginning Messages ({currentBmgIndex + 1}/{currentBeginningMessages.length})
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={addBmgField}
                    className="text-xs bg-app-accent-3 hover:bg-app-accent text-black font-semibold py-1 px-2 rounded-md"
                    title="Add New Beginning Message"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={removeCurrentBmgField}
                    className="text-xs bg-app-accent-3 hover:bg-app-accent text-black font-semibold py-1 px-2 rounded-md disabled:opacity-50"
                    disabled={currentBeginningMessages.length === 1 && currentBeginningMessages[0].trim() === ""}
                    title="Remove Current Beginning Message"
                  >
                    -
                  </button>
                </div>
              </div>
              <textarea
                id="scen-beginning_message"
                rows={3}
                value={currentBeginningMessages[currentBmgIndex] || ""}
                onChange={(e) => handleCurrentBmgChange(e.target.value)}
                className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex justify-start space-x-2 mt-2">
                <button
                  type="button"
                  onClick={() => navigateBmg("prev")}
                  disabled={currentBmgIndex === 0}
                  className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded-md disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => navigateBmg("next")}
                  disabled={currentBmgIndex === currentBeginningMessages.length - 1}
                  className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
                disabled={isSubmitting}
              >
                {isSubmitting ? (editingScenario ? "Saving..." : "Creating...") : (editingScenario ? "Save Changes" : "Create Scenario")}
              </button>
              {/* Export button inside modal */}
              {editingScenario && (
                <ExportButton cardData={editingScenario} cardType="scenario_card" imageUrl={editingScenario.image_url} />
              )}
            </div>
          </form>
          {/* Image preview section, always 3/4.5 aspect ratio, large, centered, with framer-motion pop-up */}
          <div className="flex-shrink-0 flex items-center justify-center" style={{ minWidth: 240, maxWidth: 320 }}>
            <div className="w-[240px] max-w-[320px] aspect-[3/4.5] flex items-center justify-center">
              <AnimatePresence>
                {(imageFile || (editingScenario && editingScenario.image_url && !imageRemoved)) ? (
                  <motion.img
                    key="scenario-image-preview"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    src={imageFile ? URL.createObjectURL(imageFile) : editingScenario?.image_url || ''}
                    alt="Preview"
                    className="rounded-lg object-cover w-full h-full border border-gray-700 shadow"
                    style={{ aspectRatio: '3/4.5' }}
                  />
                ) : (
                  <motion.div
                    key="scenario-image-placeholder"
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

export default ScenariosPage;
