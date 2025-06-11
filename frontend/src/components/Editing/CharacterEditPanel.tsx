import React, { useState, useEffect } from 'react';
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

const CharacterEditPanel: React.FC<CharacterEditPanelProps> = ({
  character,
  onChange,
  onDelete,
  onImport,
  onExport,
  onExpressions,
  onImageChange,
  disabled
}) => {
  const [masterWorlds, setMasterWorlds] = useState<MasterWorldData[]>([]);
  const [loadingMasterWorlds, setLoadingMasterWorlds] = useState(false);
  const [fullscreenField, setFullscreenField] = useState<string | null>(null);

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

  const openFullscreen = (fieldName: string) => {
    setFullscreenField(fieldName);
  };

  const closeFullscreen = () => {
    setFullscreenField(null);
  };

  const getFieldValue = (fieldName: string) => {
    switch (fieldName) {
      case 'description':
        return character.description || '';
      case 'instructions':
        return character.instructions || '';
      case 'example_dialogues':
        return Array.isArray(character.example_dialogues) 
          ? character.example_dialogues.join('\n---\n') 
          : (character.example_dialogues || '');
      case 'beginning_messages':
        return Array.isArray(character.beginning_messages) 
          ? character.beginning_messages.join('\n') 
          : (character.beginning_messages || '');
      default:
        return '';
    }
  };

  const handleFullscreenChange = (fieldName: string, value: string) => {
    if (fieldName === 'example_dialogues') {
      const dialogues = value.split('\n---\n').filter(d => d.trim());
      onChange('example_dialogues', dialogues);
    } else if (fieldName === 'beginning_messages') {
      const messages = value.split('\n').filter(m => m.trim());
      onChange('beginning_messages', messages);
    } else {
      onChange(fieldName, value);
    }
  };

  const getFieldPlaceholder = (fieldName: string) => {
    switch (fieldName) {
      case 'description':
        return 'Enter character description...';
      case 'instructions':
        return 'Enter character instructions...';
      case 'example_dialogues':
        return "Enter example dialogues separated by '---' on new lines";
      case 'beginning_messages':
        return 'Enter beginning messages, one per line';
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
        <h3 className="text-sm font-semibold">Edit Character</h3>
      </div>
      <form className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border">
        <label className="font-semibold text-sm">Name
          <input
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={character.name}
            onChange={e => onChange('name', e.target.value)}
            disabled={disabled}
          />
        </label>
        
        <label className="font-semibold text-sm">Master World
          <select
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={character.master_world_id || ''}
            onChange={e => onChange('master_world_id', e.target.value || null)}
            disabled={disabled || loadingMasterWorlds}
          >
            <option value="">Empty</option>
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
            value={character.description || ''}
            onChange={e => onChange('description', e.target.value)}
            disabled={disabled}
            rows={6}
            placeholder="Enter character description..."
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
            value={character.instructions || ''}
            onChange={e => onChange('instructions', e.target.value)}
            disabled={disabled}
            rows={6}
          />
        </div>
        
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-sm">Example Dialogues</span>
            <button
              type="button"
              onClick={() => openFullscreen('example_dialogues')}
              className="text-app-text-2 hover:text-app-text transition-colors p-1"
              disabled={disabled}
            >
              <span className="material-icons-outlined text-sm">open_in_full</span>
            </button>
          </div>
          <textarea
            className="w-full p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
            value={Array.isArray(character.example_dialogues) 
              ? character.example_dialogues.join('\n---\n') 
              : (character.example_dialogues || '')}
            onChange={e => {
              const value = e.target.value;
              const dialogues = value.split('\n---\n').filter(d => d.trim());
              onChange('example_dialogues', dialogues);
            }}
            disabled={disabled}
            rows={6}
            placeholder="Enter example dialogues separated by '---' on new lines"
          />
        </div>
        
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-sm">Beginning Messages</span>
            <button
              type="button"
              onClick={() => openFullscreen('beginning_messages')}
              className="text-app-text-2 hover:text-app-text transition-colors p-1"
              disabled={disabled}
            >
              <span className="material-icons-outlined text-sm">open_in_full</span>
            </button>
          </div>
          <textarea
            className="w-full p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
            value={Array.isArray(character.beginning_messages) 
              ? character.beginning_messages.join('\n') 
              : (character.beginning_messages || '')}
            onChange={e => {
              const value = e.target.value;
              const messages = value.split('\n').filter(m => m.trim());
              onChange('beginning_messages', messages);
            }}
            disabled={disabled}
            rows={6}
            placeholder="Enter beginning messages, one per line"
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
};

export default CharacterEditPanel;
