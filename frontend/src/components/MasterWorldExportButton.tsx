// frontend/src/components/MasterWorldExportButton.tsx
import React, { useState } from 'react';
import {
  createZipWithEmbeddedData,
  downloadBlob,
  generateZipFilename
} from '../utils/zipExport';
import type { MasterWorldData, LoreEntryData } from '../services/api';

interface MasterWorldExportButtonProps {
  masterWorld: MasterWorldData;
  loreEntries?: LoreEntryData[];
  disabled?: boolean;
  className?: string;
}

const MasterWorldExportButton: React.FC<MasterWorldExportButtonProps> = ({
  masterWorld,
  loreEntries = [],
  disabled = false,
  className = ""
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (disabled || isExporting) return;

    setIsExporting(true);
    setExportError(null);

    try {
      // MasterWorlds are always exported as ZIP files
      const zipBlob = await createZipWithEmbeddedData(
        masterWorld,
        'master_world',
        masterWorld.image_url,
        masterWorld,
        loreEntries
      );
      
      // Generate filename and download
      const filename = generateZipFilename(masterWorld, 'master_world');
      downloadBlob(zipBlob, filename);

    } catch (error) {
      console.error('Export failed:', error);
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || isExporting}
        className={`
          inline-flex items-center
          transition-colors duration-200
          ${disabled || isExporting
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed px-4 py-2 text-sm font-medium rounded-md'
            : className || 'bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm font-medium rounded-md'
          }
        `}
        title="Export Master World as ZIP with all lore entries"
      >
        <span className="material-icons-outlined text-lg mr-1">
          {isExporting ? 'hourglass_empty' : 'download'}
        </span>
        {isExporting ? 'Exporting...' : 'Export ZIP'}
      </button>
      
      {exportError && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-red-700 text-white text-xs rounded shadow-lg z-10 min-w-max">
          Export failed: {exportError}
        </div>
      )}
    </div>
  );
};

export default MasterWorldExportButton;
