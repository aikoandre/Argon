import React from 'react';
import { IconActionBar } from '../Layout';
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
      </div>
      <form className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
        <label className="font-semibold text-sm">Name
          <input
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={scenario.name}
            onChange={e => onChange('name', e.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="font-semibold text-sm">Description
          <textarea
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={scenario.description || ''}
            onChange={e => onChange('description', e.target.value)}
            disabled={disabled}
            rows={3}
          />
        </label>
        <label className="font-semibold text-sm">Instructions
          <textarea
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={scenario.instructions || ''}
            onChange={e => onChange('instructions', e.target.value)}
            disabled={disabled}
            rows={4}
          />
        </label>
        <label className="font-semibold text-sm">Master World
          <select
            className="w-full mt-1 p-2 rounded bg-app-surface border border-app-border"
            value={scenario.master_world_id || ''}
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

export default ScenarioEditPanel;