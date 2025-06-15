// frontend/src/components/PlaceholderHelp/PlaceholderHelp.tsx

import React, { useState } from 'react';

interface PlaceholderHelpProps {
  className?: string;
}

const PlaceholderHelp: React.FC<PlaceholderHelpProps> = ({ className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        className="text-app-text-2 hover:text-app-text transition-colors p-1 rounded-full"
        title="Placeholder Help"
      >
        <span className="material-icons-outlined text-sm">help_outline</span>
      </button>
      
      {isVisible && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-app-surface border border-app-border rounded-lg shadow-lg p-3 z-50">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-sm text-app-text">Placeholder Guide</h4>
            <button
              onClick={() => setIsVisible(false)}
              className="text-app-text-2 hover:text-app-text"
            >
              <span className="material-icons-outlined text-xs">close</span>
            </button>
          </div>
          
          <div className="text-xs text-app-text-2 space-y-2">
            <div>
              <strong>{'{{char}}'}</strong> - Replaced with character/scenario name
            </div>
            <div>
              <strong>{'{{user}}'}</strong> - Replaced with user persona name
            </div>
            <div className="pt-1 border-t border-app-border">
              <strong>Examples:</strong>
            </div>
            <div className="bg-app-bg p-2 rounded text-xs">
              "Hello {'{{char}}'}, I'm {'{{user}}'}"<br/>
              → "Hello Alice, I'm John"
            </div>
            <div className="text-xs text-app-text-2">
              Use these in character descriptions, instructions, beginning messages, and chat messages!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaceholderHelp;
