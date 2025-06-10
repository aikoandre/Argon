import React from 'react';
import { IconActionBar } from '../Layout';
import type { LoreEntryData, MasterWorldData } from '../../services/api';

interface SelectOption {
  value: string;
  label: string;
}

interface LoreEntryEditPanelProps {
  loreEntry: LoreEntryData;
  masterWorlds: MasterWorldData[];
  factionsOptions: SelectOption[];
  entryTypeOptions: SelectOption[];
  onChange: (field: string, value: any) => void;
  onDelete: () => void;
  onImport: () => void;
  onExport: () => void;
  onExpressions: () => void;
  onImageChange: () => void;
  disabled?: boolean;
}

const LoreEntryEditPanel: React.FC<LoreEntryEditPanelProps> = ({
  loreEntry,
  masterWorlds,
  factionsOptions,
  entryTypeOptions,
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
        <h3 className="text-sm font-semibold">Edit Lore Entry</h3>
      </div>
      <form className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
        <label className="font-semibold text-sm">Name
          <input
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={loreEntry.name}
            onChange={e => onChange('name', e.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="font-semibold text-sm">Entry Type
          <select
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={loreEntry.entry_type || ''}
            onChange={e => onChange('entry_type', e.target.value)}
            disabled={disabled}
          >
            {entryTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="font-semibold text-sm">Description
          <textarea
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={loreEntry.description || ''}
            onChange={e => onChange('description', e.target.value)}
            disabled={disabled}
            rows={8}
          />
        </label>
        {loreEntry.entry_type === "CHARACTER_LORE" && (
          <label className="font-semibold text-sm">Group/Faction
            <select
              className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
              value={loreEntry.faction_id || ''}
              onChange={e => onChange('faction_id', e.target.value || null)}
              disabled={disabled}
            >
              <option value="">No Group</option>
              {factionsOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="font-semibold text-sm">Master World
          <select
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={loreEntry.master_world_id || ''}
            onChange={e => onChange('master_world_id', e.target.value)}
            disabled={disabled}
          >
            <option value="">Select a world...</option>
            {masterWorlds.map(world => (
              <option key={world.id} value={world.id}>
                {world.name}
              </option>
            ))}
          </select>
        </label>
      </form>
    </div>
  );
};

export default LoreEntryEditPanel;
