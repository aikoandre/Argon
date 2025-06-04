// frontend/src/components/ThinkingDropdown.tsx
import React, { useState } from 'react';
import { extractThinkingFromReasoningResponse } from '../utils/reasoningUtils';

interface ThinkingDropdownProps {
  /** The raw message content that may contain thinking tags */
  content: string;
  /** Optional class name for styling */
  className?: string;
}

const ThinkingDropdown: React.FC<ThinkingDropdownProps> = ({ 
  content, 
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Extract thinking content from the message
  const thinkingContent = extractThinkingFromReasoningResponse(content);
  
  // If there's no thinking content, don't render anything
  if (!thinkingContent) {
    return null;
  }

  return (
    <div className={`thinking-dropdown mb-3 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-300 hover:text-white transition-colors w-full text-left"
        aria-expanded={isExpanded}
        aria-controls="thinking-content"
      >
        <span className="material-icons text-lg">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
        <span className="font-medium">Show Thinking</span>
        <span className="ml-auto text-xs text-gray-500">
          {thinkingContent.length} chars
        </span>
      </button>
      
      {isExpanded && (
        <div 
          id="thinking-content"
          className="mt-2 p-4 bg-gray-900 border border-gray-600 rounded-lg"
        >
          <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
            Model Thinking Process
          </div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {thinkingContent}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingDropdown;
