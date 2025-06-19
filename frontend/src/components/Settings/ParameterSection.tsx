// frontend/src/components/Settings/ParameterSection.tsx
import React from "react";
import "./ParameterSection.css";

interface ParameterSectionProps {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  customPrompt?: string;
  onTemperatureChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
  onReasoningEffortChange: (value: string) => void;
  onCustomPromptChange: (value: string) => void;
  showTemperature?: boolean;
  showTopP?: boolean;
  showMaxTokens?: boolean;
  showReasoningEffort?: boolean;
  showCustomPrompt?: boolean;
  isLoading?: boolean;
}

const ParameterSection: React.FC<ParameterSectionProps> = ({
  temperature = 1.0,
  topP = 1.0,
  maxTokens,
  reasoningEffort = "Medium",
  customPrompt = "",
  onTemperatureChange,
  onTopPChange,
  onMaxTokensChange,
  onReasoningEffortChange,
  onCustomPromptChange,
  showTemperature = true,
  showTopP = true,
  showMaxTokens = true,
  showReasoningEffort = true,
  showCustomPrompt = true,
  isLoading = false,
}) => {
  const reasoningEffortOptions = [
    { value: "Low", label: "Low" },
    { value: "Medium", label: "Medium" },
    { value: "High", label: "High" },
  ];

  return (
    <div className="space-y-4 mt-4 p-4 border border-app-border rounded-lg bg-app-bg">
      <h4 className="text-sm font-medium text-app-text-2 mb-3">LLM Parameters</h4>
      
      {showTemperature && (
        <div>
          <label className="block text-sm font-medium text-app-text-2 mb-2">
            Temperature: {temperature}
          </label>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-app-text-secondary">0.0</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
              disabled={isLoading}
              className="flex-1 h-2 bg-app-border rounded-lg appearance-none cursor-pointer slider"
            />
            <span className="text-xs text-app-text-secondary">2.0</span>
          </div>
          <p className="text-xs text-app-text-secondary mt-1">
            Controls randomness: lower = more focused, higher = more creative
          </p>
        </div>
      )}

      {showTopP && (
        <div>
          <label className="block text-sm font-medium text-app-text mb-2">
            Top P: {topP}
          </label>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-app-text-secondary">0.0</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={topP}
              onChange={(e) => onTopPChange(parseFloat(e.target.value))}
              disabled={isLoading}
              className="flex-1 h-2 bg-app-border rounded-lg appearance-none cursor-pointer slider"
            />
            <span className="text-xs text-app-text-secondary">1.0</span>
          </div>
          <p className="text-xs text-app-text-secondary mt-1">
            Nucleus sampling: lower = more focused vocabulary
          </p>
        </div>
      )}

      {showMaxTokens && (
        <div>
          <label
            htmlFor="max_tokens_input"
            className="block text-sm font-medium text-app-text-2 mb-2"
          >
            Max Response Length (tokens)
          </label>
          <input
            type="number"
            id="max_tokens_input"
            min="1"
            value={maxTokens || ""}
            onChange={(e) => onMaxTokensChange(parseInt(e.target.value) || 0)}
            disabled={isLoading}
            placeholder="No limit"
            className="w-full p-2.5 bg-app-surface border border-app-border rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
          />
          <p className="text-xs text-gray-400 mt-1">
            Maximum length of AI response. Leave empty for no limit.
          </p>
        </div>
      )}

      {showReasoningEffort && (
        <div>
          <label
            htmlFor="reasoning_effort_select"
            className="block text-sm font-medium text-app-text-2 mb-2"
          >
            Reasoning Effort
          </label>
          <select
            id="reasoning_effort_select"
            value={reasoningEffort}
            onChange={(e) => onReasoningEffortChange(e.target.value)}
            disabled={isLoading}
            className="w-full p-2.5 bg-app-surface border border-app-border rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
          >
            {reasoningEffortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-app-text-secondary mt-1">
            Controls reasoning depth for supported models
          </p>
        </div>
      )}

      {showCustomPrompt && (
        <div>
          <label
            htmlFor="custom_prompt_textarea"
            className="block text-sm font-medium text-app-text mb-2"
          >
            Custom Prompt
          </label>
          <textarea
            id="custom_prompt_textarea"
            rows={3}
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            disabled={isLoading}
            placeholder="{{char}} must engage in a roleplay with {{user}}"
            className="w-full p-2.5 bg-app-surface border border-app-border rounded-md text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 resize-vertical"
          />
          <p className="text-xs text-app-text-secondary mt-1">
            Additional instructions appended to the main prompt. Leave empty for default behavior.
          </p>
        </div>
      )}
    </div>
  );
};

export default ParameterSection;