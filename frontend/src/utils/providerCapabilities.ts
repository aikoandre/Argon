// frontend/src/utils/providerCapabilities.ts

export interface ProviderCapabilities {
  temperature: boolean;
  top_p: boolean;
  max_tokens: boolean;
  reasoning_effort: boolean;
  custom_prompt: boolean;
}

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  openrouter: {
    temperature: true,
    top_p: true,
    max_tokens: true,
    reasoning_effort: true,
    custom_prompt: true,
  },
  mistral: {
    temperature: true,
    top_p: true,
    max_tokens: true,
    reasoning_effort: true,
    custom_prompt: true,
  },
  google: {
    temperature: true,
    top_p: true,
    max_tokens: true,
    reasoning_effort: true,
    custom_prompt: true,
  },
};

export const getProviderCapabilities = (provider: string | null | undefined): ProviderCapabilities => {
  if (!provider) {
    return {
      temperature: false,
      top_p: false,
      max_tokens: false,
      reasoning_effort: false,
      custom_prompt: false,
    };
  }
  
  return PROVIDER_CAPABILITIES[provider] || {
    temperature: false,
    top_p: false,
    max_tokens: false,
    reasoning_effort: false,
    custom_prompt: false,
  };
};

export const getVisibleParameters = (provider: string | null | undefined) => {
  const capabilities = getProviderCapabilities(provider);
  
  return {
    showTemperature: capabilities.temperature,
    showTopP: capabilities.top_p,
    showMaxTokens: capabilities.max_tokens,
    showReasoningEffort: capabilities.reasoning_effort,
    showCustomPrompt: capabilities.custom_prompt,
  };
};