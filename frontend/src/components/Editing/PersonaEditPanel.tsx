import React, { useState, useCallback, useEffect } from 'react';
import { IconActionBar } from '../Layout';
import { FullscreenModal } from '../Common';
import PlaceholderHelp from '../PlaceholderHelp';
import type { UserPersonaData, MasterWorldData } from '../../services/api';

interface PersonaEditPanelProps {
  persona: UserPersonaData;
  masterWorlds: MasterWorldData[];
  onChange: (field: string, value: any) => void;
  onDelete: () => void;
  onImport: () => void;
  onExport: () => void;
  onExpressions: () => void;
  onImageChange: () => void;
  disabled?: boolean;
}

const PersonaEditPanel: React.FC<PersonaEditPanelProps> = React.memo(({
  persona,
  masterWorlds,
  onChange,
  onDelete,
  onImport,
  onExport,
  onExpressions,
  onImageChange,
  disabled
}) => {
  const [localPersona, setLocalPersona] = useState(persona);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync local state with prop changes (but only for different personas)
  useEffect(() => {
    if (persona.id !== localPersona.id) {
      setLocalPersona(persona);
    }
  }, [persona.id, localPersona.id]);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalPersona(prev => ({ ...prev, name: newValue }));
    onChange('name', newValue);
  }, [onChange]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalPersona(prev => ({ ...prev, description: newValue }));
    onChange('description', newValue);
  }, [onChange]);

  const handleMasterWorldChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value || null;
    setLocalPersona(prev => ({ ...prev, master_world_id: newValue }));
    onChange('master_world_id', newValue);
  }, [onChange]);

  const handleModalDescriptionChange = useCallback((value: string) => {
    setLocalPersona(prev => ({ ...prev, description: value }));
    onChange('description', value);
  }, [onChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        <h3 className="text-sm font-semibold">Edit Persona</h3>
        <PlaceholderHelp />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border">
        <label className="font-semibold text-sm">Name
          <input
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={localPersona.name}
            onChange={handleNameChange}
            disabled={disabled}
          />
        </label>
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-sm">Description</span>
            <button
              type="button"
              onClick={handleOpenModal}
              className="text-app-text-2 hover:text-app-text transition-colors p-1"
              disabled={disabled}
            >
              <span className="material-icons-outlined text-sm">open_in_full</span>
            </button>
          </div>
          <textarea
            className="w-full p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
            value={localPersona.description || ''}
            onChange={handleDescriptionChange}
            disabled={disabled}
            rows={6}
          />
        </div>
        <label className="font-semibold text-sm">Master World (Optional)
          <select
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={localPersona.master_world_id || ''}
            onChange={handleMasterWorldChange}
            disabled={disabled}
          >
            <option value="">Choose One</option>
            {masterWorlds.map(world => (
              <option key={world.id} value={world.id}>
                {world.name}
              </option>
            ))}
          </select>
        </label>
      </form>
      <FullscreenModal
        isOpen={isModalOpen}
        title="Description"
        value={localPersona.description || ''}
        placeholder="Enter persona description... (Use {{char}} and {{user}} as placeholders)"
        disabled={disabled}
        onClose={handleCloseModal}
        onChange={handleModalDescriptionChange}
      />
    </div>
  );
});

PersonaEditPanel.displayName = 'PersonaEditPanel';

export default PersonaEditPanel;
