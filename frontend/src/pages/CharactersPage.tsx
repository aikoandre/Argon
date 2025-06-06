import React, { useState, useEffect, type FormEvent, useRef } from "react";
import Select, { type SingleValue } from "react-select";
import { useNavigate } from "react-router-dom";
import { 
  createOrGetCardChat,
} from "../services/api";
import {
  getAllCharacterCards,
  createCharacterCard,
  updateCharacterCard,
  deleteCharacterCard,
  getAllMasterWorlds,
  type CharacterCardData,
  type MasterWorldData,
} from "../services/api";
import { CardImage } from "../components/CardImage";
import { createPNGWithEmbeddedData } from '../utils/pngExport';
import ExportButton from "../components/ExportButton";

const iconBaseClass = "material-icons-outlined text-2xl flex-shrink-0";

// Modal component (inline, as in other pages)
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  imageFile?: File | null;
  editingCharacter?: CharacterCardData | null;
  onImageClick?: () => void;
  formRef?: React.RefObject<HTMLFormElement | null>;
  isSubmitting?: boolean;
}
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, imageFile, editingCharacter, onImageClick, formRef, isSubmitting }) => {
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
                editingCharacter={editingCharacter}
                onImageClick={onImageClick}
              />
            </div>
            
            {/* Save & Export Buttons */}
            <div className="flex gap-2 justify-center">
              <button
                type="submit"
                form="character-form"
                onClick={(e) => {
                  e.preventDefault();
                  formRef?.current?.requestSubmit();
                }}
                className="bg-app-accent-2 text-app-surface font-semibold px-2 rounded-lg shadow-md"
                disabled={isSubmitting}
              >
                {isSubmitting ? (editingCharacter ? "Saving..." : "Creating...") : (editingCharacter ? "Save Changes" : "Create Character")}
              </button>
              {editingCharacter && (
                <ExportButton cardData={editingCharacter} cardType="character_card" imageUrl={editingCharacter.image_url} />
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

// ModalImagePreview now supports inlineOnly prop
const ModalImagePreview: React.FC<{ 
  inlineOnly?: boolean; 
  imageFile?: File | null; 
  editingCharacter?: CharacterCardData | null; 
  onImageClick?: () => void;
}> = ({ inlineOnly, imageFile, editingCharacter, onImageClick }) => {
  // Use props if provided, otherwise fall back to window data
  const data = inlineOnly ? { imageFile, editingCharacter } : (window as any)._modalImagePreviewData;
  if (!data && !inlineOnly) return null;
  
  const { imageFile: dataImageFile, editingCharacter: dataEditingCharacter } = data || {};
  const showImage = dataImageFile || (dataEditingCharacter && dataEditingCharacter.image_url);
  
  if (inlineOnly) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onImageClick}
      >
        {showImage ? (
          <img
            src={dataImageFile ? URL.createObjectURL(dataImageFile) : dataEditingCharacter?.image_url || ''}
            className="rounded-lg object-cover w-full h-full border border-gray-700 shadow-lg"
            style={{ aspectRatio: '3/4.5' }}
          />
        ) : (
          <div className="w-full h-full bg-app-surface rounded-lg flex items-center justify-center border border-gray-700">
            <span className="material-icons-outlined text-6xl text-gray-400">person</span>
          </div>
        )}
      </div>
    );
  }
  
  if (!showImage) return null;
  
  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-[calc(100%+80px)] -translate-y-1/2 z-50 animate-slide-in-left pointer-events-none">
      <img
        src={dataImageFile ? URL.createObjectURL(dataImageFile) : dataEditingCharacter?.image_url || ''}
        className="rounded-lg object-cover w-full h-full border border-gray-700 shadow-lg"
        style={{ aspectRatio: '3/4.5' }}
      />
    </div>
  );
};

// Types
interface SelectOption {
  value: string;
  label: string;
}
interface CharacterFormData {
  name: string;
  description: string;
  instructions: string;
}
const initialFormFields: CharacterFormData = {
  name: "",
  description: "",
  instructions: "",
};

const CharactersPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State management
  const [characters, setCharacters] = useState<CharacterCardData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCharacter, setEditingCharacter] =
    useState<CharacterCardData | null>(null);
  const [formFields, setFormFields] =
    useState<CharacterFormData>(initialFormFields);
  const [currentExampleDialogues, setCurrentExampleDialogues] = useState<
    string[]
  >([""]);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState<number>(0);
  const [currentBeginningMessages, setCurrentBeginningMessages] = useState<
    string[]
  >([""]);
  const [currentBmgIndex, setCurrentBmgIndex] = useState<number>(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Estados para MasterWorld
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]); // Lista de todos os mundos
  const [isLoadingWorlds, setIsLoadingWorlds] = useState<boolean>(true); // Loading para a lista de mundos
  const [selectedMasterWorldForForm, setSelectedMasterWorldForForm] =
    useState<SingleValue<SelectOption>>(null);

  // Busca todos os Master Worlds para os dropdowns/filtros
  useEffect(() => {
    console.log("useEffect: Fetching Master Worlds...");
    const fetchWorlds = async () => {
      setIsLoadingWorlds(true);
      try {
        const data = await getAllMasterWorlds();
        console.log("Fetched Master Worlds:", data);
        setMasterWorlds(data);
      } catch (err) {
        console.error("Failed to load master worlds:", err);
      } finally {
        setIsLoadingWorlds(false);
      }
    };
    fetchWorlds();
  }, []);

  // Busca todos os Characters (ou filtrados por Master World)
  useEffect(() => {
    console.log("useEffect: Fetching Characters...");
    const fetchChars = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAllCharacterCards(); // No filter
        console.log("Fetched Characters:", data); // ADDED CONSOLE LOG
        setCharacters(data);
      } catch (err) {
        setError("Failed to load characters.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchChars();
  }, []); // Only on mount

  const handleStaticInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormFields((prev) => ({ ...prev, [name]: value }));
  };

  // --- Handlers para Example Dialogues --- (como antes)
  const handleCurrentDialogueChange = (value: string) => {
    const newDialogues = [...currentExampleDialogues];
    newDialogues[currentDialogueIndex] = value;
    setCurrentExampleDialogues(newDialogues);
  };
  const addDialogueField = () => {
    setCurrentExampleDialogues((prev) => {
      const newDialogues = [...prev, ""];
      setCurrentDialogueIndex(newDialogues.length - 1);
      return newDialogues;
    });
  };
  const removeCurrentDialogueField = () => {
    if (currentExampleDialogues.length > 1) {
      setCurrentExampleDialogues((prevDialogues) => {
        const newDialogues = prevDialogues.filter(
          (_, index) => index !== currentDialogueIndex
        );
        return newDialogues.length > 0 ? newDialogues : [""];
      });
      setCurrentDialogueIndex((prevIndex) =>
        Math.min(prevIndex, currentExampleDialogues.length - 2)
      );
    }
  };
  const navigateDialogues = (direction: "prev" | "next") => {
    const newIndex =
      direction === "prev"
        ? Math.max(0, currentDialogueIndex - 1)
        : Math.min(
            currentExampleDialogues.length - 1,
            currentDialogueIndex + 1
          );
    setCurrentDialogueIndex(newIndex);
  };

  // --- Handlers para Beginning Messages --- (como antes)
  const handleCurrentBmgChange = (value: string) => {
    const newMessages = [...currentBeginningMessages];
    newMessages[currentBmgIndex] = value;
    setCurrentBeginningMessages(newMessages);
  };
  const addBmgField = () => {
    setCurrentBeginningMessages((prev) => {
      const newMessages = [...prev, ""];
      setCurrentBmgIndex(newMessages.length - 1);
      return newMessages;
    });
  };
  const removeCurrentBmgField = () => {
    if (currentBeginningMessages.length > 1) {
      setCurrentBeginningMessages((prevMessages) => {
        const newMessages = prevMessages.filter(
          (_, index) => index !== currentBmgIndex
        );
        return newMessages.length > 0 ? newMessages : [""];
      });
      setCurrentBmgIndex((prevIndex) =>
        Math.min(prevIndex, currentBeginningMessages.length - 2)
      );
    }
  };
  const navigateBmg = (direction: "prev" | "next") => {
    const newIndex =
      direction === "prev"
        ? Math.max(0, currentBmgIndex - 1)
        : Math.min(currentBeginningMessages.length - 1, currentBmgIndex + 1);
    setCurrentBmgIndex(newIndex);
  };

  const handleMasterWorldChangeForForm = (
    selectedOption: SingleValue<SelectOption>
  ) => {
    setSelectedMasterWorldForForm(selectedOption);
  };

  // Handle image selection
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle image click to open file picker
  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  console.log("CharactersPage component rendering...");
  const handleOpenModal = (character?: CharacterCardData) => {
    setError(null);
    if (character) {
      setEditingCharacter(character);
      setFormFields({
        name: character.name,
        description: character.description || "",
        instructions: character.instructions || "",
      });
      setImageFile(null);
      // Ensure we have valid arrays for dialogues and messages
      const dialogues = character.example_dialogues?.length
        ? character.example_dialogues.map((d: any) => String(d))
        : [""];
      setCurrentExampleDialogues(dialogues);
      setCurrentDialogueIndex(0);
      const messages = character.beginning_messages?.length
        ? character.beginning_messages.map((m: any) => String(m))
        : [""];
      setCurrentBeginningMessages(messages);
      setCurrentBmgIndex(0);
      // Define o MasterWorld selecionado no formulário
      const worldOption = masterWorlds.find(
        (w) => w.id === character.master_world_id
      );
      setSelectedMasterWorldForForm(
        worldOption ? { value: worldOption.id, label: worldOption.name } : null
      );
    } else {
      // Novo personagem
      setEditingCharacter(null);
      setFormFields(initialFormFields);
      setCurrentExampleDialogues([""]);
      setCurrentDialogueIndex(0);
      setImageFile(null);
      setCurrentBeginningMessages([""]);
      setCurrentBmgIndex(0);
      setSelectedMasterWorldForForm(null);
    }
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    console.log("handleCloseModal called.");
    setIsModalOpen(false);
    setEditingCharacter(null);
    setFormFields(initialFormFields);
    setCurrentExampleDialogues([""]);
    setCurrentDialogueIndex(0);
    setCurrentBeginningMessages([""]);
    setCurrentBmgIndex(0);
    setSelectedMasterWorldForForm(null);
    setError(null);
    // Clean up window data
    (window as any)._modalImagePreviewData = null;
  };
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formFields.name.trim()) {
      setError("Name is required.");
      return;
    }
    const finalDialogues = currentExampleDialogues
      .map((d) => d.trim())
      .filter((d) => d);
    const finalBeginningMessages = currentBeginningMessages
      .map((m) => m.trim())
      .filter((m) => m);
    const characterFormData = new FormData();
    characterFormData.append('name', formFields.name);
    characterFormData.append('description', formFields.description || '');
    characterFormData.append('instructions', formFields.instructions || '');
    characterFormData.append('example_dialogues', JSON.stringify(finalDialogues));
    characterFormData.append('beginning_messages', JSON.stringify(finalBeginningMessages));
    const linkedLoreIds = editingCharacter?.linked_lore_ids || [];
    characterFormData.append('linked_lore_ids', JSON.stringify(linkedLoreIds));
    if (selectedMasterWorldForForm?.value) {
      characterFormData.append('master_world_id', selectedMasterWorldForForm.value);
    } else if (editingCharacter) {
      characterFormData.append('master_world_id', '');
    }
    if (imageFile) {
      characterFormData.append('image', imageFile);
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingCharacter) {
        await updateCharacterCard(editingCharacter.id, characterFormData);
      } else {
        await createCharacterCard(characterFormData);
      }
      handleCloseModal();
      const refreshedData = await getAllCharacterCards();
      setCharacters(refreshedData);
    } catch (err: any) {
      const apiError =
        err.response?.data?.detail || (editingCharacter ? "Failed to update character." : "Failed to create character.");
      if (Array.isArray(err.response?.data?.detail)) {
        setError(err.response.data.detail.map((e: any) => e.msg).join(' | '));
      } else {
        setError(apiError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCharacterClick = async (characterId: string) => {
    try {
      const chatId = await createOrGetCardChat('character', characterId);
      navigate(`/chat/${chatId}`);
    } catch (error) {
      console.error('Error handling character session:', error);
      setError('Could not start character session');
    }
  };

  // Export handler for character export
  const handleExport = async (character: CharacterCardData) => {
    try {
      const pngBlob = await createPNGWithEmbeddedData(character, 'character_card', character.image_url);
      const filename = `${(character.name || 'character').replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50)}.png`;
      const url = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export character');
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
        // TODO: Implement PNG data extraction and populate form fields
        console.log("PNG import not yet implemented");
      } catch (err) {
        console.error("Failed to import PNG:", err);
        setError("Failed to import PNG");
      }
    } else if (fileExtension === 'zip') {
      // Handle ZIP import
      try {
        // TODO: Implement ZIP data extraction and populate form fields
        console.log("ZIP import not yet implemented");
      } catch (err) {
        console.error("Failed to import ZIP:", err);
        setError("Failed to import ZIP");
      }
    } else {
      setError("Invalid file type. Please upload a PNG or ZIP file.");
    }
  };

  const handleDelete = async (characterId: string) => {
    if (window.confirm('Are you sure you want to delete this character?')) {
      setIsLoading(true);
      try {
        await deleteCharacterCard(characterId);
        const refreshedData = await getAllCharacterCards();
        setCharacters(refreshedData);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to delete character.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const masterWorldOptionsForForm = masterWorlds.map((w) => ({
    value: w.id,
    label: w.name,
  }));

  console.log("Characters data:", characters);

  // Update window data for ModalImagePreview whenever relevant state changes
  useEffect(() => {
    if (isModalOpen) {
      (window as any)._modalImagePreviewData = { 
        imageFile, 
        editingCharacter
      };
    }
  }, [isModalOpen, imageFile, editingCharacter]);

  // Update image preview and card background logic
  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setEditingCharacter((prev) => prev ? { ...prev, image_url: url } : prev);
      };
      reader.readAsDataURL(imageFile);
    }
  }, [imageFile]);

  console.log("CharactersPage component returning JSX...");
  return (
    <div className="container mx-auto p-4 md:p-8 max-h-screen overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Characters</h1>
        <div>
          <button
            onClick={() => importFileInputRef.current?.click()}
            className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md mr-2"
          >
            Import
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            New +
          </button>
        </div>
      </div>

      {/* Hidden input for import */}
      <input
        type="file"
        accept=".png,.zip"
        style={{ display: 'none' }}
        ref={importFileInputRef}
        onChange={handleImportFile}
      />

      {isLoading && (
        <p className="text-center text-gray-400 p-10">Loading characters...</p>
      )}
      {!isLoading && error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}
      {!isLoading && !error && characters.length === 0 && (
        <div className="text-center py-10">
          <p className="text-xl text-gray-500 mb-4">No characters created yet. Click in + to create one</p>
        </div>
      )}
      {!isLoading && !error && characters.length > 0 && (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 justify-items-start w-full">
          {characters.map((character) => (
            <div
              key={character.id}
              className="bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer group"
              onClick={() => handleOpenModal(character)}
            >
              {/* Use CardImage for character images for consistent backend handling */}
              <CardImage
                imageUrl={character.image_url}
                className="absolute inset-0"
              />
              {/* Delete button positioned at top-right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(character.id);
                }}
                className="absolute top-2 right-2 z-20 text-app-accent hover:text-red-500 p-1.5 rounded-full transition-colors"
                title="Delete Character"
              >
                <span className="material-icons-outlined text-2xl">delete</span>
              </button>
              {/* Bottom info (footer) */}
              <div className="absolute bottom-0 left-0 w-full">
                <div className="w-full bg-black/30 backdrop-blur-sm p-3 flex flex-row items-center justify-between rounded-b-lg">
                  <div className="font-semibold text-lg text-white drop-shadow-md break-words flex-1" title={character.name}>{character.name}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCharacterClick(character.id);
                    }}
                    className="bg-app-accent text-black px-3 py-1 rounded-2xl text-sm font-semibold ml-2 hover:bg-app-accent/80 transition-colors"
                  >
                    Chat
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCharacter ? "Edit Character" : "Create New Character"}
        imageFile={imageFile}
        editingCharacter={editingCharacter}
        onImageClick={handleImageClick}
        formRef={formRef}
        isSubmitting={isSubmitting}
      >
        {/* Remove the image preview from inside the modal's flex row */}
        <form
          ref={formRef}
          id="character-form"
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="space-y-4">
              {error && isModalOpen && (
                <div className="bg-app-accent-2/20 border border-app-accent-3 text-app-accent p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              {/* Hidden file input for image selection */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              
              {/* Name field - moved to first position */}
              <div>
                <label
                  htmlFor="char-name"
                  className="block text-sm font-medium text-app-accent-2 mb-2"
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  id="char-name"
                  autoComplete="off"
                  value={formFields.name}
                  onChange={handleStaticInputChange}
                  required
                  className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Select Master World Section - moved after Name */}
              <div>
                <label
                  htmlFor="char-master_world"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Master World
                </label>
                <Select<SelectOption>
                  inputId="char-master_world"
                  options={masterWorldOptionsForForm}
                  value={selectedMasterWorldForForm}
                  onChange={handleMasterWorldChangeForForm}
                  isDisabled={isLoadingWorlds}
                  placeholder="Select Master World..."
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
              
              {/* Description field */}
              <div>
                <label
                  htmlFor="char-description"
                  className="block text-sm font-medium text-app-accent-2 mb-2"
                >
                  Description
                </label>
                <textarea
                  name="description"
                  id="char-description"
                  autoComplete="off"
                  rows={4}
                  value={formFields.description}
                  onChange={handleStaticInputChange}
                  className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Instructions field */}
              <div>
                <label
                  htmlFor="char-instructions"
                  className="block text-sm font-medium text-app-accent-2 mb-2"
                >
                  Instructions
                </label>
                <textarea
                  name="instructions"
                  id="char-instructions"
                  autoComplete="off"
                  rows={4}
                  value={formFields.instructions}
                  onChange={handleStaticInputChange}
                  className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Example Dialogues Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="char-current_dialogue"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Example Dialogue ({currentDialogueIndex + 1} /{" "}
                    {currentExampleDialogues.length})
                  </label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={addDialogueField}
                      className="text-xs bg-app-accent-3 hover:bg-app-accent text-black font-semibold py-1 px-2 rounded-md"
                      title="Add New Dialogue"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={removeCurrentDialogueField}
                      className="text-xs bg-app-accent-3 hover:bg-app-accent text-black font-semibold py-1 px-2 rounded-md disabled:opacity-50"
                      disabled={
                        currentExampleDialogues.length === 1 &&
                        currentExampleDialogues[0].trim() === ""
                      }
                      title="Remove Current Dialogue"
                    >
                      -
                    </button>
                  </div>
                </div>
                <textarea
                  id="char-current_dialogue"
                  rows={3}
                  value={currentExampleDialogues[currentDialogueIndex] || ""}
                  onChange={(e) => handleCurrentDialogueChange(e.target.value)}
                  placeholder={`Example Dialogue ${currentDialogueIndex + 1}`}
                  className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="off"
                />
                <div className="flex justify-start items-center mt-1 gap-2">
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
              
              {/* Beginning Messages Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="char-current_bmg"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Beginning Message ({currentBmgIndex + 1} /{" "}
                    {currentBeginningMessages.length})
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
                      disabled={
                        currentBeginningMessages.length === 1 &&
                        currentBeginningMessages[0].trim() === ""
                      }
                      title="Remove Current Beginning Message"
                    >
                      -
                    </button>
                  </div>
                </div>
                <textarea
                  id="char-current_bmg"
                  rows={3}
                  value={currentBeginningMessages[currentBmgIndex] || ""}
                  onChange={(e) => handleCurrentBmgChange(e.target.value)}
                  placeholder={`Beginning Message ${currentBmgIndex + 1}`}
                  className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="off"
                />
                <div className="flex justify-start items-center mt-1 gap-2">
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
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CharactersPage;