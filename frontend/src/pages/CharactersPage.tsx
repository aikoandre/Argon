// frontend/src/pages/CharactersPage.tsx
import React, { useState, useEffect, type FormEvent, useRef } from "react";
import Select, { type SingleValue } from "react-select"; // Removido MultiValue
import { useNavigate } from 'react-router-dom';
import {
  checkExistingChatSession,
  createChatSession
} from "../services/api";
import {
  getAllCharacterCards, // Esta função precisará aceitar masterWorldId como filtro
  createCharacterCard,
  updateCharacterCard,
  deleteCharacterCard,
  getAllMasterWorlds,
  type CharacterCardData,
  type MasterWorldData,
} from "../services/api";
import { PencilSquare, TrashFill } from 'react-bootstrap-icons';

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
      <div className="bg-app-bg p-6 rounded-2xl shadow-xl w-full max-w-lg text-white transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-center w-full">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl absolute right-6 top-6"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

interface CharacterFormData {
  // Campos que o usuário preenche diretamente no formulário
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
  // Helper function for truncating filenames
  const truncateFilename = (filename: string | null | undefined, maxLength = 35): string => {
    if (!filename) return "Select Image";
    if (filename.length <= maxLength) return filename;
    return filename.substring(0, maxLength - 3) + '...';
  };

  console.log("CharactersPage component rendering...");

  const navigate = useNavigate(); // <-- Add this line

