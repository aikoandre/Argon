import React from 'react';
import { useLayout } from '../../contexts/LayoutContext';
import LeftPanel from './LeftPanel.tsx';
import CenterPanel from './CenterPanel.tsx';
import RightPanel from './RightPanel.tsx';

interface ThreeContainerLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
}

const ThreeContainerLayout: React.FC<ThreeContainerLayoutProps> = ({ children, header }) => {
  const { layoutState } = useLayout();
  
  const leftVisible = layoutState.leftPanelVisible && layoutState.leftPanelContent;
  const rightVisible = layoutState.rightPanelVisible && layoutState.rightPanelContent;

  return (
    <div className="flex w-full min-h-screen bg-app-bg overflow-hidden">
      {/* Left Panel - Always present, fixed width */}
      <div className={`w-80 flex-shrink-0 m-px ${leftVisible ? 'visible' : 'invisible'}`}>
        <LeftPanel>{layoutState.leftPanelContent}</LeftPanel>
      </div>
      
      {/* Center Panel - Always present, wider fixed width */}
      <div className="w-[600px] flex-shrink-0 m-px">
        <CenterPanel header={header}>{children}</CenterPanel>
      </div>
      
      {/* Right Panel - Always present, fixed width */}
      <div className={`w-80 flex-shrink-0 m-px ${rightVisible ? 'visible' : 'invisible'}`}>
        <RightPanel>{layoutState.rightPanelContent}</RightPanel>
      </div>
    </div>
  );
};

export default ThreeContainerLayout;
