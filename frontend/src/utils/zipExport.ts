// frontend/src/utils/zipExport.ts
import JSZip from 'jszip';
import type { 
  UserPersonaData, 
  CharacterCardData, 
  ScenarioCardData, 
  MasterWorldData, 
  LoreEntryData 
} from '../services/api';

export type ExportableCardData = UserPersonaData | CharacterCardData | ScenarioCardData;
export type ExportableData = ExportableCardData | MasterWorldData;

export interface ZipExportData {
  type: 'user_persona' | 'character_card' | 'scenario_card' | 'master_world';
  version: string;
  exported_at: string;
  data: ExportableData;
  masterWorld?: MasterWorldData;
  loreEntries?: LoreEntryData[];
}

export interface ImageInfo {
  filename: string;
  url: string;
  entityType: 'card' | 'masterworld' | 'loreentry';
  entityId: string;
}

/**
 * Creates a ZIP file with card data, master world, lore entries, and all associated images
 */
export const createZipWithEmbeddedData = async (
  data: ExportableData,
  dataType: 'user_persona' | 'character_card' | 'scenario_card' | 'master_world',
  imageUrl?: string | null,
  masterWorld?: MasterWorldData,
  loreEntries?: LoreEntryData[]
): Promise<Blob> => {
  const zip = new JSZip();

  // Create the main data structure
  const exportData: ZipExportData = {
    type: dataType,
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    data: data,
    masterWorld,
    loreEntries
  };

  // Add main JSON data
  zip.file('data.json', JSON.stringify(exportData, null, 2));

  // Create images folder
  const imagesFolder = zip.folder('images');
  if (!imagesFolder) {
    throw new Error('Failed to create images folder in ZIP');
  }

  const imagePromises: Promise<void>[] = [];

  // Add card image if exists
  if (imageUrl) {
    const cardImagePromise = downloadAndAddImage(
      imagesFolder, 
      imageUrl, 
      `card_${data.id}`, 
      'card'
    );
    imagePromises.push(cardImagePromise);
  }

  // Add master world image if exists
  if (masterWorld?.image_url) {
    const masterWorldImagePromise = downloadAndAddImage(
      imagesFolder, 
      masterWorld.image_url, 
      `masterworld_${masterWorld.id}`, 
      'masterworld'
    );
    imagePromises.push(masterWorldImagePromise);
  }

  // Add lore entry images if they exist
  if (loreEntries) {
    for (const loreEntry of loreEntries) {
      if (loreEntry.image_url) {
        const loreImagePromise = downloadAndAddImage(
          imagesFolder, 
          loreEntry.image_url, 
          `loreentry_${loreEntry.id}`, 
          'loreentry'
        );
        imagePromises.push(loreImagePromise);
      }
    }
  }

  // Wait for all images to be downloaded and added
  await Promise.all(imagePromises);

  // Generate the ZIP blob
  return await zip.generateAsync({ type: 'blob' });
};

/**
 * Downloads an image and adds it to the ZIP folder
 */
const downloadAndAddImage = async (
  folder: JSZip,
  imageUrl: string,
  baseName: string,
  _entityType: string
): Promise<void> => {
  try {
    // Normalize the image URL
    const normalizedUrl = normalizeImageUrl(imageUrl);
    
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      console.warn(`Failed to download image: ${normalizedUrl}`);
      return;
    }

    const blob = await response.blob();
    const extension = getImageExtension(blob.type);
    const filename = `${baseName}${extension}`;

    folder.file(filename, blob);
    console.log(`Added image to ZIP: ${filename}`);
  } catch (error) {
    console.warn(`Error downloading image ${imageUrl}:`, error);
  }
};

/**
 * Normalizes image URL to ensure proper fetching
 */
const normalizeImageUrl = (imageUrl: string): string => {
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  if (imageUrl.startsWith('/')) {
    return `${window.location.origin}${imageUrl}`;
  }
  
  return `${window.location.origin}/static/images/${imageUrl}`;
};

