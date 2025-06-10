import React from 'react';

interface CenterPanelProps {
  children?: React.ReactNode;
  header?: React.ReactNode;
}

const CenterPanel: React.FC<CenterPanelProps> = ({ children, header }) => {
  return (
    <main className="w-full h-full flex flex-col min-w-0 overflow-hidden rounded-lg bg-app-surface border-4 border-app-border" data-testid="center-panel">
      {header && (
        <div className="w-full px-6 flex-shrink-0">
          <div className="w-full max-w-full">
            {header}
          </div>
        </div>
      )}
      <div className="flex-1 w-full py-4 overflow-auto">
        <div className="w-full px-6">
          {children}
        </div>
      </div>
    </main>
  );
};

export default CenterPanel;
