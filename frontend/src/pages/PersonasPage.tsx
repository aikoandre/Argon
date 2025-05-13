// frontend/src/pages/PersonasPage.tsx
import React, { useState, useEffect, type FormEvent } from "react";
import {
  getAllUserPersonas,
  createUserPersona,
  updateUserPersona,
  deleteUserPersona,
  type UserPersonaData,
  type UserPersonaCreateData,
  type UserPersonaUpdateData,
} from "../services/api";
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

  if (isLoading && personas.length === 0) {
    // Mostra loading só na primeira carga
    return (
      <p className="text-center text-gray-400 p-10">Loading personas...</p>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 bg-gray-900 min-h-screen text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">My Personas</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
        >
          + Create Persona
        </button>
      </div>

      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}

      {personas.length === 0 && !isLoading && (
        <p className="text-center text-gray-500">
          No personas created yet. Click "Create Persona" to get started!
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.map((persona) => (
          // <motion.div key={persona.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
          <div
            key={persona.id}
            className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-2xl transition-shadow duration-300"
          >
            <h2 className="text-2xl font-semibold mb-2">{persona.name}</h2>
            <p className="text-gray-400 mb-4 break-words whitespace-pre-wrap">
              {persona.description || (
                <span className="italic">No description.</span>
              )}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => handleOpenModal(persona)}
                className="text-sm bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-md transition duration-150"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(persona.id)}
                className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md transition duration-150"
              >
                Delete
              </button>
            </div>
          </div>
          // </motion.div>
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
              type="button"
              onClick={handleCloseModal}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md"
            >
              Cancel
            </button>
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
