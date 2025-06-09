import React from 'react';

const CenterPanel: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <main className="flex-1 flex flex-col min-w-0 max-w-full overflow-auto" data-testid="center-panel">
      <div className="w-full max-w-2xl lg:max-w-3xl mx-auto px-4 py-6">
        {children}
      </div>
    </main>
  );
};

export default CenterPanel;
