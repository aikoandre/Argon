import React from 'react';

const RightPanel: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  // Full height panel that takes entire width of its container
  return (
    <aside
      className="w-full h-full flex flex-col rounded-lg bg-app-surface border-4 border-app-border transition-all duration-300 ease-in-out overflow-hidden"
      style={{ 
        minHeight: 'calc(100vh - 80px)',
        maxHeight: 'calc(100vh - 60px)'
      }}
      data-testid="right-panel"
    >
      {/* Content container */}
      <div className="w-full h-full flex flex-col justify-start items-center overflow-hidden">
        {children || (
          <div className="flex flex-col items-center justify-center h-full text-center text-app-text-secondary">
            <span className="material-icons-outlined text-4xl mb-2 block opacity-50">
              style
            </span>
            <p className="text-sm">Select a Card</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default RightPanel;
