// frontend/src/pages/PersonasPage.tsx
import React, { useState, useEffect, type FormEvent } from "react";
import {
  getAllUserPersonas,
  createUserPersona,
  updateUserPersona,
  deleteUserPersona,
  getUserSettings,
  updateUserSettings,
  type UserPersonaData,
  type UserPersonaCreateData,
  type UserPersonaUpdateData,
} from "../services/api";
import { PencilSquare, TrashFill } from 'react-bootstrap-icons';
// Importe Framer Motion (se já quiser adicionar animações simples)
// import { motion, AnimatePresence } from 'framer-motion';

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
    // Use AnimatePresence e motion se for animar
    // <AnimatePresence>
    //   {isOpen && (
    //     <motion.div
    //       initial={{ opacity: 0 }}
    //       animate={{ opacity: 1 }}
    //       exit={{ opacity: 0 }}
    //       className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    //       onClick={onClose} // Fecha ao clicar fora
    //     >
    //       <motion.div
    //         initial={{ scale: 0.7, opacity: 0 }}
    //         animate={{ scale: 1, opacity: 1 }}
    //         exit={{ scale: 0.7, opacity: 0 }}
    //         className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md text-white"
    //         onClick={(e) => e.stopPropagation()} // Impede de fechar ao clicar dentro
    //       >
    //         <h2 className="text-2xl font-semibold mb-4">{title}</h2>
    //         {children}
    //       </motion.div>
    //     </motion.div>
    //   )}
    // </AnimatePresence>
    // Sem Framer Motion por enquanto:
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md text-white">
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
  const [formData, setFormData] = useState<
    UserPersonaCreateData | UserPersonaUpdateData
  >({ name: "", description: "" });

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

  const handleOpenModal = (persona?: UserPersonaData) => {
    if (persona) {
      setEditingPersona(persona);
      setFormData({
        name: persona.name,
        description: persona.description || "",
      });
    } else {
      setEditingPersona(null);
      setFormData({ name: "", description: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPersona(null);
    setFormData({ name: "", description: "" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) {
      alert("Name is required."); // Validação simples
      return;
    }
    setIsLoading(true); // Usar um isLoading específico para o form seria melhor
    try {
      if (editingPersona) {
        await updateUserPersona(
          editingPersona.id,
          formData as UserPersonaUpdateData
        );
      } else {
        await createUserPersona(formData as UserPersonaCreateData);
      }
      handleCloseModal();
      fetchPersonas(); // Recarrega a lista
    } catch (err) {
      setError(
        editingPersona
          ? "Failed to update persona."
          : "Failed to create persona."
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

  if (isLoading && personas.length === 0) {
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

      {personas.length === 0 && !isLoading && (
        <div className="text-center py-10">
          <p className="text-xl text-gray-500 mb-4">No persona created yet. Click in + to create one</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className={`bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer transform transition-transform duration-200 hover:scale-105 ${activePersonaId === persona.id ? 'ring-2 ring-app-accent' : ''}`}
            onClick={() => handleActivatePersona(persona.id)}
            title={activePersonaId === persona.id ? 'Active' : 'Click to activate'}

          >
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md"
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
