// frontend/src/utils/pngExport.ts
import type { 
  UserPersonaData, 
  CharacterCardData, 
  ScenarioCardData, 
  MasterWorldData, 
  LoreEntryData 
} from '../services/api';

export type ExportableCardData = UserPersonaData | CharacterCardData | ScenarioCardData;

export interface PNGExportData {
  type: 'user_persona' | 'character_card' | 'scenario_card';
  version: string;
  exported_at: string;
  data: ExportableCardData;
  masterWorld?: MasterWorldData; // Include associated MasterWorld
  loreEntries?: LoreEntryData[]; // Include associated LoreEntries
  imageFile?: File; // The original PNG file for import operations
  exportedImageBlob?: Blob; // The exported PNG blob with embedded data
}

/**
 * Creates a PNG image with embedded JSON metadata
 */
export const createPNGWithEmbeddedData = async (
  cardData: ExportableCardData,
  cardType: 'user_persona' | 'character_card' | 'scenario_card',
  imageUrl?: string | null,
  masterWorld?: MasterWorldData,
  loreEntries?: LoreEntryData[]
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // High resolution card dimensions (3:4.5 aspect ratio)
  const CARD_WIDTH = 1024;  // Doubled from 512
  const CARD_HEIGHT = 1536; // 3:4.5 aspect ratio (1024 * 4.5/3)
  
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  // Create the export data structure
  const exportData: PNGExportData = {
    type: cardType,
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    data: cardData,
    masterWorld,
    loreEntries
  };

  try {
    if (imageUrl) {
      // Load and draw the card image
      const image = new Image();
      image.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve) => {
        image.onload = () => {
          // Calculate crop dimensions to maintain aspect ratio
          const imageAspectRatio = image.width / image.height;
          const canvasAspectRatio = CARD_WIDTH / CARD_HEIGHT;
          
          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = image.width;
          let sourceHeight = image.height;
          
          if (imageAspectRatio > canvasAspectRatio) {
            // Image is wider than canvas aspect ratio - crop width
            sourceWidth = image.height * canvasAspectRatio;
            sourceX = (image.width - sourceWidth) / 2;
          } else {
            // Image is taller than canvas aspect ratio - crop height
            sourceHeight = image.width / canvasAspectRatio;
            sourceY = (image.height - sourceHeight) / 2;
          }
          
          // Draw the cropped image to fill the canvas
          ctx.drawImage(
            image,
            sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle (cropped)
            0, 0, CARD_WIDTH, CARD_HEIGHT                 // Destination rectangle (full canvas)
          );
          resolve();
        };
        image.onerror = () => {
          console.warn('Failed to load card image, creating text-based card');
          drawTextCard(ctx, cardData, cardType, CARD_WIDTH, CARD_HEIGHT);
          resolve();
        };
        image.src = imageUrl;
      });
    } else {
      // Create a text-based card
      drawTextCard(ctx, cardData, cardType, CARD_WIDTH, CARD_HEIGHT);
    }

    // Convert to blob with embedded metadata
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }

        try {
          // Embed the JSON data as PNG metadata
          const pngWithMetadata = await embedJSONInPNG(blob, exportData);
          resolve(pngWithMetadata);
        } catch (error) {
          reject(error);
        }
      }, 'image/png', 1.0);
    });
  } catch (error) {
    throw new Error(`Failed to create PNG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Draws a text-based card when no image is available
 */
const drawTextCard = (
  ctx: CanvasRenderingContext2D,
  cardData: ExportableCardData,
  cardType: string,
  width: number,
  height: number
): void => {
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1f2937');
  gradient.addColorStop(1, '#111827');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Card border
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 8; // Doubled from 4
  ctx.strokeRect(4, 4, width - 8, height - 8); // Doubled margins

  // Header section
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(0, 0, width, 160); // Doubled from 80

  // Card type indicator
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Arial'; // Doubled from 18px
  ctx.textAlign = 'center';
  const typeText = cardType.replace('_', ' ').toUpperCase();
  ctx.fillText(typeText, width / 2, 60); // Doubled from 30

  // Card name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial'; // Doubled from 32px
  ctx.textAlign = 'center';
  const name = cardData.name || 'Unnamed';
  const maxNameWidth = width - 80; // Doubled from 40
  const nameText = truncateText(ctx, name, maxNameWidth);
  ctx.fillText(nameText, width / 2, 260); // Doubled from 130

  // Description
  if ('description' in cardData && cardData.description) {
    ctx.fillStyle = '#d1d5db';
    ctx.font = '32px Arial'; // Doubled from 16px
    ctx.textAlign = 'left';
    
    const description = cardData.description;
    const maxDescWidth = width - 80; // Doubled from 40
    const lines = wrapText(ctx, description, maxDescWidth);
    
    let y = 360; // Doubled from 180
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      ctx.fillText(lines[i], 40, y); // Doubled from 20
      y += 48; // Doubled from 24
    }
    
    if (lines.length > 8) {
      ctx.fillText('...', 40, y); // Doubled from 20
    }
  }

  // Footer with creation info
  ctx.fillStyle = '#6b7280';
  ctx.font = '24px Arial'; // Doubled from 12px
  ctx.textAlign = 'center';
  ctx.fillText('Advanced Roleplay Engine', width / 2, height - 80); // Doubled from 40
  ctx.fillText(new Date().toLocaleDateString(), width / 2, height - 40); // Doubled from 20
};

/**
 * Wraps text to fit within specified width
 */
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
};

/**
 * Truncates text to fit within specified width
 */
const truncateText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  let truncated = text;
  let metrics = ctx.measureText(truncated);
  
  while (metrics.width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
    metrics = ctx.measureText(truncated + '...');
  }
  
  return truncated.length < text.length ? truncated + '...' : truncated;
};

/**
 * Embeds JSON data into PNG as a text chunk
 */
const embedJSONInPNG = async (pngBlob: Blob, data: PNGExportData): Promise<Blob> => {
  const arrayBuffer = await pngBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (uint8Array.length < 8 || 
      uint8Array[0] !== 0x89 || uint8Array[1] !== 0x50 || 
      uint8Array[2] !== 0x4E || uint8Array[3] !== 0x47) {
    throw new Error('Invalid PNG format');
  }

  // Find the end of IHDR chunk (first chunk after signature)
  let position = 8; // Skip PNG signature
  
  // Skip IHDR chunk
  const ihdrLength = new DataView(arrayBuffer, position).getUint32(0);
  position += 4 + 4 + ihdrLength + 4; // length + type + data + crc

  // Create JSON text chunk
  const jsonString = JSON.stringify(data);
  const jsonBytes = new TextEncoder().encode(jsonString);
  
  // Create tEXt chunk: keyword\0text
  const keyword = 'ARE_DATA'; // Advanced Roleplay Engine Data
  const keywordBytes = new TextEncoder().encode(keyword);
  const separator = new Uint8Array([0]); // null separator
  
  const chunkData = new Uint8Array(keywordBytes.length + 1 + jsonBytes.length);
  chunkData.set(keywordBytes, 0);
  chunkData.set(separator, keywordBytes.length);
  chunkData.set(jsonBytes, keywordBytes.length + 1);
  
  // Calculate CRC32 for the chunk
  const chunkType = new TextEncoder().encode('tEXt');
  const crcData = new Uint8Array(chunkType.length + chunkData.length);
  crcData.set(chunkType, 0);
  crcData.set(chunkData, chunkType.length);
  const crc = calculateCRC32(crcData);
  
  // Create the complete chunk
  const chunkLength = chunkData.length;
  const chunk = new Uint8Array(4 + 4 + chunkLength + 4);
  const dataView = new DataView(chunk.buffer);
  
  dataView.setUint32(0, chunkLength); // length
  chunk.set(chunkType, 4); // chunk type
  chunk.set(chunkData, 8); // chunk data
  dataView.setUint32(8 + chunkLength, crc); // CRC
  
  // Insert the chunk after IHDR
  const result = new Uint8Array(uint8Array.length + chunk.length);
  result.set(uint8Array.slice(0, position), 0);
  result.set(chunk, position);
  result.set(uint8Array.slice(position), position + chunk.length);
  
  return new Blob([result], { type: 'image/png' });
};

/**
 * Simple CRC32 implementation for PNG chunks
 */
const calculateCRC32 = (data: Uint8Array): number => {
  const crcTable = new Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

/**
 * Extracts JSON data from a PNG file and creates a complete import package
 */
export const extractJSONFromPNG = async (file: File): Promise<PNGExportData | null> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Verify PNG signature
    if (uint8Array.length < 8 || 
        uint8Array[0] !== 0x89 || uint8Array[1] !== 0x50 || 
        uint8Array[2] !== 0x4E || uint8Array[3] !== 0x47) {
      return null;
    }

    let position = 8; // Skip PNG signature
    
    // Read chunks until we find our tEXt chunk or reach the end
    while (position < uint8Array.length - 8) {
      const dataView = new DataView(arrayBuffer, position);
      const chunkLength = dataView.getUint32(0);
      
      if (position + 8 + chunkLength > uint8Array.length) {
        break;
      }
      
      const chunkType = new TextDecoder().decode(uint8Array.slice(position + 4, position + 8));
      
      if (chunkType === 'tEXt') {
        const chunkData = uint8Array.slice(position + 8, position + 8 + chunkLength);
        
        // Find the null separator
        const separatorIndex = chunkData.indexOf(0);
        if (separatorIndex !== -1) {
          const keyword = new TextDecoder().decode(chunkData.slice(0, separatorIndex));
          
          if (keyword === 'ARE_DATA') {
            const jsonString = new TextDecoder().decode(chunkData.slice(separatorIndex + 1));
            try {
              const data = JSON.parse(jsonString) as PNGExportData;
              
              // Create a blob from the original PNG file for use as the image
              const imageBlob = new Blob([arrayBuffer], { type: 'image/png' });
              
              // Return the complete package with both the data and the image
              return {
                ...data,
                imageFile: file,
                exportedImageBlob: imageBlob
              };
            } catch (error) {
              console.warn('Failed to parse JSON from PNG metadata:', error);
            }
          }
        }
      }
      
      // Move to next chunk
      position += 8 + chunkLength + 4; // length + type + data + crc
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting JSON from PNG:', error);
    return null;
  }
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

/**
 * Converts a Blob to a File with a given name
 */
export const blobToFile = (blob: Blob, fileName: string): File => {
  return new File([blob], fileName, { 
    type: blob.type, 
    lastModified: Date.now() 
  });
};

/**
 * Creates a File object from imported PNG data for use in form submissions
 */
export const createImageFileFromImport = (importData: PNGExportData, cardName: string): File | null => {
  if (!importData.imageFile && !importData.exportedImageBlob) {
    return null;
  }
  
  // Use the original file if available, otherwise create from blob
  if (importData.imageFile) {
    return importData.imageFile;
  }
  
  if (importData.exportedImageBlob) {
    const safeName = cardName.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 30);
    return blobToFile(importData.exportedImageBlob, `${safeName}_imported.png`);
  }
  
  return null;
};

/**
 * Generates a filename for the exported card
 */
export const generateExportFilename = (cardData: ExportableCardData, cardType: string): string => {
  const name = cardData.name || 'unnamed';
  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50);
  const timestamp = new Date().toISOString().split('T')[0];
  return `${cardType}_${safeName}_${timestamp}.png`;
};

/**
 * Fetches the MasterWorld data for a card if it has a master_world_id
 */
export const fetchMasterWorldForCard = async (cardData: ExportableCardData): Promise<MasterWorldData | undefined> => {
  // Import the API functions here to avoid circular dependencies
  const { getMasterWorldById } = await import('../services/api');
  
  const masterWorldId = cardData.master_world_id;
  if (!masterWorldId) return undefined;
  
  try {
    return await getMasterWorldById(masterWorldId);
  } catch (error) {
    console.warn('Failed to fetch MasterWorld for export:', error);
    return undefined;
  }
};

/**
 * Fetches the LoreEntries for a MasterWorld
 */
export const fetchLoreEntriesForMasterWorld = async (masterWorldId: string): Promise<LoreEntryData[]> => {
  // Import the API functions here to avoid circular dependencies
  const { getAllLoreEntriesForMasterWorld } = await import('../services/api');
  
  try {
    return await getAllLoreEntriesForMasterWorld(masterWorldId);
  } catch (error) {
    console.warn('Failed to fetch LoreEntries for export:', error);
    return [];
  }
};

/**
 * Prepares complete export data for a card including MasterWorld and LoreEntries
 */
export const prepareCompleteExportData = async (cardData: ExportableCardData): Promise<{
  masterWorld?: MasterWorldData;
  loreEntries?: LoreEntryData[];
}> => {
  const masterWorld = await fetchMasterWorldForCard(cardData);
  let loreEntries: LoreEntryData[] = [];
  
  if (masterWorld) {
    loreEntries = await fetchLoreEntriesForMasterWorld(masterWorld.id);
  }
  
  return { masterWorld, loreEntries };
};

/**
 * Creates or updates a MasterWorld from import data
 */
export const createOrUpdateMasterWorldFromImport = async (
  masterWorldData: MasterWorldData,
  forceCreate: boolean = false
): Promise<MasterWorldData> => {
  const { 
    getAllMasterWorlds, 
    createMasterWorld, 
    updateMasterWorld 
  } = await import('../services/api');
  
  if (!forceCreate) {
    // Check if MasterWorld already exists by name
    try {
      const existingWorlds = await getAllMasterWorlds();
      const existingWorld = existingWorlds.find(w => w.name === masterWorldData.name);
      
      if (existingWorld) {
        console.log(`MasterWorld "${masterWorldData.name}" already exists, using existing one.`);
        return existingWorld;
      }
    } catch (error) {
      console.warn('Error checking for existing MasterWorld:', error);
    }
  }
  
  // Create new MasterWorld
  try {
    const formData = new FormData();
    formData.append('name', masterWorldData.name);
    if (masterWorldData.description) {
      formData.append('description', masterWorldData.description);
    }
    if (masterWorldData.tags) {
      formData.append('tags', JSON.stringify(masterWorldData.tags));
    }
    
    return await createMasterWorld(formData);
  } catch (error) {
    console.error('Failed to create MasterWorld from import:', error);
    throw error;
  }
};

/**
 * Creates LoreEntries from import data
 */
export const createLoreEntriesFromImport = async (
  loreEntries: LoreEntryData[],
  masterWorldId: string
): Promise<void> => {
  const { createLoreEntryForMasterWorld } = await import('../services/api');
  
  for (const loreEntry of loreEntries) {
    try {
      const formData = new FormData();
      const loreData = {
        name: loreEntry.name,
        entry_type: loreEntry.entry_type,
        description: loreEntry.description || '',
        tags: loreEntry.tags || [],
        aliases: loreEntry.aliases || [],
        faction_id: loreEntry.faction_id,
        master_world_id: masterWorldId
      };
      
      formData.append('data', JSON.stringify(loreData));
      
      await createLoreEntryForMasterWorld(masterWorldId, formData);
      console.log(`Created LoreEntry: ${loreEntry.name}`);
    } catch (error) {
      console.warn(`Failed to create LoreEntry "${loreEntry.name}":`, error);
      // Continue with other entries even if one fails
    }
  }
};

/**
 * Handles complete import process for a card with MasterWorld and LoreEntries
 */
export const handleCompleteCardImport = async (
  importData: PNGExportData,
  importMasterWorld: boolean = true,
  importLoreEntries: boolean = true
): Promise<{
  masterWorld?: MasterWorldData;
  loreEntriesCreated: number;
}> => {
  let masterWorld: MasterWorldData | undefined;
  let loreEntriesCreated = 0;
  
  // Import MasterWorld if requested and available
  if (importMasterWorld && importData.masterWorld) {
    try {
      masterWorld = await createOrUpdateMasterWorldFromImport(importData.masterWorld);
      console.log(`MasterWorld imported: ${masterWorld.name}`);
    } catch (error) {
      console.error('Failed to import MasterWorld:', error);
    }
  }
  
  // Import LoreEntries if requested and available
  if (importLoreEntries && importData.loreEntries && masterWorld) {
    try {
      await createLoreEntriesFromImport(importData.loreEntries, masterWorld.id);
      loreEntriesCreated = importData.loreEntries.length;
      console.log(`${loreEntriesCreated} LoreEntries imported`);
    } catch (error) {
      console.error('Failed to import LoreEntries:', error);
    }
  }
  
  return { masterWorld, loreEntriesCreated };
};
