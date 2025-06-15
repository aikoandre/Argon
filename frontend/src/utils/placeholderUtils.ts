// frontend/src/utils/placeholderUtils.ts

/**
 * Utility functions for handling {{char}} and {{user}} placeholders
 */

/**
 * Replace placeholders with actual names for display
 */
export function replacePlaceholdersForDisplay(
  text: string, 
  charName: string = "AI", 
  userName: string = "User"
): string {
  return text
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName);
}

/**
 * Replace actual names with placeholders for editing
 */
export function replaceNamesWithPlaceholders(
  text: string, 
  charName: string = "AI", 
  userName: string = "User"
): string {
  // Use word boundaries to ensure we only replace complete words
  // and escape special regex characters in names
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  const charPattern = new RegExp(`\\b${escapeRegex(charName)}\\b`, 'gi');
  const userPattern = new RegExp(`\\b${escapeRegex(userName)}\\b`, 'gi');
  
  return text
    .replace(charPattern, '{{char}}')
    .replace(userPattern, '{{user}}');
}

/**
 * Check if text contains placeholders
 */
export function containsPlaceholders(text: string): boolean {
  return /\{\{(char|user)\}\}/i.test(text);
}

/**
 * Get character name from session details or cache
 */
export function getCharacterName(sessionDetails: any): string {
  if (!sessionDetails) return "AI";
  
  if (sessionDetails.card_type === 'character' && sessionDetails.card_id) {
    const cachedName = (window as any).__characterCardNameCache?.[sessionDetails.card_id];
    return cachedName || "AI";
  } else if (sessionDetails.card_type === 'scenario' && sessionDetails.card_id) {
    const cachedName = (window as any).__scenarioCardNameCache?.[sessionDetails.card_id];
    return cachedName || "AI";
  }
  
  return "AI";
}

/**
 * Extract all placeholder references from text
 */
export function extractPlaceholders(text: string): { chars: string[], users: string[] } {
  const charMatches = text.match(/\{\{char\}\}/gi) || [];
  const userMatches = text.match(/\{\{user\}\}/gi) || [];
  
  return {
    chars: charMatches,
    users: userMatches
  };
}

/**
 * Validate that text is safe to process for placeholders
 */
export function isValidPlaceholderText(text: string): boolean {
  // Check for malformed placeholders
  const malformedPattern = /\{[^}]*\{|\}[^{]*\}/;
  return !malformedPattern.test(text);
}

/**
 * Get placeholder statistics for content analysis
 */
export function getPlaceholderStats(text: string): {
  charCount: number;
  userCount: number;
  totalPlaceholders: number;
  hasPlaceholders: boolean;
} {
  const charMatches = (text.match(/\{\{char\}\}/gi) || []).length;
  const userMatches = (text.match(/\{\{user\}\}/gi) || []).length;
  
  return {
    charCount: charMatches,
    userCount: userMatches,
    totalPlaceholders: charMatches + userMatches,
    hasPlaceholders: charMatches > 0 || userMatches > 0
  };
}

/**
 * Preview how text would look with placeholders replaced
 */
export function previewPlaceholderReplacement(
  text: string,
  charName?: string,
  userName?: string
): {
  original: string;
  preview: string;
  hasChanges: boolean;
} {
  const preview = replacePlaceholdersForDisplay(text, charName, userName);
  return {
    original: text,
    preview,
    hasChanges: text !== preview
  };
}
