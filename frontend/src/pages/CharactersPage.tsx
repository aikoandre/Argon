// filepath: /home/aikoandre/Archives/VSCode/Argon/frontend/src/pages/CharactersPage.tsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { deleteCharacterCard, updateCharacterCard, createCharacterCard, getAllCharacterCards, createOrGetCardChat, type CharacterCardData } from "../services/api";
import { useLayout } from '../contexts/LayoutContext';
import CharacterEditPanel from '../components/Editing/CharacterEditPanel';
import { LeftPanelImage } from '../components/Layout';
import { useInstantAutoSave } from '../hooks/useInstantAutoSave';
import { characterToFormData } from '../utils/formDataHelpers';
import { CardImage } from '../components/CardImage';

const CharactersPage: React.FC = () => {
  const navigate = useNavigate();
  const [editingCharacter, setEditingCharacter] = useState<CharacterCardData | null>(null);
  const [characters, setCharacters] = useState<CharacterCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const { setLeftPanelContent, setRightPanelContent, setLeftPanelVisible, setRightPanelVisible } = useLayout();

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

  // Set panels visible when CharactersPage loads
  useEffect(() => {
    setLeftPanelVisible(true);
    setRightPanelVisible(true);
  }, [setLeftPanelVisible, setRightPanelVisible]);

  // Auto-save functionality - only for existing characters
  useInstantAutoSave(
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
          <LeftPanelImage
            src={`${character.image_url}${cacheBuster}`}
            alt={character.name}
          />
        );
      } else {
        setLeftPanelContent(null);
      }
    }
    // Don't clear left panel when character is null
    // Let it preserve content from other pages until a new character is selected
  };

  // Handle editing character (like other pages)
  const handleEditCharacter = (character: CharacterCardData) => {
    setEditingCharacter(character);
    updateLayoutContent(character);
  };

  // Handle starting a chat session with the character
  const handleCharacterChat = async (character: CharacterCardData) => {
    try {
      // Create a new chat session with this character
      const chatSessionId = await createOrGetCardChat(
        'character',
        character.id,
        null // userPersonaId - using null for now, could be enhanced later
      );
      
      // Navigate to the chat page
      navigate(`/chat/${chatSessionId}`);
    } catch (error) {
      console.error('Failed to create chat session:', error);
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
          // Only clear panels if we're deleting the currently edited character
          setLeftPanelContent(null);
          setRightPanelContent(null);
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
    // TODO: Implement character export
  };

  const handleExpressions = () => {
    // Handle expressions view
    // TODO: Implement expressions view
  };

  const handleImageChange = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file || !editingCharacter) {
      return;
    }

    try {
      // Create FormData with the selected image
      const formData = new FormData();
      formData.append('image', file);
      
      // Add character data to the form
      formData.append('name', editingCharacter.name);
      formData.append('description', editingCharacter.description || '');
      formData.append('instructions', editingCharacter.instructions || '');

      // Update the character with the new image
      const updatedCharacter = await updateCharacterCard(editingCharacter.id, formData);
      
      // Update local state
      setEditingCharacter(updatedCharacter);
      setCharacters(prev => 
        prev.map(char => 
          char.id === updatedCharacter.id ? updatedCharacter : char
        )
      );
      
      // Update layout with new image
      updateLayoutContent(updatedCharacter);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to update character image:', error);
      // Could add toast notification here for better UX
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
        />
      );
    }
    // Don't clear the right panel when no character is being edited
    // Let it preserve content from other pages until a new character is selected
  }, [editingCharacter]);

  return (
    <div className="h-full">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold font-quintessential text-white">Characters</h1>
        <div>
          <button
            onClick={handleImport}
            className="bg-app-text text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md mr-2"
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
            className="bg-app-text text-app-surface font-semibold py-2 px-4 rounded-lg shadow-md"
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
        onChange={handleFileInputChange}
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 justify-items-start">
          {characters.map((character) => {
            const cacheBuster = character.updated_at 
              ? `?cb=${encodeURIComponent(character.updated_at)}`
              : `?cb=${character.id}`;
            const imageUrl = character.image_url ? `${character.image_url}${cacheBuster}` : null;
            
            return (
              <div
                key={character.id}
                className="bg-app-surface rounded-lg shadow-lg flex flex-col justify-between w-36 h-60 md:w-44 md:h-72 lg:w-52 lg:h-84 p-0 md:p-0 relative overflow-hidden cursor-pointer group"
                onClick={() => handleEditCharacter(character)}
              >
                <CardImage
                  imageUrl={imageUrl}
                  className="absolute inset-0"
                />
                
                <div className="absolute bottom-0 left-0 w-full">
                  <div className="w-full bg-black/30 backdrop-blur-sm p-3 flex flex-row items-center justify-between rounded-b-lg">
                    <div className="font-semibold text-lg text-white drop-shadow-md break-words flex-1" title={character.name}>
                      {character.name}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCharacterChat(character);
                      }}
                      className="bg-app-text text-black px-3 py-1 rounded-2xl text-sm font-semibold ml-2 hover:bg-app-text/80 transition-colors"
                    >
                      Chat
                    </button>
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