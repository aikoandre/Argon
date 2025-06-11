import React, { createContext, useContext, useState, useCallback } from 'react';

interface LayoutState {
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  leftPanelContent: React.ReactNode;
  rightPanelContent: React.ReactNode;
}

interface LayoutContextType {
  layoutState: LayoutState;
  setLeftPanelVisible: (visible: boolean) => void;
  setRightPanelVisible: (visible: boolean) => void;
  setLeftPanelContent: (content: React.ReactNode) => void;
  setRightPanelContent: (content: React.ReactNode) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [layoutState, setLayoutState] = useState<LayoutState>({
    leftPanelVisible: false,
    rightPanelVisible: false,
    leftPanelContent: null,
    rightPanelContent: null,
  });

  const setLeftPanelVisible = useCallback((visible: boolean) => {
    setLayoutState(prev => ({ ...prev, leftPanelVisible: visible }));
  }, []);

  const setRightPanelVisible = useCallback((visible: boolean) => {
    setLayoutState(prev => ({ ...prev, rightPanelVisible: visible }));
  }, []);

  const setLeftPanelContent = useCallback((content: React.ReactNode) => {
    setLayoutState(prev => ({ 
      ...prev, 
      leftPanelContent: content
      // Don't automatically change visibility - let it be controlled manually
    }));
  }, []);

  const setRightPanelContent = useCallback((content: React.ReactNode) => {
    setLayoutState(prev => ({ 
      ...prev, 
      rightPanelContent: content
      // Don't automatically change visibility - let it be controlled manually
    }));
  }, []);

  const toggleLeftPanel = useCallback(() => {
    setLayoutState(prev => ({ 
      ...prev, 
      leftPanelVisible: !prev.leftPanelVisible 
    }));
  }, []);

  const toggleRightPanel = useCallback(() => {
    setLayoutState(prev => ({ 
      ...prev, 
      rightPanelVisible: !prev.rightPanelVisible 
    }));
  }, []);

  return (
    <LayoutContext.Provider
      value={{
        layoutState,
        setLeftPanelVisible,
        setRightPanelVisible,
        setLeftPanelContent,
        setRightPanelContent,
        toggleLeftPanel,
        toggleRightPanel,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};