/**
 * Gets appropriate file extension based on MIME type
 */
const getImageExtension = (mimeType: string): string => {
  switch (mimeType) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    default:
      return '.png'; // Default fallback
  }
};

/**
 * Extracts data from a ZIP file
 */
export const extractDataFromZip = async (file: File): Promise<ZipExportData | null> => {
  try {
    const zip = await JSZip.loadAsync(file);
    
    // Extract main data.json
    const dataFile = zip.file('data.json');
    if (!dataFile) {
      throw new Error('No data.json found in ZIP file');
    }

    const dataContent = await dataFile.async('text');
    const exportData: ZipExportData = JSON.parse(dataContent);

    // Validate the data structure
    if (!exportData.type || !exportData.data) {
      throw new Error('Invalid data format in ZIP file');
    }

    return exportData;
  } catch (error) {
    console.error('Error extracting data from ZIP:', error);
    return null;
  }
};

/**
 * Extracts structured data from ZIP for import processing
 */
export const extractStructuredDataFromZip = (zipData: ZipExportData): Array<{type: string, data: any}> => {
  const result: Array<{type: string, data: any}> = [];
  
  // Add the main data entity
  result.push({
    type: zipData.type,
    data: zipData.data
  });
  
  // Add master world if present
  if (zipData.masterWorld) {
    result.push({
      type: 'master_world',
      data: zipData.masterWorld
    });
  }
  
  // Add lore entries if present
  if (zipData.loreEntries) {
    zipData.loreEntries.forEach(loreEntry => {
      result.push({
        type: 'lore_entry',
        data: loreEntry
      });
    });
  }
  
  return result;
};

/**
 * Extracts images from a ZIP file and creates File objects
 */
export const extractImagesFromZip = async (file: File): Promise<{
  cardImage?: File;
  masterWorldImages: { [masterWorldId: string]: File };
  loreEntryImages: { [loreEntryId: string]: File };
}> => {
  const result: {
    cardImage?: File;
    masterWorldImages: { [masterWorldId: string]: File };
    loreEntryImages: { [loreEntryId: string]: File };
  } = {
    masterWorldImages: {},
    loreEntryImages: {}
  };

  try {
    const zip = await JSZip.loadAsync(file);
    const imagesFolder = zip.folder('images');
    
    if (!imagesFolder) {
      return result;
    }

    // Process each image file
    for (const [relativePath, zipEntry] of Object.entries(imagesFolder.files)) {
      if (zipEntry.dir) continue; // Skip directories

      const filename = relativePath;
      const blob = await zipEntry.async('blob');
      
      // Determine image type and create File object
      if (filename.startsWith('card_')) {
        result.cardImage = new File([blob], filename, { type: blob.type });
      } else if (filename.startsWith('masterworld_')) {
        const masterWorldId = extractIdFromFilename(filename, 'masterworld_');
        if (masterWorldId) {
          result.masterWorldImages[masterWorldId] = new File([blob], filename, { type: blob.type });
        }
      } else if (filename.startsWith('loreentry_')) {
        const loreEntryId = extractIdFromFilename(filename, 'loreentry_');
        if (loreEntryId) {
          result.loreEntryImages[loreEntryId] = new File([blob], filename, { type: blob.type });
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error extracting images from ZIP:', error);
    return result;
  }
};

/**
 * Extracts entity ID from filename
 */
const extractIdFromFilename = (filename: string, prefix: string): string | null => {
  if (!filename.startsWith(prefix)) return null;
  
  const withoutPrefix = filename.substring(prefix.length);
  const withoutExtension = withoutPrefix.replace(/\.[^/.]+$/, '');
  
  return withoutExtension || null;
};

/**
 * Generates a filename for the exported ZIP
 */
export const generateZipFilename = (data: ExportableData, dataType: string): string => {
  const name = data.name || 'unnamed';
  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50);
  const timestamp = new Date().toISOString().split('T')[0];
  return `${dataType}_${safeName}_${timestamp}.zip`;
};

/**
 * Downloads a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};
