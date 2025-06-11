import React from 'react';

interface CenterPanelProps {
  children?: React.ReactNode;
  header?: React.ReactNode;
  noPadding?: boolean;
}

const CenterPanel: React.FC<CenterPanelProps> = ({ children, header, noPadding = false }) => {
  return (
    <main className="w-full h-full flex flex-col min-w-0 overflow-hidden rounded-lg bg-app-surface border-4 border-app-border" data-testid="center-panel">
      {header && (
        <div className="w-full flex-shrink-0">
          {header}
        </div>
      )}
      <div className={`flex-1 w-full overflow-auto ${noPadding ? '' : 'py-4'}`}>
        <div className={`w-full ${noPadding ? '' : 'px-6'}`}>
          {children}
        </div>
      </div>
    </main>
  );
};

export default CenterPanel;
