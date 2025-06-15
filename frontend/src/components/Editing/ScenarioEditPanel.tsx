import React, { useState, useEffect } from 'react';
import { IconActionBar } from '../Layout';
import { FullscreenModal } from '../Common';
import PlaceholderHelp from '../PlaceholderHelp';
import type { ScenarioCardData, MasterWorldData } from '../../services/api';

interface ScenarioEditPanelProps {
  scenario: ScenarioCardData;
  masterWorlds: MasterWorldData[];
  onChange: (field: string, value: any) => void;
  onDelete: () => void;
  onImport: () => void;
  onExport: () => void;
  onExpressions: () => void;
  onImageChange: () => void;
  disabled?: boolean;
}

const ScenarioEditPanel: React.FC<ScenarioEditPanelProps> = ({
  scenario,
  masterWorlds,
  onChange,
  onDelete,
  onImport,
  onExport,
  onExpressions,
  onImageChange,
  disabled
}) => {
  const [fullscreenField, setFullscreenField] = useState<string | null>(null);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  const [currentBeginningMessageIndex, setCurrentBeginningMessageIndex] = useState(0);

  // Initialize arrays if they're empty and manage index bounds
  useEffect(() => {
    const dialogues = getDialogues();
    const messages = getBeginningMessages();
    
    // Only initialize if completely empty (not just containing empty strings)
    if (!scenario.example_dialogues || (Array.isArray(scenario.example_dialogues) && scenario.example_dialogues.length === 0)) {
      onChange('example_dialogues', ['']);
      setCurrentDialogueIndex(0);
    } else if (currentDialogueIndex >= dialogues.length) {
      setCurrentDialogueIndex(Math.max(0, dialogues.length - 1));
    }
    
    // Only initialize if completely empty (not just containing empty strings)
    if (!scenario.beginning_message || (Array.isArray(scenario.beginning_message) && scenario.beginning_message.length === 0)) {
      onChange('beginning_message', ['']);
      setCurrentBeginningMessageIndex(0);
    } else if (currentBeginningMessageIndex >= messages.length) {
      setCurrentBeginningMessageIndex(Math.max(0, messages.length - 1));
    }
  }, [scenario.example_dialogues, scenario.beginning_message, onChange]);

  const openFullscreen = (fieldName: string) => {
    setFullscreenField(fieldName);
  };

  const closeFullscreen = () => {
    setFullscreenField(null);
  };

  const getFieldValue = (fieldName: string) => {
    switch (fieldName) {
      case 'description':
        return scenario.description || '';
      case 'instructions':
        return scenario.instructions || '';
      case 'example_dialogues':
        return Array.isArray(scenario.example_dialogues) 
          ? scenario.example_dialogues.join('\n---\n') 
          : (scenario.example_dialogues || '');
      case 'beginning_message':
        return Array.isArray(scenario.beginning_message) 
          ? scenario.beginning_message.join('\n') 
          : (scenario.beginning_message || '');
      default:
        return '';
    }
  };

  const handleFullscreenChange = (fieldName: string, value: string) => {
    if (fieldName === 'example_dialogues') {
      const dialogues = value.split('\n---\n');
      // Don't filter out empty strings to preserve user's structure
      onChange('example_dialogues', dialogues);
    } else if (fieldName === 'beginning_message') {
      const messages = value.split('\n');
      // Don't filter out empty strings to preserve user's structure
      onChange('beginning_message', messages);
    } else {
      onChange(fieldName, value);
    }
  };

  const getFieldPlaceholder = (fieldName: string) => {
    switch (fieldName) {
      case 'description':
        return 'Enter scenario description...';
      case 'instructions':
        return 'Enter scenario instructions... (Use {{char}} and {{user}} as placeholders)';
      case 'example_dialogues':
        return "Enter example dialogues separated by '---' on new lines (Use {{char}} and {{user}} as placeholders)";
      case 'beginning_message':
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
      case 'beginning_message':
        return 'Beginning Messages';
      default:
        return '';
    }
  };

  // Helper functions for managing dialogues
  const getDialogues = (): string[] => {
    const dialogues = scenario.example_dialogues;
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
    onChange('example_dialogues', newDialogues);
  };

  // Helper functions for managing beginning messages
  const getBeginningMessages = (): string[] => {
    const messages = scenario.beginning_message;
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
    onChange('beginning_message', newMessages);
    // Set index to the new item after the state update
    setTimeout(() => {
      setCurrentBeginningMessageIndex(newMessages.length - 1);
    }, 0);
  };

  const removeBeginningMessage = () => {
    const messages = getBeginningMessages();
    if (messages.length > 1) {
      const newMessages = messages.filter((_, index) => index !== currentBeginningMessageIndex);
      onChange('beginning_message', newMessages);
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
    onChange('beginning_message', newMessages);
  };
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
      <div className="flex justify-between items-center p-2 border-b border-app-border bg-app-surface">
        <h3 className="text-sm font-semibold">Edit Scenario</h3>
        <PlaceholderHelp />
      </div>
      <form className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border">
        <label className="font-semibold text-sm">Name
          <input
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={scenario.name}
            onChange={e => onChange('name', e.target.value)}
            disabled={disabled}
          />
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
            value={scenario.description || ''}
            onChange={e => onChange('description', e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="Enter scenario description... (Use {{char}} and {{user}} as placeholders)"
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
            value={scenario.instructions || ''}
            onChange={e => onChange('instructions', e.target.value)}
            disabled={disabled}
            rows={4}
            placeholder="Enter scenario instructions... (Use {{char}} and {{user}} as placeholders)"
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
                onClick={() => openFullscreen('beginning_message')}
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
        
        <label className="font-semibold text-sm">Master World
          <select
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={scenario.master_world_id || ''}
            onChange={e => onChange('master_world_id', e.target.value || null)}
            disabled={disabled}
          >
            <option value="">Empty</option>
            {masterWorlds.map(world => (
              <option key={world.id} value={world.id}>
                {world.name}
              </option>
            ))}
          </select>
        </label>
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
};

export default ScenarioEditPanel;