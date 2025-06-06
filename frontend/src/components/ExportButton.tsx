// frontend/src/components/ExportButton.tsx
import React, { useState } from 'react';
import { 
  createPNGWithEmbeddedData, 
  downloadBlob as downloadPngBlob,
  prepareCompleteExportData,
  type ExportableCardData 
} from '../utils/pngExport';
import {
  createZipWithEmbeddedData,
  downloadBlob as downloadZipBlob
} from '../utils/zipExport';
import type { MasterWorldData, LoreEntryData } from '../services/api';

interface ExportButtonProps {
  cardData: ExportableCardData;
  cardType: 'user_persona' | 'character_card' | 'scenario_card';
  imageUrl?: string | null;
  masterWorld?: MasterWorldData;
  loreEntries?: LoreEntryData[];
  disabled?: boolean;
  className?: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  cardData,
  cardType,
  imageUrl,
  masterWorld,
  loreEntries,
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
      // If masterWorld and loreEntries are not provided, fetch them
      let exportMasterWorld = masterWorld;
      let exportLoreEntries = loreEntries;
      
      if (!exportMasterWorld || !exportLoreEntries) {
        const completeData = await prepareCompleteExportData(cardData);
        exportMasterWorld = exportMasterWorld || completeData.masterWorld;
        exportLoreEntries = exportLoreEntries || completeData.loreEntries;
      }

      // Determine format based on content: ZIP if master world exists, PNG otherwise
      const shouldUseZip = exportMasterWorld !== null && exportMasterWorld !== undefined;

      if (shouldUseZip) {
        // Create ZIP with embedded data (includes MasterWorld + LoreEntries + all images)
        const zipBlob = await createZipWithEmbeddedData(
          cardData, 
          cardType, 
          imageUrl, 
          exportMasterWorld!, 
          exportLoreEntries || []
        );
        
        // Generate filename and download
        // Use only the card name for the filename, with proper extension
        const baseName = (cardData.name || 'unnamed').replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50);
        const filename = shouldUseZip ? `${baseName}.zip` : `${baseName}.png`;
        downloadZipBlob(zipBlob, filename);
      } else {
        // Create PNG with embedded data (card only, no MasterWorld)
        const pngBlob = await createPNGWithEmbeddedData(
          cardData, 
          cardType, 
          imageUrl, 
          exportMasterWorld, 
          exportLoreEntries
        );
        
        // Generate filename and download
        // Use only the card name for the filename, with proper extension
        const baseName = (cardData.name || 'unnamed').replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50);
        const filename = shouldUseZip ? `${baseName}.zip` : `${baseName}.png`;
        downloadPngBlob(pngBlob, filename);
      }

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
            : className || 'bg-app-chat hover:bg-app-chat-2 text-app-accent font-semibold py-2 px-2 rounded-lg shadow-md'
          }
        `}
        title={`Export as ${masterWorld ? 'ZIP' : 'PNG'} with embedded data`}
      >
        <span className="material-icons-outlined text-lg mr-1">
          {isExporting ? 'hourglass_empty' : 'download'}
        </span>
        {isExporting ? 'Exporting...' : `Export ${masterWorld ? 'ZIP' : 'PNG'}`}
      </button>
      
      {exportError && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-red-700 text-white text-xs rounded shadow-lg z-10 min-w-max">
          Export failed: {exportError}
        </div>
      )}
    </div>
  );
};

export default ExportButton;
