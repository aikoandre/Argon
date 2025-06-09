import React from 'react';

const LeftPanel: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  // Fixed aspect ratio, hidden if no image/expressions
  return (
    <aside
      className="hidden md:flex flex-col items-center justify-start bg-app-panel border-r border-app-border min-w-[240px] max-w-[320px] aspect-[3/4.5] overflow-hidden"
      style={{ minWidth: 240, maxWidth: 320 }}
      data-testid="left-panel"
    >
      {children}
    </aside>
  );
};

export default LeftPanel;
