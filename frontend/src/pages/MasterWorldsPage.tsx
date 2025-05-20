import React, { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllMasterWorlds,
  createMasterWorld,
  updateMasterWorld,
  deleteMasterWorld,
  type MasterWorldData,
} from "../services/api";
import ReactTagInput from "@pathofdev/react-tag-input";
import "@pathofdev/react-tag-input/build/index.css";
import { PencilSquare, TrashFill } from 'react-bootstrap-icons';
import { CardImage } from "../components/CardImage";

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

// Tipo para o formulário, com tags como string
interface MasterWorldFormData {
  name: string;
  description: string;
  tags: string[];
}

const initialFormData: MasterWorldFormData = {
  name: "",
  description: "",
  tags: [],
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null); // Track current image
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSelectImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

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
        tags: world.tags ? [...world.tags] : [],
      });
      setCurrentImageUrl(world.image_url || null); // Set current image url
      setImageFile(null); // Reset file input
    } else {
      setEditingWorld(null);
      setFormData(initialFormData);
      setCurrentImageUrl(null);
      setImageFile(null);
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

    setIsSubmitting(true);
    setError(null);
    try {
      if (editingWorld) {
        // Always use FormData for update if image might be sent
        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name);
        formDataToSend.append('description', formData.description || '');
        if (formData.tags && formData.tags.length > 0) {
          formDataToSend.append('tags', JSON.stringify(formData.tags));
        }
        if (imageFile) {
          formDataToSend.append('image', imageFile);
        }
        await updateMasterWorld(editingWorld.id, formDataToSend);
      } else {
        // Always use FormData for createMasterWorld
        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name);
        formDataToSend.append('description', formData.description || '');
        if (formData.tags && formData.tags.length > 0) {
          formDataToSend.append('tags', JSON.stringify(formData.tags));
        }
        if (imageFile) {
          formDataToSend.append('image', imageFile);
        }
        await createMasterWorld(formDataToSend);
      }
      setImageFile(null);
      setCurrentImageUrl(null);
      handleCloseModal();
      fetchMasterWorlds();
    } catch (err: any) {
      // Robust error handling for FastAPI validation errors
      let apiError = editingWorld ? "Failed to update world." : "Failed to create world.";
      if (err.response && err.response.data && err.response.data.detail) {
        if (Array.isArray(err.response.data.detail)) {
          apiError = err.response.data.detail.map((e: any) => e.msg || e.detail || JSON.stringify(e)).join(', ');
        } else {
          apiError = err.response.data.detail;
        }
      }
      setError(apiError);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (worldId: string) => {{
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

  // Helper function for truncating filenames
  const truncateFilename = (filename: string | null | undefined, maxLength = 35): string => {
    if (!filename) return "Select Image";
    if (filename.length <= maxLength) return filename;
    return filename.substring(0, maxLength - 3) + '...';
  };

  if (isLoading && masterWorlds.length === 0) {
    return (
      <p className="text-center text-gray-400 p-10">Loading Your Worlds...</p>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Worlds</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-app-accent-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
        >
          New +
        </button>
      </div>

      {error && !isModalOpen && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}

      {masterWorlds.length === 0 && !isLoading && (
        <div className="text-center py-10">
          <p className="text-xl text-gray-500 mb-4">No worlds created yet. Click in + to create one</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 justify-items-start w-full">
        {masterWorlds.map((world) => {
          return (
            <div
              key={world.id}
              className="bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer transform transition-transform duration-200 hover:scale-105"
              onClick={() => navigate(`/world-lore/${world.id}/entries`)}
            >
              <CardImage
                imageUrl={world.image_url ? `/api/images/${world.image_url.replace(/^\/?static\//, '')}` : null}
                className="absolute inset-0"
              />
              {/* Top right icons */}
              <div className="absolute top-2 right-2 flex space-x-2 z-10">
                <button
                  onClick={e => { e.stopPropagation(); handleOpenModal(world); }}
                  className="text-gray-400 hover:text-app-accent transition-colors"
                  title="Edit World"
                >
                  <PencilSquare className="h-5 w-5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(world.id); }}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full"
                  title="Delete World"
                >
                  <TrashFill className="h-5 w-5" />
                </button>
              </div>
              {/* Bottom info (footer) */}
              <div className="absolute bottom-0 left-0 w-full bg-black/30 backdrop-blur-sm p-3 flex flex-col items-start rounded-b-lg">
                <div className="flex w-full items-center justify-between">
                  <h2 className="text-lg font-semibold text-white break-words whitespace-normal mr-2 flex-1 leading-snug" title={world.name}>{world.name}</h2>
                </div>
                {world.tags && world.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 mb-1">
                    {world.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                    {world.tags.length > 4 && (
                      <span className="text-xs text-gray-400">...</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
          {/* Campo de imagem opcional - antes do campo Name, label em cima */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Image</label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleSelectImageClick}
                className="flex-1 bg-app-surface text-white font-semibold py-2 rounded-l-md flex items-center justify-center focus:outline-none h-11 overflow-hidden whitespace-nowrap"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
                </svg>
                <span>{imageFile ? truncateFilename(imageFile.name) : currentImageUrl ? `Current: ${truncateFilename(currentImageUrl.split('/').pop())}` : "Select Image"}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <span className="h-11 w-px bg-app-surface" />
              <button
                type="button"
                className="bg-app-surface hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-r-md flex items-center justify-center focus:outline-none h-11"
                onClick={() => { setImageFile(null); setCurrentImageUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                disabled={!imageFile && !currentImageUrl}
                title="Remove image"
              >
                <TrashFill className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div>
            <label
              htmlFor="mw-name"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              World Name <span className="text-app-accent">*</span>
            </label>
            <input
              type="text"
              name="name"
              id="mw-name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full p-2 bg-app-surface rounded-md text-white focus:ring-app-accent"
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
              className="w-full p-2 bg-app-surface rounded-md text-white focus:ring-app-accent"
              autoComplete="off"
            />
          </div>
          <div>
            <label
              htmlFor="mw-tags"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Tags
            </label>
            <div className="bg-app-surface rounded-md">
              <ReactTagInput
                tags={formData.tags}
                onChange={(newTags) => setFormData(prev => ({ ...prev, tags: newTags }))}
                placeholder="Add tags (press enter, comma, or space)"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-app-accent-2 text-app-bg font-semibold py-2 px-4 rounded-md disabled:opacity-50"
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
