// frontend/src/components/ImportButton.tsx
import React, { useRef, useState } from 'react';
import { extractJSONFromPNG, type PNGExportData } from '../utils/pngExport';
import { extractDataFromZip, type ZipExportData } from '../utils/zipExport';
import ImportOptionsModal from './ImportOptionsModal';

interface ImportOptions {
  importCard: boolean;
  importMasterWorld: boolean;
  importLoreEntries: boolean;
}

interface ImportButtonProps {
  onImport: (data: PNGExportData | ZipExportData, options?: ImportOptions) => void;
  expectedType?: 'user_persona' | 'character_card' | 'scenario_card' | 'master_world';
  disabled?: boolean;
  className?: string;
  showOptionsModal?: boolean; // New prop to enable options modal
}

const ImportButton: React.FC<ImportButtonProps> = ({
  onImport,
  expectedType,
  disabled = false,
  className = "",
  showOptionsModal = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<PNGExportData | ZipExportData | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);

    try {
      let extractedData: PNGExportData | ZipExportData;

      // Check if it's a ZIP file
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        // Handle ZIP file
        const zipData = await extractDataFromZip(file);
        if (!zipData) {
          throw new Error('No data found in the ZIP file');
        }
        extractedData = zipData;
      } else if (file.type.startsWith('image/png') || file.name.endsWith('.png')) {
        // Handle PNG file
        const pngData = await extractJSONFromPNG(file);
        if (!pngData) {
          throw new Error('No embedded data found in this PNG file');
        }
        // Add the original image file to the extracted data
        pngData.imageFile = file;
        extractedData = pngData;
      } else {
        throw new Error('Please select a PNG or ZIP file');
      }

      // For PNG files, validate the data structure
      if ('type' in extractedData) {
        if (!extractedData.type || !extractedData.data) {
          throw new Error('Invalid data format in file');
        }

        // Check if the type matches expected type (if specified)
        if (expectedType && extractedData.type !== expectedType) {
          throw new Error(`This file contains ${extractedData.type} data, but ${expectedType} data was expected`);
        }
      }

      // For ZIP files, check if there's a card type that matches expected type
      if ('version' in extractedData && expectedType) {
        if (extractedData.type !== expectedType) {
          throw new Error(`This ZIP file contains ${extractedData.type} data, but ${expectedType} data was expected`);
        }
      }

      // If modal is enabled and there's additional data, show options
      if (showOptionsModal && ('masterWorld' in extractedData && extractedData.masterWorld || 'loreEntries' in extractedData && extractedData.loreEntries)) {
        setPendingImportData(extractedData);
        setShowModal(true);
      } else {
        // Call the import handler directly
        onImport(extractedData);
      }

    } catch (error) {
      console.error('Import failed:', error);
      setImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (disabled || isImporting) return;
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleModalImport = (data: PNGExportData | ZipExportData, options: ImportOptions) => {
    onImport(data, options);
    setShowModal(false);
    setPendingImportData(null);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setPendingImportData(null);
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || isImporting}
          className={`
            inline-flex items-center px-3 py-2 text-sm font-medium rounded-md
            transition-colors duration-200
            ${disabled || isImporting
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
            }
            ${className}
          `}
          title="Import from PNG or ZIP file"
        >
          <span className="material-icons-outlined text-lg mr-1">
            {isImporting ? 'hourglass_empty' : 'upload'}
          </span>
          {isImporting ? 'Importing...' : 'Import'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,.zip,application/zip"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {importError && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-red-700 text-white text-xs rounded shadow-lg z-10 min-w-max max-w-xs">
            Import failed: {importError}
          </div>
        )}
      </div>

      {/* Import Options Modal */}
      <ImportOptionsModal
        isOpen={showModal}
        onClose={handleModalClose}
        onImport={handleModalImport}
        importData={pendingImportData}
      />
    </>
  );
};

export default ImportButton;
