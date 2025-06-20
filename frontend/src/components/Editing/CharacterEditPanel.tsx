import React, { useState, useEffect, useCallback } from 'react';
import { IconActionBar } from '../Layout';
import { FullscreenModal } from '../Common';
import type { CharacterCardData, MasterWorldData } from '../../services/api';
import { getAllMasterWorlds } from '../../services/api';

interface CharacterEditPanelProps {
  character: CharacterCardData;
  onChange: (field: string, value: any) => void;
  onDelete: () => void;
  onImport: () => void;
  onExport: () => void;
  onExpressions: () => void;
  onImageChange: () => void;
  disabled?: boolean;
}

const CharacterEditPanel: React.FC<CharacterEditPanelProps> = React.memo(({
  character,
  onChange,
  onDelete,
  onImport,
  onExport,
  onExpressions,
  onImageChange,
  disabled
}) => {
  const [localCharacter, setLocalCharacter] = useState(character);
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [loadingMasterWorlds, setLoadingMasterWorlds] = useState(false);
  const [fullscreenField, setFullscreenField] = useState<string | null>(null);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  const [currentBeginningMessageIndex, setCurrentBeginningMessageIndex] = useState(0);

  // Sync local state with prop changes (but only for different characters)
  useEffect(() => {
    if (character.id !== localCharacter.id) {
      setLocalCharacter(character);
    }
  }, [character.id, localCharacter.id]);

  // Fetch master worlds on component mount
  useEffect(() => {
    const fetchMasterWorlds = async () => {
      setLoadingMasterWorlds(true);
      try {
        const worlds = await getAllMasterWorlds();
        setMasterWorlds(worlds);
      } catch (error) {
        console.error('Failed to fetch master worlds:', error);
      } finally {
        setLoadingMasterWorlds(false);
      }
    };

    fetchMasterWorlds();
  }, []);

  // Initialize arrays if they're empty and manage index bounds
  useEffect(() => {
    const dialogues = getDialogues();
    const messages = getBeginningMessages();
    
    // Only initialize if completely empty (not just containing empty strings)
    if (!localCharacter.example_dialogues || (Array.isArray(localCharacter.example_dialogues) && localCharacter.example_dialogues.length === 0)) {
      const updatedCharacter = { ...localCharacter, example_dialogues: [''] };
      setLocalCharacter(updatedCharacter);
      onChange('example_dialogues', ['']);
      setCurrentDialogueIndex(0);
    } else if (currentDialogueIndex >= dialogues.length) {
      setCurrentDialogueIndex(Math.max(0, dialogues.length - 1));
    }
    
    // Only initialize if completely empty (not just containing empty strings)
    if (!localCharacter.beginning_messages || (Array.isArray(localCharacter.beginning_messages) && localCharacter.beginning_messages.length === 0)) {
      const updatedCharacter = { ...localCharacter, beginning_messages: [''] };
      setLocalCharacter(updatedCharacter);
      onChange('beginning_messages', ['']);
      setCurrentBeginningMessageIndex(0);
    } else if (currentBeginningMessageIndex >= messages.length) {
      setCurrentBeginningMessageIndex(Math.max(0, messages.length - 1));
    }
  }, [localCharacter.example_dialogues, localCharacter.beginning_messages, onChange, localCharacter]);

  const openFullscreen = (fieldName: string) => {
    setFullscreenField(fieldName);
  };

  const closeFullscreen = () => {
    setFullscreenField(null);
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
  }, []);

  const getFieldValue = (fieldName: string) => {
    switch (fieldName) {
      case 'description':
        return localCharacter.description || '';
      case 'instructions':
        return localCharacter.instructions || '';
      case 'example_dialogues':
        return Array.isArray(localCharacter.example_dialogues) 
          ? localCharacter.example_dialogues.join('\n---\n') 
          : (localCharacter.example_dialogues || '');
      case 'beginning_messages':
        return Array.isArray(localCharacter.beginning_messages) 
          ? localCharacter.beginning_messages.join('\n') 
          : (localCharacter.beginning_messages || '');
      default:
        return '';
    }
  };

  const handleFullscreenChange = (fieldName: string, value: string) => {
    if (fieldName === 'example_dialogues') {
      const dialogues = value.split('\n---\n');
      const updatedCharacter = { ...localCharacter, example_dialogues: dialogues };
      setLocalCharacter(updatedCharacter);
      onChange('example_dialogues', dialogues);
    } else if (fieldName === 'beginning_messages') {
      const messages = value.split('\n');
      const updatedCharacter = { ...localCharacter, beginning_messages: messages };
      setLocalCharacter(updatedCharacter);
      onChange('beginning_messages', messages);
    } else {
      const updatedCharacter = { ...localCharacter, [fieldName]: value };
      setLocalCharacter(updatedCharacter);
      onChange(fieldName, value);
    }
  };

  const getFieldPlaceholder = (fieldName: string) => {
    switch (fieldName) {
      case 'description':
        return 'Enter character description...';
      case 'instructions':
        return 'Enter character instructions... (Use {{char}} and {{user}} as placeholders)';
      case 'example_dialogues':
        return "Enter example dialogues separated by '---' on new lines (Use {{char}} and {{user}} as placeholders)";
      case 'beginning_messages':
        return 'Enter beginning messages, one per line (Use {{char}} and {{user}} as placeholders)';
      default:
        return '';
    }
  };

  const getFieldTitle = (fieldName: string) => {
    switch (fieldName) {
      case 'description':
        return 'Description';
      case 'instructions':
        return 'Instructions';
      case 'example_dialogues':
        return 'Example Dialogues';
      case 'beginning_messages':
        return 'Beginning Messages';
      default:
        return '';
    }
  };

  // Helper functions for managing dialogues
  const getDialogues = (): string[] => {
    const dialogues = localCharacter.example_dialogues;
    if (Array.isArray(dialogues) && dialogues.length > 0) {
      return dialogues.map(d => typeof d === 'string' ? d : '');
    }
    return [''];
  };

  const getCurrentDialogue = (): string => {
    const dialogues = getDialogues();
    return dialogues[currentDialogueIndex] || '';
  };

  const navigateDialogue = (direction: 'prev' | 'next') => {
    const dialogues = getDialogues();
    if (direction === 'prev' && currentDialogueIndex > 0) {
      setCurrentDialogueIndex(currentDialogueIndex - 1);
    } else if (direction === 'next' && currentDialogueIndex < dialogues.length - 1) {
      setCurrentDialogueIndex(currentDialogueIndex + 1);
    }
  };

  const addDialogue = () => {
    const dialogues = getDialogues();
    const newDialogues = [...dialogues, ''];
    const updatedCharacter = { ...localCharacter, example_dialogues: newDialogues };
    setLocalCharacter(updatedCharacter);
    onChange('example_dialogues', newDialogues);
    // Set index to the new item after the state update
    setTimeout(() => {
      setCurrentDialogueIndex(newDialogues.length - 1);
    }, 0);
  };

  const removeDialogue = () => {
    const dialogues = getDialogues();
    if (dialogues.length > 1) {
      const newDialogues = dialogues.filter((_, index) => index !== currentDialogueIndex);
      const updatedCharacter = { ...localCharacter, example_dialogues: newDialogues };
      setLocalCharacter(updatedCharacter);
      onChange('example_dialogues', newDialogues);
      // Adjust index if it's out of bounds
      const newIndex = currentDialogueIndex >= newDialogues.length 
        ? Math.max(0, newDialogues.length - 1) 
        : currentDialogueIndex;
      setTimeout(() => {
        setCurrentDialogueIndex(newIndex);
      }, 0);
    }
  };

  const updateCurrentDialogue = (value: string) => {
    const dialogues = getDialogues();
    const newDialogues = [...dialogues];
    newDialogues[currentDialogueIndex] = value;
    const updatedCharacter = { ...localCharacter, example_dialogues: newDialogues };
    setLocalCharacter(updatedCharacter);
    onChange('example_dialogues', newDialogues);
  };

  // Helper functions for managing beginning messages
  const getBeginningMessages = (): string[] => {
    const messages = localCharacter.beginning_messages;
    if (Array.isArray(messages) && messages.length > 0) {
      return messages.map(m => typeof m === 'string' ? m : '');
    }
    return [''];
  };

  const getCurrentBeginningMessage = (): string => {
    const messages = getBeginningMessages();
    return messages[currentBeginningMessageIndex] || '';
  };

  const navigateBeginningMessage = (direction: 'prev' | 'next') => {
    const messages = getBeginningMessages();
    if (direction === 'prev' && currentBeginningMessageIndex > 0) {
      setCurrentBeginningMessageIndex(currentBeginningMessageIndex - 1);
    } else if (direction === 'next' && currentBeginningMessageIndex < messages.length - 1) {
      setCurrentBeginningMessageIndex(currentBeginningMessageIndex + 1);
    }
  };

  const addBeginningMessage = () => {
    const messages = getBeginningMessages();
    const newMessages = [...messages, ''];
    const updatedCharacter = { ...localCharacter, beginning_messages: newMessages };
    setLocalCharacter(updatedCharacter);
    onChange('beginning_messages', newMessages);
    // Set index to the new item after the state update
    setTimeout(() => {
      setCurrentBeginningMessageIndex(newMessages.length - 1);
    }, 0);
  };

  const removeBeginningMessage = () => {
    const messages = getBeginningMessages();
    if (messages.length > 1) {
      const newMessages = messages.filter((_, index) => index !== currentBeginningMessageIndex);
      const updatedCharacter = { ...localCharacter, beginning_messages: newMessages };
      setLocalCharacter(updatedCharacter);
      onChange('beginning_messages', newMessages);
      // Adjust index if it's out of bounds
      const newIndex = currentBeginningMessageIndex >= newMessages.length 
        ? Math.max(0, newMessages.length - 1) 
        : currentBeginningMessageIndex;
      setTimeout(() => {
        setCurrentBeginningMessageIndex(newIndex);
      }, 0);
    }
  };

  const updateCurrentBeginningMessage = (value: string) => {
    const messages = getBeginningMessages();
    const newMessages = [...messages];
    newMessages[currentBeginningMessageIndex] = value;
    const updatedCharacter = { ...localCharacter, beginning_messages: newMessages };
    setLocalCharacter(updatedCharacter);
    onChange('beginning_messages', newMessages);
  };

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalCharacter(prev => ({ ...prev, name: newValue }));
    onChange('name', newValue);
  }, [onChange]);

  const handleMasterWorldChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value || null;
    setLocalCharacter(prev => ({ ...prev, master_world_id: newValue || '' }));
    onChange('master_world_id', newValue);
  }, [onChange]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalCharacter(prev => ({ ...prev, description: newValue }));
    onChange('description', newValue);
  }, [onChange]);

  const handleInstructionsChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalCharacter(prev => ({ ...prev, instructions: newValue }));
    onChange('instructions', newValue);
  }, [onChange]);

  return (
    <div className="flex flex-col h-full w-full bg-app-surface">
      <IconActionBar
        onDelete={onDelete}
        onImport={onImport}
        onExport={onExport}
        onExpressions={onExpressions}
        onImageChange={onImageChange}
        disabled={disabled}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border">
        <label className="font-semibold text-sm">Name
          <input
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={localCharacter.name}
            onChange={handleNameChange}
            disabled={disabled}
          />
        </label>
        
        <label className="font-semibold text-sm">Master World
          <select
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={localCharacter.master_world_id || ''}
            onChange={handleMasterWorldChange}
            disabled={disabled || loadingMasterWorlds}
          >
            <option value="">None</option>
            {masterWorlds.map(world => (
              <option key={world.id} value={world.id}>
                {world.name}
              </option>
            ))}
          </select>
        </label>
        
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-sm">Description</span>
            <button
              type="button"
              onClick={() => openFullscreen('description')}
              className="text-app-text-2 hover:text-app-text transition-colors p-1"
              disabled={disabled}
            >
              <span className="material-icons-outlined text-sm">open_in_full</span>
            </button>
          </div>
          <textarea
            className="w-full p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
            value={localCharacter.description || ''}
            onChange={handleDescriptionChange}
            disabled={disabled}
            rows={6}
          />
        </div>
        
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-sm">Instructions</span>
            <button
              type="button"
              onClick={() => openFullscreen('instructions')}
              className="text-app-text-2 hover:text-app-text transition-colors p-1"
              disabled={disabled}
            >
              <span className="material-icons-outlined text-sm">open_in_full</span>
            </button>
          </div>
          <textarea
            className="w-full p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
            value={localCharacter.instructions || ''}
            onChange={handleInstructionsChange}
            disabled={disabled}
            rows={6}
          />
        </div>
        
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-sm">Example Dialogues</span>
            <div className="flex items-center gap-1">
              {/* Left Arrow */}
              <button
                type="button"
                onClick={() => navigateDialogue('prev')}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled || currentDialogueIndex === 0}
                title="Previous dialogue"
              >
                <span className="material-icons-outlined text-sm">keyboard_arrow_left</span>
              </button>
              
              {/* Index indicator */}
              <span className="text-xs text-app-text-2 px-2 min-w-[2rem] text-center">
                {`${currentDialogueIndex + 1}/${getDialogues().length}`}
              </span>
              
              {/* Right Arrow */}
              <button
                type="button"
                onClick={() => navigateDialogue('next')}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled || currentDialogueIndex >= getDialogues().length - 1}
                title="Next dialogue"
              >
                <span className="material-icons-outlined text-sm">keyboard_arrow_right</span>
              </button>
              
              {/* Add Button */}
              <button
                type="button"
                onClick={addDialogue}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled}
                title="Add dialogue"
              >
                <span className="material-icons-outlined text-sm">add</span>
              </button>
              
              {/* Remove Button */}
              <button
                type="button"
                onClick={removeDialogue}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled || getDialogues().length <= 1}
                title="Remove dialogue"
              >
                <span className="material-icons-outlined text-sm">remove</span>
              </button>
              
              {/* Fullscreen */}
              <button
                type="button"
                onClick={() => openFullscreen('example_dialogues')}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled}
                title="Fullscreen edit"
              >
                <span className="material-icons-outlined text-sm">open_in_full</span>
              </button>
            </div>
          </div>
          <textarea
            className="w-full p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
            value={getCurrentDialogue()}
            onChange={e => updateCurrentDialogue(e.target.value)}
            disabled={disabled}
            rows={6}
            placeholder="Enter example dialogue... (Use {{char}} and {{user}} as placeholders)"
          />
        </div>
        
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-sm">Beginning Messages</span>
            <div className="flex items-center gap-1">
              {/* Left Arrow */}
              <button
                type="button"
                onClick={() => navigateBeginningMessage('prev')}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled || currentBeginningMessageIndex === 0}
                title="Previous message"
              >
                <span className="material-icons-outlined text-sm">keyboard_arrow_left</span>
              </button>
              
              {/* Index indicator */}
              <span className="text-xs text-app-text-2 px-2 min-w-[2rem] text-center">
                {`${currentBeginningMessageIndex + 1}/${getBeginningMessages().length}`}
              </span>
              
              {/* Right Arrow */}
              <button
                type="button"
                onClick={() => navigateBeginningMessage('next')}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled || currentBeginningMessageIndex >= getBeginningMessages().length - 1}
                title="Next message"
              >
                <span className="material-icons-outlined text-sm">keyboard_arrow_right</span>
              </button>
              
              {/* Add Button */}
              <button
                type="button"
                onClick={addBeginningMessage}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled}
                title="Add message"
              >
                <span className="material-icons-outlined text-sm">add</span>
              </button>
              
              {/* Remove Button */}
              <button
                type="button"
                onClick={removeBeginningMessage}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled || getBeginningMessages().length <= 1}
                title="Remove message"
              >
                <span className="material-icons-outlined text-sm">remove</span>
              </button>
              
              {/* Fullscreen */}
              <button
                type="button"
                onClick={() => openFullscreen('beginning_messages')}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={disabled}
                title="Fullscreen edit"
              >
                <span className="material-icons-outlined text-sm">open_in_full</span>
              </button>
            </div>
          </div>
          <textarea
            className="w-full p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
            value={getCurrentBeginningMessage()}
            onChange={e => updateCurrentBeginningMessage(e.target.value)}
            disabled={disabled}
            rows={6}
            placeholder="Enter beginning message... (Use {{char}} and {{user}} as placeholders)"
          />
        </div>
      </form>

      {/* Fullscreen Modal */}
      <FullscreenModal
        isOpen={!!fullscreenField}
        title={getFieldTitle(fullscreenField || '')}
        value={getFieldValue(fullscreenField || '')}
        placeholder={getFieldPlaceholder(fullscreenField || '')}
        disabled={disabled}
        onClose={closeFullscreen}
        onChange={(value) => handleFullscreenChange(fullscreenField || '', value)}
      />
    </div>
  );
});

CharacterEditPanel.displayName = 'CharacterEditPanel';

export default CharacterEditPanel;
