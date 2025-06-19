import React from 'react';

const LeftPanel: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  // Full height panel that takes entire width of its container
  return (
    <aside
      className="w-full h-full flex flex-col rounded-lg bg-app-surface border-4 border-app-border transition-all duration-300 ease-in-out"
      style={{ 
        minHeight: 'calc(100vh - 80px)',
        maxHeight: 'calc(100vh - 60px)'
      }}
      data-testid="left-panel"
    >
      {/* Content container now allows child to manage its own scrolling and layout */}
      <div className="w-full h-full">
        {children}
      </div>
    </aside>
  );
};

export default LeftPanel;
