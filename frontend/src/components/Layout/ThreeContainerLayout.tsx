import React from 'react';
import { useLayout } from '../../contexts/LayoutContext';
import LeftPanel from './LeftPanel.tsx';
import CenterPanel from './CenterPanel.tsx';
import RightPanel from './RightPanel.tsx';

interface ThreeContainerLayoutProps {
  children: React.ReactNode;
}

const ThreeContainerLayout: React.FC<ThreeContainerLayoutProps> = ({ children }) => {
  const { layoutState } = useLayout();

  return (
    <div className="flex w-full h-full min-h-screen bg-app-bg">
      {layoutState.leftPanelVisible && layoutState.leftPanelContent && (
        <LeftPanel>{layoutState.leftPanelContent}</LeftPanel>
      )}
      <CenterPanel>{children}</CenterPanel>
      {layoutState.rightPanelVisible && layoutState.rightPanelContent && (
        <RightPanel>{layoutState.rightPanelContent}</RightPanel>
      )}
    </div>
  );
};

export default ThreeContainerLayout;
