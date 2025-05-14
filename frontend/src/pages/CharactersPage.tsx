// frontend/src/pages/CharactersPage.tsx
import React, { useState, useEffect, type FormEvent } from "react";
import Select, { type MultiValue, type SingleValue } from "react-select"; // Adicionado SingleValue
import {
  getAllCharacterCards, // Esta função precisará aceitar masterWorldId como filtro
  createCharacterCard,
  updateCharacterCard,
  deleteCharacterCard,
  getAllLoreEntriesForMasterWorld,
  getAllMasterWorlds,
  type CharacterCardData,
  type CharacterCardCreateData,
  type CharacterCardUpdateData,
  type MasterWorldData,
} from "../services/api";

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
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg text-white transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow">
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

  // Estados para listas dinâmicas
  const [currentExampleDialogues, setCurrentExampleDialogues] = useState<
    string[]
  >([""]);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState<number>(0);
  const [currentBeginningMessages, setCurrentBeginningMessages] = useState<
    string[]
  >([""]);
  const [currentBmgIndex, setCurrentBmgIndex] = useState<number>(0);

  // Estados para MasterWorld e Lore Links
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]); // Lista de todos os mundos
  const [selectedMasterWorldForList, setSelectedMasterWorldForList] = useState<
    string | null
  >(null); // Mundo selecionado para listar Characters
  const [selectedMasterWorldForForm, setSelectedMasterWorldForForm] =
    useState<SingleValue<SelectOption>>(null); // Mundo selecionado NO FORMULÁRIO

  const [worldLoreOptions, setWorldLoreOptions] = useState<SelectOption[]>([]);
  const [selectedLoreLinks, setSelectedLoreLinks] = useState<
    MultiValue<SelectOption>
  >([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState<boolean>(false); // Para dropdown de mundos
  const [isLoadingLore, setIsLoadingLore] = useState<boolean>(false); // Para dropdown de lore

  // Busca Master Worlds para o dropdown de filtro da página
  useEffect(() => {
    const fetchWorlds = async () => {
      setIsLoadingWorlds(true);
      try {
        const worldsData = await getAllMasterWorlds();
        setMasterWorlds(worldsData);
        if (worldsData.length > 0 && !selectedMasterWorldForList) {
          setSelectedMasterWorldForList(worldsData[0].id); // Seleciona o primeiro por padrão para listar
        }
      } catch (err) {
        console.error("Failed to load master worlds", err);
        setError("Could not load master worlds.");
      } finally {
        setIsLoadingWorlds(false);
      }
    };
    fetchWorlds();
  }, []); // Roda uma vez

  // Busca Characters quando selectedMasterWorldForList muda
  useEffect(() => {
    if (selectedMasterWorldForList) {
      const fetchChars = async () => {
        setIsLoading(true);
        setError(null);
        try {
          // Assumindo que getAllCharacterCards agora aceita masterWorldId
          const data = await getAllCharacterCards(selectedMasterWorldForList);
          setCharacters(data);
        } catch (err) {
          setError("Failed to load characters for the selected world.");
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchChars();
    } else {
      setCharacters([]); // Limpa characters se nenhum mundo estiver selecionado
      setIsLoading(false);
    }
  }, [selectedMasterWorldForList]);

  // Busca Lore Entries (para o dropdown no modal) quando selectedMasterWorldForForm (no modal) muda
  useEffect(() => {
    if (selectedMasterWorldForForm?.value) {
      const fetchLoreOpts = async () => {
        setIsLoadingLore(true);
        try {
          const loreData = await getAllLoreEntriesForMasterWorld(
            selectedMasterWorldForForm.value
          );
          setWorldLoreOptions(
            loreData.map((lore) => ({
              value: lore.id,
              label: `${lore.name} (${lore.entry_type.replace("_LORE", "")})`,
            }))
          );
        } catch (err) {
          console.error("Failed to load lore options for modal:", err);
          setWorldLoreOptions([]); // Limpa em caso de erro
        } finally {
          setIsLoadingLore(false);
        }
      };
      fetchLoreOpts();
    } else {
      setWorldLoreOptions([]); // Limpa opções se nenhum mundo selecionado no formulário
    }
  }, [selectedMasterWorldForForm]);

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

  const handleLoreLinkChange = (selectedOptions: MultiValue<SelectOption>) => {
    setSelectedLoreLinks(selectedOptions);
  };

  const handleMasterWorldChangeForForm = (
    selectedOption: SingleValue<SelectOption>
  ) => {
    setSelectedMasterWorldForForm(selectedOption);
    setSelectedLoreLinks([]); // Reseta lore links quando o mundo do formulário muda
  };

  const handleOpenModal = (character?: CharacterCardData) => {
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

      // Carrega lore links (o useEffect [selectedMasterWorldForForm] cuidará de buscar as opções)
      if (character.linked_lore_ids && character.master_world_id) {
        // A busca real de worldLoreOptions agora é feita pelo useEffect [selectedMasterWorldForForm]
        // Aqui, apenas tentamos pré-selecionar se as opções já estiverem carregadas para o mundo correto
        const preselected = worldLoreOptions.filter((opt) =>
          character.linked_lore_ids!.includes(opt.value)
        );
        setSelectedLoreLinks(preselected);
      } else {
        setSelectedLoreLinks([]);
      }
    } else {
      // Novo personagem
      setEditingCharacter(null);
      setFormFields(initialFormFields);
      setCurrentExampleDialogues([""]);
      setCurrentDialogueIndex(0);
      setCurrentBeginningMessages([""]);
      setCurrentBmgIndex(0);
      setSelectedLoreLinks([]);
      // Pré-seleciona o mundo do filtro da página, se houver
      const worldOption = masterWorlds.find(
        (w) => w.id === selectedMasterWorldForList
      );
      setSelectedMasterWorldForForm(
        worldOption ? { value: worldOption.id, label: worldOption.name } : null
      );
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCharacter(null);
    setFormFields(initialFormFields);
    setCurrentExampleDialogues([""]);
    setCurrentDialogueIndex(0);
    setCurrentBeginningMessages([""]);
    setCurrentBmgIndex(0);
    setSelectedLoreLinks([]);
    setSelectedMasterWorldForForm(null);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formFields.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!selectedMasterWorldForForm?.value) {
      setError("Master World is required for the character.");
      return;
    }

    const finalDialogues = currentExampleDialogues
      .map((d) => d.trim())
      .filter((d) => d);
    const finalBeginningMessages = currentBeginningMessages
      .map((m) => m.trim())
      .filter((m) => m);
    const finalLinkedLoreIds = selectedLoreLinks.map((option) => option.value);

    const payload: CharacterCardCreateData = {
      // CharacterCardUpdateData é similar
      ...formFields,
      master_world_id: selectedMasterWorldForForm.value, // ID do mundo selecionado no formulário
      example_dialogues: finalDialogues.length > 0 ? finalDialogues : null,
      beginning_messages:
        finalBeginningMessages.length > 0 ? finalBeginningMessages : null,
      linked_lore_ids:
        finalLinkedLoreIds.length > 0 ? finalLinkedLoreIds : null,
    };

    setIsSubmitting(true);
    setError(null);
    try {
      if (editingCharacter) {
        await updateCharacterCard(
          editingCharacter.id,
          payload as CharacterCardUpdateData
        );
      } else {
        await createCharacterCard(payload);
      }
      const data = await getAllCharacterCards();
      setCharacters(data);
      handleCloseModal();
      // Refresh the character list with current world filter
      const refreshedData = await getAllCharacterCards();
      setCharacters(
        refreshedData.filter(
          (char) => char.master_world_id === selectedMasterWorldForList
        )
      );
    } catch (err: any) {
      /* ... tratamento de erro ... */
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (characterId: string) => {
    try {
      await deleteCharacterCard(characterId);
      // Refresh the character list
      const data = await getAllCharacterCards();
      setCharacters(
        data.filter(
          (char) => char.master_world_id === selectedMasterWorldForList
        )
      );
    } catch (err) {
      console.error("Failed to delete character:", err);
      setError("Failed to delete character");
    }
  };
  const masterWorldOptionsForForm = masterWorlds.map((w) => ({
    value: w.id,
    label: w.name,
  }));

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-4xl font-bold text-white">AI Characters</h1>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label
            htmlFor="master-world-filter"
            className="text-sm text-gray-400 shrink-0"
          >
            World:
          </label>
          <Select<SelectOption>
            inputId="master-world-filter"
            options={masterWorldOptionsForForm}
            value={
              masterWorldOptionsForForm.find(
                (opt) => opt.value === selectedMasterWorldForList
              ) || null
            }
            onChange={(opt: SingleValue<SelectOption>) =>
              setSelectedMasterWorldForList(opt ? opt.value : null)
            }
            isLoading={isLoadingWorlds}
            isClearable
            placeholder="Filter by World..."
            className="text-black min-w-[200px] md:min-w-[250px] flex-grow"
            classNamePrefix="react-select"
            styles={
              {
                /* ... seus estilos para react-select ... */
              }
            }
          />
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md whitespace-nowrap"
            disabled={!selectedMasterWorldForList || isLoadingWorlds} // Desabilita se nenhum mundo selecionado para filtro
          >
            + Create Character
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
      {!isLoading &&
        !error &&
        characters.length === 0 &&
        selectedMasterWorldForList && (
          <p className="text-center text-gray-500 py-10">
            No AI characters found for world "
            {
              masterWorlds.find((w) => w.id === selectedMasterWorldForList)
                ?.name
            }
            ". Create one!
          </p>
        )}
      {!isLoading && !error && !selectedMasterWorldForList && (
        <p className="text-center text-gray-500 py-10">
          Please select a Master World to view or create characters.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {characters.map((char) => (
          <div
            key={char.id}
            className="bg-gray-800 rounded-lg shadow-lg p-6 hover:bg-gray-700 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-white">{char.name}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleOpenModal(char)}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                  title="Edit Character"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(char.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete Character"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
            {char.description && (
              <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                {char.description}
              </p>
            )}
            <div className="text-xs text-gray-400">
              {Array.isArray(char.linked_lore_ids) &&
                char.linked_lore_ids.length > 0 && (
                  <p>Linked Lore: {char.linked_lore_ids.length} entries</p>
                )}
              {Array.isArray(char.example_dialogues) &&
                char.example_dialogues.length > 0 && (
                  <p>Example Dialogues: {char.example_dialogues.length}</p>
                )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={
          editingCharacter ? "Edit AI Character" : "Create New AI Character"
        }
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-2"
        >
          {error && isModalOpen && (
            <p className="bg-red-700 text-white p-3 rounded-md text-sm text-center">
              {error}
            </p>
          )}

          {/* Select Master World NO FORMULÁRIO */}
          <div>
            <label
              htmlFor="char-master_world"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Master World <span className="text-red-500">*</span>
            </label>
            <Select<SelectOption>
              inputId="char-master_world"
              options={masterWorldOptionsForForm}
              value={selectedMasterWorldForForm}
              onChange={handleMasterWorldChangeForForm}
              isDisabled={isLoadingWorlds || !!editingCharacter} // Desabilita se estiver editando (não muda o mundo de um char existente)
              placeholder="Select Master World..."
              className="text-black"
              classNamePrefix="react-select"
              styles={
                {
                  /* ... estilos ... */
                }
              }
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
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
                  className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-2 rounded-md"
                  title="Add New Dialogue"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={removeCurrentDialogueField}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-2 rounded-md disabled:opacity-50"
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
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
                  className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-2 rounded-md"
                  title="Add New Beginning Message"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={removeCurrentBmgField}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-2 rounded-md disabled:opacity-50"
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
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

          {/* Linked World Lore (só mostra se um mundo estiver selecionado no formulário) */}
          {selectedMasterWorldForForm?.value && (
            <div className="mt-4">
              <label
                htmlFor="char-linked_lore"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Link to World Lore from "{selectedMasterWorldForForm.label}"{" "}
                {isLoadingLore && "(Loading...)"}
              </label>
              <Select<SelectOption, true>
                inputId="char-linked_lore"
                isMulti
                options={worldLoreOptions}
                value={selectedLoreLinks}
                onChange={handleLoreLinkChange}
                isLoading={isLoadingLore}
                placeholder="Search and select lore entries..."
                noOptionsMessage={() =>
                  isLoadingLore
                    ? "Loading lore..."
                    : "No lore found in this world"
                }
                className="text-black"
                classNamePrefix="react-select"
                styles={
                  {
                    /* ... estilos ... */
                  }
                }
                isDisabled={!selectedMasterWorldForForm?.value || isLoadingLore}
              />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !formFields.name.trim() ||
                !selectedMasterWorldForForm?.value
              }
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium disabled:bg-blue-800 disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : editingCharacter
                ? "Save Changes"
                : "Create Character"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CharactersPage;
