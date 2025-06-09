// filepath: /home/aikoandre/Archives/VSCode/Argon/frontend/src/pages/CharactersPage.tsx
import React, { useState, useRef, useEffect } from "react";
import { deleteCharacterCard, updateCharacterCard, createCharacterCard, getAllCharacterCards, type CharacterCardData } from "../services/api";
import { useLayout } from '../contexts/LayoutContext';
import CharacterEditPanel from '../components/Editing/CharacterEditPanel';
import { useInstantAutoSave } from '../hooks/useInstantAutoSave';
import { characterToFormData } from '../utils/formDataHelpers';
import { CardImage } from '../components/CardImage';

const CharactersPage: React.FC = () => {
  const [editingCharacter, setEditingCharacter] = useState<CharacterCardData | null>(null);
  const [characters, setCharacters] = useState<CharacterCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const { setLeftPanelContent, setRightPanelContent } = useLayout();

  // Load characters on component mount
  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const charactersData = await getAllCharacterCards();
        setCharacters(charactersData);
      } catch (error) {
        console.error('Failed to load characters:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCharacters();
  }, []);

  // Auto-save functionality - only for existing characters
  const { saveStatus, error, retry } = useInstantAutoSave(
    editingCharacter || {} as CharacterCardData,
    async (data: CharacterCardData) => {
      if (data && data.id) {
        const formData = characterToFormData(data);
        await updateCharacterCard(data.id, formData);
      }
    },
    { debounceMs: 300 }
  );

  const handleFieldChange = (field: string, value: any) => {
    setEditingCharacter((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      updateLayoutContent(updated);
      return updated;
    });
  };

  const updateLayoutContent = (character: CharacterCardData | null) => {
    if (character) {
      // Left panel: show image if available
      if (character.image_url) {
        const cacheBuster = character.updated_at 
          ? `?cb=${encodeURIComponent(character.updated_at)}`
          : `?cb=${character.id}`;
        setLeftPanelContent(
          <img
            src={`${character.image_url}${cacheBuster}`}
            alt={character.name}
            className="w-full h-full object-cover rounded-lg"
            style={{ aspectRatio: '3/4.5' }}
          />
        );
      } else {
        setLeftPanelContent(null);
      }
    } else {
      setLeftPanelContent(null);
    }
  };

  const handleDelete = (characterId: string) => {
    if (window.confirm("Are you sure you want to delete this character? This action cannot be undone.")) {
      try {
        deleteCharacterCard(characterId);
        // Remove from local state
        setCharacters(prev => prev.filter(char => char.id !== characterId));
        // Reset editing state if deleting currently edited character
        if (editingCharacter?.id === characterId) {
          setEditingCharacter(null);
          updateLayoutContent(null);
        }
      } catch (err) {
        console.error("Failed to delete character:", err);
      }
    }
  };

  const handleImport = () => {
    if (importFileInputRef.current) {
      importFileInputRef.current.click();
    }
  };

  const handleExport = () => {
    // Export functionality would go here
    console.log("Export character:", editingCharacter?.id);
  };

  const handleExpressions = () => {
    // Handle expressions view
    console.log("View expressions for:", editingCharacter?.id);
  };

  const handleImageChange = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Right panel content - Character editor
  useEffect(() => {
    if (editingCharacter) {
      setRightPanelContent(
        <CharacterEditPanel 
          character={editingCharacter}
          onChange={handleFieldChange}
          onDelete={() => handleDelete(editingCharacter.id)}
          onImport={handleImport}
          onExport={handleExport}
          onExpressions={handleExpressions}
          onImageChange={handleImageChange}
          autoSaveStatus={saveStatus}
          error={error}
          onRetryAutoSave={retry}
        />
      );
    }
  }, [editingCharacter, saveStatus, error]);

  return (
    <div className="container p-4 md:p-8 h-full">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Characters</h1>
        <div>
          <button
            onClick={handleImport}
            className="bg-app-text-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md mr-2"
          >
            Import
          </button>
          <button
            onClick={async () => {
              try {
                // Create a new character with minimal data
                const formData = new FormData();
                formData.append('name', 'New Character');
                formData.append('description', '');
                formData.append('instructions', '');
                
                const newCharacter = await createCharacterCard(formData);
                setCharacters(prev => [...prev, newCharacter]);
                setEditingCharacter(newCharacter);
                updateLayoutContent(newCharacter);
              } catch (error) {
                console.error('Failed to create new character:', error);
              }
            }}
            className="bg-app-text-2 text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            New +
          </button>
        </div>
      </div>
      
      {/* Hidden inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={importFileInputRef}
        accept=".json,.png"
        className="hidden"
      />

      {loading ? (
        <p className="text-center text-gray-400 p-10">Loading characters...</p>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 justify-items-start">
          {characters.map((character) => {
            const cacheBuster = character.updated_at 
              ? `?cb=${encodeURIComponent(character.updated_at)}`
              : `?cb=${character.id}`;
            const imageUrl = character.image_url ? `${character.image_url}${cacheBuster}` : null;
            
            return (
              <div
                key={character.id}
                className="bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer group"
                onClick={() => {
                  setEditingCharacter(character);
                  updateLayoutContent(character);
                }}
              >
                <CardImage
                  imageUrl={imageUrl}
                  className="absolute inset-0"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(character.id);
                  }}
                  className="absolute top-2 right-2 z-20 text-app-text hover:text-red-500 p-1.5 rounded-full transition-colors"
                  title="Delete Character"
                >
                  <span className="material-icons-outlined text-2xl">delete</span>
                </button>
                
                <div className="absolute bottom-0 left-0 w-full">
                  <div className="w-full bg-black/30 backdrop-blur-sm p-3 flex flex-row items-center justify-between rounded-b-lg">
                    <div className="font-semibold text-lg text-white drop-shadow-md break-words flex-1" title={character.name}>
                      {character.name}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CharactersPage;