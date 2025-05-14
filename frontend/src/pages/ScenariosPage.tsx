// frontend/src/pages/ScenariosPage.tsx
import React, { useState, useEffect, type FormEvent } from "react";
import Select, { type SingleValue } from "react-select";
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
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

interface ScenarioFormData {
  // Campos diretos do formulário
  name: string;
  description: string;
  beginning_message: string;
}

const initialFormFields: ScenarioFormData = {
  name: "",
  description: "",
  beginning_message: "",
};

const ScenariosPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<ScenarioCardData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioCardData | null>(null);
  const [formFields, setFormFields] = useState<ScenarioFormData>(initialFormFields);

  // Master World states
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [selectedMasterWorldForList, setSelectedMasterWorldForList] = useState<string | null>(null);
  const [selectedMasterWorldForForm, setSelectedMasterWorldForForm] = useState<SingleValue<SelectOption>>(null);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState<boolean>(false);

  useEffect(() => {
    const fetchWorlds = async () => {
      setIsLoadingWorlds(true);
      try {
        const worldsData = await getAllMasterWorlds();
        setMasterWorlds(worldsData);
        if (worldsData.length > 0 && !selectedMasterWorldForList) {
          setSelectedMasterWorldForList(worldsData[0].id);
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
    if (selectedMasterWorldForList) {
      const fetchScens = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await getAllScenarioCards();
          setScenarios(data.filter(scen => scen.master_world_id === selectedMasterWorldForList));
        } catch (err) {
          setError("Failed to load scenarios.");
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchScens();
    } else {
      setScenarios([]);
      setIsLoading(false);
    }
  }, [selectedMasterWorldForList]);

  const handleStaticInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormFields(prev => ({ ...prev, [name]: value }));
  };

  const handleMasterWorldChangeForForm = (selectedOption: SingleValue<SelectOption>) => {
    setSelectedMasterWorldForForm(selectedOption);
  };

  const handleOpenModal = (scenario?: ScenarioCardData) => {
    setError(null);
    if (scenario) {
      setEditingScenario(scenario);
      setFormFields({
        name: scenario.name,
        description: scenario.description || "",
        beginning_message: scenario.beginning_message || "",
      });
      const worldOption = masterWorlds.find(w => w.id === scenario.master_world_id);
      setSelectedMasterWorldForForm(
        worldOption ? { value: worldOption.id, label: worldOption.name } : null
      );
    } else {
      setEditingScenario(null);
      setFormFields(initialFormFields);
      const worldOption = masterWorlds.find(w => w.id === selectedMasterWorldForList);
      setSelectedMasterWorldForForm(
        worldOption ? { value: worldOption.id, label: worldOption.name } : null
      );
    }
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
    e.preventDefault();
    if (!formFields.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!selectedMasterWorldForForm?.value) {
      setError("Master World is required.");
      return;
    }

    const payload: ScenarioCardCreateData = {
      ...formFields,
      master_world_id: selectedMasterWorldForForm.value
    };
    
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingScenario) {
        await updateScenarioCard(editingScenario.id, payload as ScenarioCardUpdateData);
      } else {
        await createScenarioCard(payload);
      }
      // Refresh scenarios list
      if (selectedMasterWorldForList) {
        const data = await getAllScenarioCards();
        setScenarios(data.filter(scen => scen.master_world_id === selectedMasterWorldForList));
      }
      handleCloseModal();
    } catch (err: any) {
      console.error('Failed to save scenario:', err);
      setError(err.message || 'Failed to save scenario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (scenarioId: string) => {
    try {
      await deleteScenarioCard(scenarioId);
      // Refresh the scenarios list
      if (selectedMasterWorldForList) {
        const data = await getAllScenarioCards();
        setScenarios(data.filter(scen => scen.master_world_id === selectedMasterWorldForList));
      }
    } catch (err) {
      console.error('Failed to delete scenario:', err);
      setError('Failed to delete scenario');
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
          <label htmlFor="master-world-filter-scen" className="text-sm text-gray-400 shrink-0">
            World:
          </label>
          <Select<SelectOption>
            inputId="master-world-filter-scen"
            options={masterWorldOptions}
            value={masterWorldOptions.find(opt => opt.value === selectedMasterWorldForList) || null}
            onChange={(opt) => setSelectedMasterWorldForList(opt ? opt.value : null)}
            isLoading={isLoadingWorlds}
            isClearable
            placeholder="Filter by World..."
            className="text-black min-w-[200px] md:min-w-[250px] flex-grow"
            classNamePrefix="react-select"
          />
          <button
            onClick={() => handleOpenModal()}
            disabled={!selectedMasterWorldForList || isLoadingWorlds}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Create Scenario
          </button>
        </div>
      </div>

      {isLoading && <p className="text-center text-gray-400 p-10">Loading scenarios...</p>}
      {!isLoading && error && <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">{error}</p>}
      {!isLoading && !error && scenarios.length === 0 && selectedMasterWorldForList && (
        <p className="text-center text-gray-500 py-10">
          No scenarios found for world "{masterWorlds.find(w=>w.id === selectedMasterWorldForList)?.name}". Create one!
        </p>
      )}
      {!isLoading && !error && !selectedMasterWorldForList && (
        <p className="text-center text-gray-500 py-10">Please select a Master World to view or create scenarios.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scen) => (
          <div key={scen.id} className="bg-gray-800 rounded-lg shadow-lg p-6 hover:bg-gray-700 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-white">{scen.name}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleOpenModal(scen)}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                  title="Edit Scenario"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(scen.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete Scenario"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            {scen.description && (
              <p className="text-gray-300 text-sm mb-4 line-clamp-3">{scen.description}</p>
            )}
            {scen.beginning_message && (
              <p className="text-gray-400 text-xs">Has Beginning Message</p>
            )}
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingScenario ? "Edit Scenario" : "Create New Scenario"}>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-2">
          {error && isModalOpen && <p className="bg-red-700 text-white p-3 rounded-md text-sm text-center">{error}</p>}
          
          <div>
            <label htmlFor="scen-master_world" className="block text-sm font-medium text-gray-300 mb-1">
              Master World <span className="text-red-500">*</span>
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
            />
          </div>

          <div>
            <label htmlFor="scen-name" className="block text-sm font-medium text-gray-300 mb-1">
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
            <label htmlFor="scen-description" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
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

          <div>
            <label htmlFor="scen-beginning_message" className="block text-sm font-medium text-gray-300 mb-1">Beginning Message</label>
            <textarea
              name="beginning_message"
              id="scen-beginning_message"
              autoComplete="off"
              rows={4}
              value={formFields.beginning_message}
              onChange={handleStaticInputChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
            />
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
              disabled={isSubmitting || !formFields.name.trim() || !selectedMasterWorldForForm?.value}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium disabled:bg-blue-800 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : editingScenario ? "Save Changes" : "Create Scenario"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ScenariosPage;
