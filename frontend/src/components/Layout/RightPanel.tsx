import React from 'react';

const RightPanel: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  // Fixed aspect ratio, slides in/out, persistent
  return (
    <aside
      className="hidden md:flex flex-col items-center justify-start bg-app-panel border-l border-app-border min-w-[240px] max-w-[320px] aspect-[3/4.5] overflow-hidden"
      style={{ minWidth: 240, maxWidth: 320 }}
      data-testid="right-panel"
    >
      {children}
    </aside>
  );
};

export default RightPanel;
