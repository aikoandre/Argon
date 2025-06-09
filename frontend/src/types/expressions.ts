// Standard expressions for character emotion system
export const STANDARD_EXPRESSIONS = [
  'admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring',
  'confusion', 'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust',
  'embarrassment', 'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love',
  'nervousness', 'neutral', 'optimism', 'pride', 'realization', 'relief',
  'remorse', 'sadness', 'surprise', 'thoughtful', 'determined'
] as const;

export type ExpressionType = typeof STANDARD_EXPRESSIONS[number];

export interface CharacterExpressions {
  characterId: string;
  expressions: Record<ExpressionType, string | null>; // file paths or URLs
  fallbackExpression: 'neutral'; // always required
  customExpressions?: Record<string, string>; // user-defined expressions
}

export interface ExpressionPackage {
  version: string;
  characterId: string;
  characterName: string;
  metadata: {
    created: string;
    author: string;
    description: string;
  };
  expressions: Record<ExpressionType, string>;
  customExpressions?: Record<string, string>;
}

export interface ExpressionState {
  currentExpression: ExpressionType;
  availableExpressions: ExpressionType[];
  isLoading: boolean;
  error: string | null;
}

// Expression fallback hierarchy: character → default → none
export const getExpressionUrl = (
  expressions: CharacterExpressions | null,
  expression: ExpressionType,
  defaultExpressions?: Record<ExpressionType, string>
): string | null => {
  // Try character-specific expression first
  if (expressions?.expressions[expression]) {
    return expressions.expressions[expression];
  }
  
  // Fall back to character's neutral expression
  if (expressions?.expressions.neutral) {
    return expressions.expressions.neutral;
  }
  
  // Fall back to default expression set
  if (defaultExpressions?.[expression]) {
    return defaultExpressions[expression];
  }
  
  // Fall back to default neutral
  if (defaultExpressions?.neutral) {
    return defaultExpressions.neutral;
  }
  
  // No expression available
  return null;
};

export const validateExpressionPackage = (data: any): ExpressionPackage | null => {
  try {
    if (!data.version || !data.characterId || !data.expressions) {
      return null;
    }
    
    // Validate that required expressions exist
    if (!data.expressions.neutral) {
      return null;
    }
    
    return data as ExpressionPackage;
  } catch {
    return null;
  }
};