  const [characters, setCharacters] = useState<CharacterCardData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading geral da página/lista
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCharacter, setEditingCharacter] =
    useState<CharacterCardData | null>(null);

  // Estado para os campos de texto simples do formulário
  const [formFields, setFormFields] =
    useState<CharacterFormData>(initialFormFields);

  // Image states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para listas dinâmicas
  const [currentExampleDialogues, setCurrentExampleDialogues] = useState<
    string[]
  >([""]);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState<number>(0);
  const [currentBeginningMessages, setCurrentBeginningMessages] = useState<
    string[]
  >([""]);
  const [currentBmgIndex, setCurrentBmgIndex] = useState<number>(0);

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
        console.log("Fetched Characters:", data);
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
    setCurrentExampleDialogues((prevDialogues) => [...prevDialogues, ""]);
    setCurrentDialogueIndex((prevIndex) => prevIndex + 1);
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
    setCurrentBeginningMessages((prevMessages) => [...prevMessages, ""]);
    setCurrentBmgIndex((prevIndex) => prevIndex + 1);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleOpenModal = (character?: CharacterCardData) => {
    console.log("handleOpenModal called with character:", character);
    setError(null);
    if (character) {
      setEditingCharacter(character);
      setFormFields({
        name: character.name,
        description: character.description || "",
        instructions: character.instructions || "",
      });

      // Ensure we have valid arrays for dialogues and messages
      const dialogues = Array.isArray(character.example_dialogues)
        ? character.example_dialogues.map((d) => String(d))
        : [""];
      setCurrentExampleDialogues(dialogues);
      setCurrentDialogueIndex(0);

      const messages = Array.isArray(character.beginning_messages)
        ? character.beginning_messages.map((m) => String(m))
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
      setImagePreview(null);
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
    } else if (editingCharacter && imagePreview === null) {
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

  const handleCardClick = async (characterId: string) => {
    try {
      // Only send gm_character_id, not scenario_id, and handle persona as optional/blank
      const existingSession = await checkExistingChatSession({
        gm_character_id: characterId,
        // Do not send scenario_id at all
        // Only send user_persona_id if you have a value, otherwise do not include the key
      });
      if (existingSession) {
        navigate(`/chat/${existingSession.id}`);
      } else {
        // Only send gm_character_id, not scenario_id, and handle persona as optional/blank
        const newSession = await createChatSession({
          gm_character_id: characterId,
          scenario_id: "", // required by type, but will be ignored by backend if blank
          user_persona_id: "", // required by type, but will be ignored by backend if blank
          title: `Chat with ${characters.find(c => c.id === characterId)?.name}`,
        });
        navigate(`/chat/${newSession.id}`);
      }
    } catch (error) {
      console.error('Error handling chat session:', error);
      setError('Could not start chat session');
    }
  };

  const handleDelete = async (characterId: string) => {
    console.log("handleDelete called for ID:", characterId);
    try {
      await deleteCharacterCard(characterId);
      // Refresh the character list
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

  console.log("CharactersPage component returning JSX...");
  return (
    <div className="container mx-auto p-4 md:p-8 text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-4xl font-bold text-white font-quintessential">Characters</h1>
          <button
            onClick={() => handleOpenModal()}
            className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            New +
          </button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((char) => (
            <div
              key={char.id}
              className="bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer transform transition-transform duration-200 hover:scale-105"
              onClick={() => handleCardClick(char.id)}
            >
              {char.image_url && (
                <div className="absolute inset-0">
                  <img 
                    src={char.image_url}
                    alt={char.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
              {/* Ícones de editar/excluir no topo direito */}
              <div className="absolute top-2 right-2 flex space-x-2 z-10">
                <button
                onClick={(e) => { e.stopPropagation(); handleOpenModal(char); }}
                className="text-gray-400 hover:text-app-accent transition-colors"
                title="Edit Character"
              >
                <PencilSquare className="h-5 w-5" />
              </button>
                <button
                onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full"
                title="Delete Character"
              >
                <TrashFill className="h-5 w-5" />
              </button>
              </div>
              {/* Rodapé translúcido com nome e descrição */}
              <div className="absolute bottom-0 left-0 w-full bg-black/30 backdrop-blur-sm p-3 flex items-center rounded-b-lg">
              <div className="flex w-full items-center justify-between">
                <h2 className="text-lg font-semibold text-white break-words whitespace-normal mr-2 flex-1 leading-snug">{char.name}</h2>
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
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-2 custom-scrollbar"
        >
          {error && isModalOpen && (
            <p className="bg-red-700 text-white p-3 rounded-md text-sm text-center col-span-2">
              {error}
            </p>
          )}
          {/* Changed to a single column grid */}
          <div className="grid grid-cols-1 gap-6 space-y-4">
              {/* Image upload section */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Image</label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-app-surface hover:bg-gray-600 text-white font-semibold py-2 rounded-l-md flex items-center justify-center focus:outline-none h-11 overflow-hidden whitespace-nowrap"
                  >
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
                    </svg>
                    <span className="block truncate">
                      {truncateFilename(imageFile?.name || imagePreview?.split('/').pop())}
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
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="bg-app-surface hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-r-md flex items-center justify-center focus:outline-none h-11"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 10-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Select Master World Section */}
              <div>
                <label
                  htmlFor="char-master_world"
                  className="block text-sm font-medium text-gray-300 mb-1"
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



          {/* Name, Description, Instructions (usando formFields e handleStaticInputChange) */}
          {/* ... */}
          <div>
            <label
              htmlFor="char-name"
              className="block text-sm font-medium text-gray-300 mb-1"
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
          <div>
            <label
              htmlFor="char-description"
              className="block text-sm font-medium text-gray-300 mb-1"
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
          <div>
            <label
              htmlFor="char-instructions"
              className="block text-sm font-medium text-gray-300 mb-1"
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

          {/* Example Dialogues Section (como antes) */}
          {/* ... */}
          <div className="space-y-1">
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
            <div className="flex justify-start items-center mt-1 space-x-2">
              {" "}
              <button
                type="button"
                onClick={() => navigateDialogues("prev")}
                disabled={currentExampleDialogues.length <= 1}
                className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded-md disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => navigateDialogues("next")}
                disabled={currentExampleDialogues.length <= 1}
                className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded-md disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          {/* Beginning Messages Section (como antes) */}
          {/* ... */}
          <div className="space-y-1 mt-4">
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
            <div className="flex justify-start items-center mt-1 space-x-2">
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
                disabled={
                  currentBmgIndex === currentBeginningMessages.length - 1
                }
                className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded-md disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

              {/* Save Button */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !formFields.name.trim()}
                  className="px-4 py-2 text-sm bg-app-accent-2 text-app-surface rounded-md font-medium disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingCharacter
                    ? "Save Changes"
                    : "Create Character"}
                </button>
              </div>
            </div> 
          </form>
      </Modal>

    </div>
  );
};

export default CharactersPage;
