import React, { useState } from 'react';
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

const PersonaEditPanel: React.FC<PersonaEditPanelProps> = ({
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
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
      <form className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border">
        <label className="font-semibold text-sm">Name
          <input
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={persona.name}
            onChange={e => onChange('name', e.target.value)}
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
            value={persona.description || ''}
            onChange={e => onChange('description', e.target.value)}
            disabled={disabled}
            rows={6}
          />
        </div>
        <label className="font-semibold text-sm">Master World (Optional)
          <select
            className="w-full mt-1 p-2 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0"
            value={persona.master_world_id || ''}
            onChange={e => onChange('master_world_id', e.target.value || null)}
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
        value={persona.description || ''}
        placeholder="Enter persona description... (Use {{char}} and {{user}} as placeholders)"
        disabled={disabled}
        onClose={handleCloseModal}
        onChange={(value) => onChange('description', value)}
      />
    </div>
  );
};

export default PersonaEditPanel;
