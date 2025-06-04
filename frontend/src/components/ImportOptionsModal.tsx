// frontend/src/components/ImportOptionsModal.tsx
import React, { useState } from 'react';
import { type PNGExportData } from '../utils/pngExport';

interface ImportOptions {
  importCard: boolean;
  importMasterWorld: boolean;
  importLoreEntries: boolean;
}

interface ImportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: PNGExportData, options: ImportOptions) => void;
  importData: PNGExportData | null;
}

const ImportOptionsModal: React.FC<ImportOptionsModalProps> = ({
  isOpen,
  onClose,
  onImport,
  importData
}) => {
  const [options, setOptions] = useState<ImportOptions>({
    importCard: true,
    importMasterWorld: true,
    importLoreEntries: true
  });

  if (!isOpen || !importData) return null;

  const hasCard = importData.data;
  const hasMasterWorld = importData.masterWorld;
  const hasLoreEntries = importData.loreEntries && importData.loreEntries.length > 0;

  const handleImport = () => {
    onImport(importData, options);
    onClose();
  };

  const cardTypeName = importData.type === 'character_card' ? 'Character' 
                     : importData.type === 'scenario_card' ? 'Scenario'
                     : importData.type === 'user_persona' ? 'Persona'
                     : 'Card';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-app-bg rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-white mb-4">Import Options</h2>
        
        <div className="space-y-4 mb-6">
          <p className="text-gray-300 text-sm">
            Choose what to import from the PNG file:
          </p>
          
          {/* Card Option */}
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={options.importCard}
              onChange={(e) => setOptions(prev => ({ ...prev, importCard: e.target.checked }))}
              disabled={!hasCard}
              className="rounded border-app-surface bg-app-surface text-app-accent"
            />
            <span className={hasCard ? "text-white" : "text-gray-500"}>
              {cardTypeName} Card
              {!hasCard && " (not available)"}
            </span>
          </label>

          {/* MasterWorld Option */}
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={options.importMasterWorld}
              onChange={(e) => setOptions(prev => ({ ...prev, importMasterWorld: e.target.checked }))}
              disabled={!hasMasterWorld}
              className="rounded border-app-surface bg-app-surface text-app-accent"
            />
            <span className={hasMasterWorld ? "text-white" : "text-gray-500"}>
              Master World
              {hasMasterWorld ? ` (${importData.masterWorld?.name})` : " (not available)"}
            </span>
          </label>

          {/* LoreEntries Option */}
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={options.importLoreEntries}
              onChange={(e) => setOptions(prev => ({ ...prev, importLoreEntries: e.target.checked }))}
              disabled={!hasLoreEntries}
              className="rounded border-app-surface bg-app-surface text-app-accent"
            />
            <span className={hasLoreEntries ? "text-white" : "text-gray-500"}>
              Lore Entries
              {hasLoreEntries ? ` (${importData.loreEntries?.length} entries)` : " (not available)"}
            </span>
          </label>
        </div>

        {/* Warning for no selections */}
        {!options.importCard && !options.importMasterWorld && !options.importLoreEntries && (
          <div className="mb-4 p-3 bg-app-accent-2 rounded text-app-bg text-sm">
            Please select at least one item to import.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleImport}
            disabled={!options.importCard && !options.importMasterWorld && !options.importLoreEntries}
            className="flex-1 bg-app-chat hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors"
          >
            Import Selected
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-app-surface hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportOptionsModal;
