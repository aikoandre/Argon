import React, { useState, useEffect, type FormEvent, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Select, { type SingleValue } from "react-select";
import {
  getAllCharacterCards,
  createCharacterCard,
  updateCharacterCard,
  deleteCharacterCard,
  getAllMasterWorlds,
  createOrGetCardChat,
  type CharacterCardData,
  type MasterWorldData,
} from "../services/api";
import { CardImage } from "../components/CardImage";
import ImportButton from "../components/ImportButton";
import ExportButton from "../components/ExportButton";

// Modal component (inline, as in other pages)
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

// Icon components
const EditIcon = ({ className = "" }: { className?: string }) => {
  const iconBaseClass = "w-4 h-4";
  return <span className={`${iconBaseClass} ${className || ''}`.trim()}>edit</span>;
};
const DeleteIcon = ({ className = "" }: { className?: string }) => {
  const iconBaseClass = "w-4 h-4";
  return <span className={`${iconBaseClass} ${className || ''}`.trim()}>delete</span>;
};

// Utility function for truncating filenames
function truncateFilename(filename: string | null | undefined, maxLength = 20): string {
  if (!filename) return "Select Image";
  if (filename.length <= maxLength) return filename;
  return filename.substring(0, maxLength - 3) + "...";
}

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
  const handleImport = (data: any) => {
    // TODO: Implement import logic using extractJSONFromPNG or extractDataFromZip
    // For now, just log the data
    console.log('Imported character data:', data);
    // Example: setCharacters(importedCharacters);
  };
  const handleOpenChat = async (character: CharacterCardData) => {
    try {
      const chatId = await createOrGetCardChat('character', character.id);
      navigate(`/chat/${chatId}`);
    } catch (err) {
      setError("Failed to start chat session");
    }
  };

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

  // Helper to handle image change or delete (unified logic)
  const [imageRemoved, setImageRemoved] = useState<boolean>(false);
  const handleImageChangeOrDelete = (file: File | null) => {
    if (file) {
      setImageFile(file);
      setImageRemoved(false); // New image selected, not removed
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setImageFile(null);
      if (editingCharacter && editingCharacter.image_url) {
        setImageRemoved(true); // Mark for removal if editing and there was an image
      } else {
        setImageRemoved(false); // Just clear selection if creating new
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleImageChangeOrDelete(file || null); // No FileReader or setImagePreview
  };
  const handleRemoveImage = () => {
    handleImageChangeOrDelete(null); // No setImagePreview(null)
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
      setImageRemoved(false); // Reset imageRemoved when editing
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
      setImageRemoved(false); // Reset imageRemoved when creating
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
    } else if (editingCharacter && imageRemoved) {
      characterFormData.append('remove_image', 'true');
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
  const handleDelete = async (characterId: string) => {
    try {
      await deleteCharacterCard(characterId);
      // Refresh the characters list
      const data = await getAllCharacterCards();
      setCharacters(data);
    } catch (err) {
      console.error("Failed to delete character:", err);
      setError("Failed to delete character");
    }
  };

  const masterWorldOptionsForForm = masterWorlds.map((w) => ({
    value: w.id,
    label: w.name,
  }));

  console.log("Characters data:", characters);

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
    <div className="container mx-auto p-4 md:p-8 text-white max-h-screen overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Characters</h1>
        <div className="flex gap-2">
          <ImportButton onImport={handleImport} expectedType="character_card" />
          <button
            onClick={() => handleOpenModal()}
            className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            New +
          </button>
        </div>
      </div>
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
              className="relative rounded-xl shadow-lg bg-app-surface cursor-pointer group min-w-[180px] max-w-[220px] aspect-[3/4.5] flex flex-col justify-end overflow-hidden"
              onClick={() => handleOpenChat(character)}
            >
              {/* Card background image */}
              <CardImage
                imageUrl={character.image_url}
                className="absolute inset-0 w-full h-full z-0"
              />
              {/* Overlay for gradient at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-10 pointer-events-none" />
              {/* Top right icons (edit/delete/export) */}
              <div className="absolute top-2 right-2 flex gap-1 z-20">
                <ExportButton cardData={character} cardType="character_card" imageUrl={character.image_url} />
                <button
                  type="button"
                  className="bg-app-surface/80 hover:bg-app-surface/90 rounded-full p-1 text-white"
                  onClick={e => { e.stopPropagation(); handleOpenModal(character); }}
                  title="Edit"
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="bg-app-surface/80 hover:bg-red-700 rounded-full p-1 text-white"
                  onClick={e => { e.stopPropagation(); handleDelete(character.id); }}
                  title="Delete"
                >
                  <DeleteIcon />
                </button>
              </div>
              {/* Card footer with name */}
              <div className="relative z-20 w-full px-3 pb-3 pt-8 flex flex-col justify-end min-h-[60px]">
                <span className="font-semibold text-lg text-white drop-shadow-md truncate" title={character.name}>{character.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCharacter ? "Edit Character" : "Create New Character"}
      >
        <div className="flex flex-row items-center justify-center gap-8 min-h-[320px]">
          {/* Form section */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex-1 space-y-2 max-h-[70vh] overflow-y-auto p-1 pr-4 custom-scrollbar min-w-[320px]"
            style={{ maxWidth: 400 }}
          >
            {error && isModalOpen && (
              <div className="bg-app-accent-2/20 border border-app-accent-3 text-app-accent p-3 rounded-md mb-4 text-sm">
                ⚠️ {error}
              </div>
            )}
            {/* Changed to a single column grid */}
            <div className="grid grid-cols-1 gap-2">
              {/* Image upload section */}
              <div>
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
                            : (editingCharacter && editingCharacter.image_url
                                ? truncateFilename(editingCharacter.image_url.split('/').pop() as string)
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
                    disabled={!(imageFile || (editingCharacter && editingCharacter.image_url && !imageRemoved))}
                  >
                    <DeleteIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Select Master World Section */}
              <div>
                <label
                  htmlFor="char-master_world"
                  className="block text-sm font-medium text-gray-300 mb-2 mt-2"
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
                  className="text-black mb-2"
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
              {/* Name, Description, Instructions (usando formFields e handleStaticInputChange) */}
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
                  className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 mb-2"
                />
              </div>
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
                  className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 mb-2"
                />
              </div>
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
                  className="w-full p-2 bg-app-surface border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500 mb-2"
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
              <div className="space-y-2 mt-2">
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
              {/* Save & Export Button Row */}
              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (editingCharacter ? "Saving..." : "Creating...") : (editingCharacter ? "Save Changes" : "Create Character")}
                </button>
                {/* Export button always visible for editing */}
                {editingCharacter && (
                  <ExportButton cardData={editingCharacter} cardType="character_card" imageUrl={editingCharacter.image_url} />
                )}
              </div>
            </div>
          </form>
          {/* Image preview section, always 3/4.5 aspect ratio, large, centered */}
          <div className="flex-shrink-0 flex items-center justify-center" style={{ minWidth: 240, maxWidth: 320 }}>
            <div className="w-[240px] max-w-[320px] aspect-[3/4.5] flex items-center justify-center">
              {(imageFile || (editingCharacter && editingCharacter.image_url && !imageRemoved)) ? (
                <img
                  src={imageFile ? URL.createObjectURL(imageFile) : editingCharacter?.image_url || ''}
                  className="rounded-lg object-cover w-full h-full border border-gray-700 shadow"
                  style={{ aspectRatio: '3/4.5' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 rounded-lg border border-gray-700" style={{ aspectRatio: '3/4.5' }}>
                  <span className="material-icons-outlined text-5xl">image</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CharactersPage;