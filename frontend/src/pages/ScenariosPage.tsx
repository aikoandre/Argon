// frontend/src/pages/ScenariosPage.tsx
import React, { useState, useEffect, type FormEvent } from "react";
import Select, { type SingleValue } from "react-select";
import { useNavigate } from "react-router-dom";
import { 
  checkExistingChatSession,
  createChatSession 
} from "../services/api";
import {
  getAllScenarioCards,
  createScenarioCard,
  updateScenarioCard,
  deleteScenarioCard,
  getAllMasterWorlds,
  type ScenarioCardData,
  type ScenarioCardCreateData,
  type ScenarioCardUpdateData,
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

interface ScenarioFormData {
  name: string;
  description: string;
}

const initialFormFields: ScenarioFormData = {
  name: "",
  description: "",
};

const initialBeginningMessages = [""];

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

  useEffect(() => {
    const fetchScens = async () => {
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
    fetchScens();
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
    console.log("handleOpenModal called with scenario:", scenario);
    setError(null);

    // Reset form state for creation or populate for editing
    setEditingScenario(scenario || null);
    setFormFields(
      scenario
        ? {
            name: scenario.name,
            description: scenario.description || "",
          }
        : initialFormFields
    );

    // Initialize example dialogues
    const dialogues = scenario?.example_dialogues 
      ? [...scenario.example_dialogues]
      : [""];
    setCurrentExampleDialogues(dialogues);
    setCurrentDialogueIndex(0);

    // Initialize beginning messages
    const bmg = scenario?.beginning_message ? [...scenario.beginning_message] : [""];
    setCurrentBeginningMessages(bmg);
    setCurrentBmgIndex(0);

    // Set MasterWorld selection based on scenario or null for new scenario
    const worldOption = scenario
      ? masterWorlds.find((w) => w.id === scenario.master_world_id)
      : null;
    setSelectedMasterWorldForForm(
      worldOption ? { value: worldOption.id, label: worldOption.name } : null
    );

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingScenario(null);
    setFormFields(initialFormFields);
    setSelectedMasterWorldForForm(null);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    console.log("handleSubmit called."); // Debug log
    e.preventDefault();
    if (!formFields.name.trim()) {
      console.log("Name is empty"); // Debug log
      setError("Name is required.");
      return;
    }
    console.log("Name trimmed:", formFields.name.trim()); // Debug log

    const finalDialogues = currentExampleDialogues
      .map(d => d.trim())
      .filter(d => d);

    const finalBeginningMessages = currentBeginningMessages
      .map(m => m.trim())
      .filter(m => m);

    // Cria um payload limpo, sem user_persona_id e world_card_references
    const { user_persona_id, world_card_references, ...safeFields } = formFields as any;
    let payload: ScenarioCardCreateData = {
      ...safeFields,
      master_world_id: selectedMasterWorldForForm?.value || null,
      example_dialogues: finalDialogues.length > 0 ? finalDialogues : null,
      beginning_message: finalBeginningMessages.length > 0 ? finalBeginningMessages : null,
    };

    // Garantia extra: remove se vier de outro lugar
    delete (payload as any).user_persona_id;
    delete (payload as any).world_card_references;

    console.log("Submitting scenario with payload:", payload); // Debug log

    setIsSubmitting(true);
    setError(null);

    try {
      let response;
      if (editingScenario) {
        console.log("Updating existing scenario:", editingScenario.id); // Debug log
        response = await updateScenarioCard(
          editingScenario.id,
          payload as ScenarioCardUpdateData
        );
      } else {
        console.log("Creating new scenario"); // Debug log
        response = await createScenarioCard(payload);
      }
      console.log("API response:", response); // Debug log
      
      // Refresh scenarios list
      const data = await getAllScenarioCards();
      console.log("Refreshed scenarios list:", data); // Debug log
      setScenarios(data);
      handleCloseModal();
    } catch (err: any) {
      console.error("Failed to save scenario:", err);
      if (err.response) {
        console.error("Response data:", err.response.data); // Debug log
        console.error("Response status:", err.response.status); // Debug log
      }
      setError(err.message || "Failed to save scenario");
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
      const existingSession = await checkExistingChatSession({
        scenario_id: scenarioId,
        user_persona_id: null,
      });

      if (existingSession) {
        navigate(`/chat/${existingSession.id}`);
      } else {
        const newSession = await createChatSession({
          scenario_id: scenarioId,
          user_persona_id: null,
          title: `Scenario: ${scenarios.find(s => s.id === scenarioId)?.name}`
        });
        navigate(`/chat/${newSession.id}`);
      }
    } catch (error) {
      console.error('Error handling scenario session:', error);
      setError('Could not start scenario session');
    }
  };

  const masterWorldOptions = masterWorlds.map((w) => ({
    value: w.id,
    label: w.name,
  }));

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-4xl font-bold text-white">Scenarios</h1>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md whitespace-nowrap"
          >
            + Create Scenario
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
        <p className="text-center text-gray-500 py-10">
          No scenarios found. Create one!
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scen) => (
          <div
            key={scen.id}
            className="bg-gray-800 rounded-lg shadow-lg p-6 hover:bg-gray-700 transition-colors cursor-pointer"
            onClick={() => handleScenarioClick(scen.id)}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-white">{scen.name}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={(e) => { 
                    e.stopPropagation();
                    handleOpenModal(scen);
                  }}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                  title="Edit Scenario"
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
                  onClick={(e) => { e.stopPropagation(); handleDelete(scen.id); }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete Scenario"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 10-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
            {scen.description && (
              <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                {scen.description}
              </p>
            )}
            {scen.beginning_message && (
              <p className="text-gray-400 text-xs">Has Beginning Message</p>
            )}
            {Array.isArray(scen.example_dialogues) && scen.example_dialogues.length > 0 && (
              <p className="text-gray-400 text-xs">Example Dialogues: {scen.example_dialogues.length}</p>
            )}
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingScenario ? "Edit Scenario" : "Create New Scenario"}
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-2 hide-scrollbar"
        >
          {error && isModalOpen && (
            <p className="bg-red-700 text-white p-3 rounded-md text-sm text-center">
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="scen-master_world"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Master World
            </label>
            <Select<SelectOption>
              inputId="scen-master_world"
              options={masterWorldOptions}
              value={selectedMasterWorldForForm}
              onChange={handleMasterWorldChangeForForm}
              isDisabled={isLoadingWorlds || !!editingScenario}
              placeholder="Select Master World..."
              className="text-black"
              classNamePrefix="react-select"
              styles={
                {
                 // Estilos para tema escuro
                control: (base, state) => ({
                  ...base,
                  backgroundColor: "#1F2937", // bg-gray-800
                  borderColor: state.isFocused ? "#3B82F6" : "#4B5563", // border-blue-500 (focus), border-gray-600
                  boxShadow: state.isFocused ? "0 0 0 1px #3B82F6" : "none",
                  "&:hover": { borderColor: "#6B7280" }, // border-gray-500 (hover)
                  minHeight: "42px", // Para alinhar com inputs padrão
                }),
                singleValue: (base) => ({ ...base, color: "white" }),
                menu: (base) => ({
                  ...base,
                  backgroundColor: "#1F2937",
                  zIndex: 10,
                }),
                option: (base, { isFocused, isSelected }) => ({
                  ...base,
                  backgroundColor: isSelected
                  ? "#3B82F6"
                  : isFocused
                  ? "#374151"
                  : "#1F2937", // bg-blue-600 (selected), bg-gray-700 (focus)
                  color: "white",
                  ":active": { backgroundColor: "#2563EB" }, // bg-blue-700 (active)
                }),
    placeholder: (base) => ({ ...base, color: "#9CA3AF" }), // text-gray-400
    input: (base) => ({ ...base, color: "white" }),
    dropdownIndicator: (base) => ({ ...base, color: "#9CA3AF" }),
    clearIndicator: (base) => ({
      ...base,
      color: "#9CA3AF",
      ":hover": { color: "white" },
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: "#4B5563",
    }),
                }
              }
            />
          </div>

          <div>
            <label
              htmlFor="scen-name"
              className="block text-sm font-medium text-gray-300 mb-1"
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="scen-description"
              className="block text-sm font-medium text-gray-300 mb-1"
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-300">
                Beginning Message ({currentBmgIndex + 1}/{currentBeginningMessages.length})
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex justify-start space-x-2 mt-1">
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

          {/* Example Dialogues Section */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-300">
                Example Dialogue ({currentDialogueIndex + 1}/{currentExampleDialogues.length})
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={addDialogueField}
                  className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-2 rounded-md"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={removeCurrentDialogueField}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-2 rounded-md disabled:opacity-50"
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex justify-start space-x-2 mt-1">
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
                !formFields.name.trim()
              }
              onClick={() => console.log("Submit button clicked, disabled state:", 
                isSubmitting || !formFields.name.trim())} // Debug log
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium disabled:bg-blue-800 disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : editingScenario
                ? "Save Changes"
                : "Create Scenario"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ScenariosPage;
