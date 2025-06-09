import React from 'react';
import { IconActionBar } from '../Layout';
import SaveIndicator from '../UI/SaveIndicator';
import type { CharacterCardData } from '../../services/api';
import type { SaveStatus } from '../../hooks/useInstantAutoSave';

interface CharacterEditPanelProps {
  character: CharacterCardData;
  onChange: (field: string, value: any) => void;
  onDelete: () => void;
  onImport: () => void;
  onExport: () => void;
  onExpressions: () => void;
  onImageChange: () => void;
  autoSaveStatus?: SaveStatus;
  disabled?: boolean;
  onRetryAutoSave?: () => void;
  onResolveConflict?: () => void;
  lastSaved?: Date | null;
  error?: Error | null;
}

const CharacterEditPanel: React.FC<CharacterEditPanelProps> = ({
  character,
  onChange,
  onDelete,
  onImport,
  onExport,
  onExpressions,
  onImageChange,
  autoSaveStatus = 'saved',
  disabled,
  onRetryAutoSave,
  onResolveConflict,
  lastSaved,
  error
}) => {
  return (
    <div className="flex flex-col h-full w-full">
      <IconActionBar
        onDelete={onDelete}
        onImport={onImport}
        onExport={onExport}
        onExpressions={onExpressions}
        onImageChange={onImageChange}
        disabled={disabled}
      />
      <div className="flex justify-between items-center p-2 border-b border-app-border">
        <h3 className="text-sm font-semibold">Edit Character</h3>
        <SaveIndicator
          status={autoSaveStatus}
          lastSaved={lastSaved || undefined}
          onRetry={onRetryAutoSave}
          onResolveConflict={onResolveConflict}
          error={error}
        />
      </div>
      <form className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
        <label className="font-semibold text-sm">Name
          <input
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={character.name}
            onChange={e => onChange('name', e.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="font-semibold text-sm">Description
          <textarea
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={character.description || ''}
            onChange={e => onChange('description', e.target.value)}
            disabled={disabled}
            rows={3}
          />
        </label>
        <label className="font-semibold text-sm">Instructions
          <textarea
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={character.instructions || ''}
            onChange={e => onChange('instructions', e.target.value)}
            disabled={disabled}
            rows={4}
          />
        </label>
      </form>
    </div>
  );
};

export default CharacterEditPanel;
