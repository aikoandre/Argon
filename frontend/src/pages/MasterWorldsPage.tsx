import React, { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllMasterWorlds,
  createMasterWorld,
  updateMasterWorld,
  deleteMasterWorld,
  type MasterWorldData,
} from "../services/api";

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
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg text-white">
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

// Tipo para o formulário, com tags como string
interface MasterWorldFormData {
  name: string;
  description: string;
  tags_string: string; // Tags como string separada por vírgula
}

const initialFormData: MasterWorldFormData = {
  name: "",
  description: "",
  tags_string: "",
};

const MasterWorldsPage: React.FC = () => {
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingWorld, setEditingWorld] = useState<MasterWorldData | null>(
    null
  );
  const [formData, setFormData] =
    useState<MasterWorldFormData>(initialFormData);
  const navigate = useNavigate();

  const fetchMasterWorlds = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllMasterWorlds();
      setMasterWorlds(data);
    } catch (err) {
      setError("Failed to load master worlds.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterWorlds();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenModal = (world?: MasterWorldData) => {
    if (world) {
      setEditingWorld(world);
      setFormData({
        name: world.name,
        description: world.description || "",
        tags_string: world.tags ? world.tags.join(", ") : "",
      });
    } else {
      setEditingWorld(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
    setError(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingWorld(null);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Name is required.");
      return;
    }

    const tagsForApi = formData.tags_string
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const payload = {
      name: formData.name,
      description: formData.description,
      tags: tagsForApi.length > 0 ? tagsForApi : null,
    };

    setIsSubmitting(true);
    setError(null);
    try {
      if (editingWorld) {
        await updateMasterWorld(editingWorld.id, payload);
      } else {
        await createMasterWorld(payload);
      }
      handleCloseModal();
      fetchMasterWorlds();
    } catch (err: any) {
      const apiError =
        err.response?.data?.detail ||
        (editingWorld ? "Failed to update world." : "Failed to create world.");
      setError(apiError);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (worldId: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this world and ALL its lore entries? This action is irreversible."
      )
    ) {
      setIsLoading(true);
      try {
        await deleteMasterWorld(worldId);
        fetchMasterWorlds();
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to delete world.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isLoading && masterWorlds.length === 0) {
    return (
      <p className="text-center text-gray-400 p-10">Loading Your Worlds...</p>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-white">Worlds</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md"
        >
          + Create New World
        </button>
      </div>

      {error && !isModalOpen && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}

      {masterWorlds.length === 0 && !isLoading && (
        <p className="text-center text-gray-500 py-10">
          No worlds created yet. Start by creating your first universe!
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {masterWorlds.map((world) => (
          <div
            key={world.id}
            className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            onClick={() => navigate(`/world-lore/${world.id}/entries`)}
          >
            <div>
              <h2
                className="text-2xl font-semibold text-blue-400 mb-2 truncate"
                title={world.name}
              >
                {world.name}
              </h2>
              <p
                className="text-gray-400 mb-3 text-sm line-clamp-3"
                title={world.description || undefined}
              >
                {world.description || (
                  <span className="italic">No description provided.</span>
                )}
              </p>
              {world.tags && world.tags.length > 0 && (
                <div className="mb-3">
                  {world.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full mr-1 mb-1 inline-block"
                    >
                      {tag}
                    </span>
                  ))}
                  {world.tags.length > 4 && (
                    <span className="text-xs text-gray-400">...</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2 mt-2 pt-2 border-t border-gray-700">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenModal(world);
                }}
                className="text-sm bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-md"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(world.id);
                }}
                className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingWorld ? "Edit World" : "Create New World"}
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[80vh] overflow-y-auto p-1 pr-2"
        >
          {error && isModalOpen && (
            <p className="bg-red-700 text-white p-3 rounded-md text-sm text-center mb-3">
              {error}
            </p>
          )}
          <div>
            <label
              htmlFor="mw-name"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              World Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              id="mw-name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
            />
          </div>
          <div>
            <label
              htmlFor="mw-description"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Overall Description
            </label>
            <textarea
              name="description"
              id="mw-description"
              rows={5}
              value={formData.description}
              onChange={handleInputChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
            />
          </div>
          <div>
            <label
              htmlFor="mw-tags"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Tags (comma-separated)
            </label>
            <input
              type="text"
              name="tags_string"
              id="mw-tags"
              value={formData.tags_string}
              onChange={handleInputChange}
              placeholder="e.g., high fantasy, sci-fi, post-apocalyptic"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
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
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50"
            >
              {isSubmitting
                ? editingWorld
                  ? "Saving..."
                  : "Creating..."
                : editingWorld
                ? "Save Changes"
                : "Create World"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MasterWorldsPage;
