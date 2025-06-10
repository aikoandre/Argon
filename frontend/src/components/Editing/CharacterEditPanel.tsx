import React from 'react';
import { IconActionBar } from '../Layout';
import type { CharacterCardData } from '../../services/api';

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
      <form className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
        <label className="font-semibold text-sm">Name
          <input
            className="w-full mt-1 p-2 rounded bg-app-bg border border-app-border"
            value={character.name}
            onChange={e => onChange('name', e.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="font-semibold text-sm">Description
          <textarea
            className="w-full mt-1 p-2 rounded bg-app-bg border border-app-border"
            value={character.description || ''}
            onChange={e => onChange('description', e.target.value)}
            disabled={disabled}
            rows={10}
          />
        </label>
        <label className="font-semibold text-sm">Instructions
          <textarea
            className="w-full mt-1 p-2 rounded bg-app-bg border border-app-border"
            value={character.instructions || ''}
            onChange={e => onChange('instructions', e.target.value)}
            disabled={disabled}
            rows={10}
          />
        </label>
      </form>
    </div>
  );
};

export default CharacterEditPanel;
