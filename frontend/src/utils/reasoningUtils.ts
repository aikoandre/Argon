// frontend/src/utils/reasoningUtils.ts
/**
 * Utility functions for reasoning model detection on the frontend.
 * Mirrors the backend reasoning_utils.py functionality.
 */

/**
 * Check if a model supports reasoning/thinking capabilities.
 * 
 * @param model - The model name/identifier
 * @returns boolean - True if the model supports reasoning capabilities
 */
export function isReasoningCapableModel(model: string): boolean {
  if (!model) {
    return false;
  }

  const reasoningModels = [
    // OpenAI o-series models
    'openai/o1-preview',
    'openai/o1-mini', 
    'openai/o1',
    // Grok models
    'x-ai/grok-beta',
    'x-ai/grok-2-1212',
    // DeepSeek models
    'deepseek/deepseek-r1',
  ];

  // Check for exact matches
  if (reasoningModels.includes(model.toLowerCase())) {
    return true;
  }

  // Check for patterns that indicate reasoning capability
  const modelLower = model.toLowerCase();
  return (
    modelLower.includes('o1') ||
    modelLower.includes('grok') ||
    modelLower.includes('reasoning') ||
    modelLower.includes('deepseek-r1')
  );
}

/**
 * Extract actual content from reasoning model responses.
 * 
 * Reasoning models like DeepSeek R1 wrap their thinking process in <thinking> tags
 * and provide the actual response after. This function extracts the useful content.
 * 
 * @param content - The raw response content from the reasoning model
 * @param model - Optional model name for model-specific processing
 * @returns string - The extracted content without thinking tags
 */
export function extractContentFromReasoningResponse(content: string): string {
  if (!content || typeof content !== 'string') {
    return content || '';
  }

  // For DeepSeek R1 and similar reasoning models, extract content after </thinking>
  const thinkingPattern = /<thinking>.*?<\/thinking>\s*/gs;
  let cleanedContent = content.replace(thinkingPattern, '');

  // Remove any remaining thinking markers
  cleanedContent = cleanedContent.replace(/<\/?thinking>/g, '');

  // Clean up extra whitespace
  cleanedContent = cleanedContent.trim();

  // If the cleaned content is empty or very short, return the original content
  // This handles cases where the thinking tags might not be properly formatted
  if (cleanedContent.length < 10 && content.length > cleanedContent.length) {
    return content.trim();
  }

  return cleanedContent;
}

/**
 * Extract thinking content from reasoning model responses.
 * 
 * @param content - The raw response content from the reasoning model
 * @returns string - The extracted thinking content, or empty string if none found
 */
export function extractThinkingFromReasoningResponse(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Extract content within thinking tags
  const thinkingMatch = content.match(/<thinking>(.*?)<\/thinking>/s);
  if (thinkingMatch && thinkingMatch[1]) {
    return thinkingMatch[1].trim();
  }

  return '';
}

/**
 * Check if the content contains reasoning response format.
 * 
 * @param content - The response content to check
 * @returns boolean - True if the content appears to be from a reasoning model
 */
export function isReasoningResponseFormat(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Check for thinking tags
  return /<thinking>.*?<\/thinking>/s.test(content);
}
