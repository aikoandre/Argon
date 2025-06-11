import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { useLayout } from '../../contexts/LayoutContext';
import LeftPanel from './LeftPanel.tsx';
import CenterPanel from './CenterPanel.tsx';
import RightPanel from './RightPanel.tsx';
import { ChatInput } from '../ChatInput';

interface ThreeContainerLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  onChatSendMessage?: (message: string) => void;
  chatInputDisabled?: boolean;
  chatInputSending?: boolean;
}

const ThreeContainerLayout: React.FC<ThreeContainerLayoutProps> = ({ 
  children, 
  header, 
  onChatSendMessage,
  chatInputDisabled = false,
  chatInputSending = false
}) => {
  const { layoutState, setLeftPanelVisible, setRightPanelVisible } = useLayout();
  const location = useLocation();
  
  const leftVisible = layoutState.leftPanelVisible;
  const rightVisible = layoutState.rightPanelVisible;

  // Check if current route is a chat page to remove padding
  const isChatPage = location.pathname.startsWith('/chat/');

  // Header height for spacing calculations
  const headerHeight = '56px'; // Based on h-[56px] from App.tsx
  
  // Consistent panel widths - Fixed to ensure perfect uniformity
  const mobilePanelWidth = 'w-80'; // 320px fixed
  const desktopPanelWidth = 'w-80'; // 320px fixed on all screen sizes

  return (
    <div className="relative flex flex-col w-full min-h-screen bg-app-bg overflow-hidden">
      {/* Main layout container */}
      <div className="flex-1 flex w-full overflow-hidden">
        {/* Mobile/Small Screen Layout - Overlays */}
        <div className="block lg:hidden w-full relative">
          {/* Center Panel - Fixed, always visible */}
          <div className="w-full h-full">
            <CenterPanel header={header} noPadding={isChatPage}>{children}</CenterPanel>
          </div>

          {/* Left Panel Overlay - Animated from left */}
          <AnimatePresence>
            {leftVisible && (
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ 
                  type: 'spring', 
                  stiffness: 300, 
                  damping: 30,
                  duration: 0.3 
                }}
                className={`absolute top-0 left-0 ${mobilePanelWidth} h-full z-20`}
                style={{ marginTop: headerHeight }}
              >
                <LeftPanel>{layoutState.leftPanelContent}</LeftPanel>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right Panel Overlay - Animated from right */}
          <AnimatePresence>
            {rightVisible && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ 
                  type: 'spring', 
                  stiffness: 300, 
                  damping: 30,
                  duration: 0.3 
                }}
                className={`absolute top-0 right-0 ${mobilePanelWidth} h-full z-20`}
                style={{ marginTop: headerHeight }}
              >
                <RightPanel>{layoutState.rightPanelContent}</RightPanel>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Backdrop for overlays */}
          <AnimatePresence>
            {(leftVisible || rightVisible) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black bg-opacity-50 z-10"
                style={{ marginTop: headerHeight }}
                onClick={() => {
                  // Close panels when backdrop is clicked
                  if (leftVisible) setLeftPanelVisible(false);
                  if (rightVisible) setRightPanelVisible(false);
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Desktop/Large Screen Layout - Side by side */}
        <div className="hidden lg:flex w-full">
          {/* Left Panel - Fixed width */}
          <AnimatePresence>
            {leftVisible && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }} // Fixed 320px width
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={`${desktopPanelWidth} flex-shrink-0 m-px`}
              >
                <LeftPanel>{layoutState.leftPanelContent}</LeftPanel>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Center Panel - Flexible width, always largest */}
          <div className="flex-1 min-w-0">
            <CenterPanel header={header} noPadding={isChatPage}>{children}</CenterPanel>
          </div>
          
          {/* Right Panel - Fixed width */}
          <AnimatePresence>
            {rightVisible && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }} // Fixed 320px width
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={`${desktopPanelWidth} flex-shrink-0 m-px`}
              >
                <RightPanel>{layoutState.rightPanelContent}</RightPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chat Input - Always visible but only functional on chat pages */}
      <div className="flex-shrink-0 w-full">
        <div className="hidden lg:block">
          {/* Desktop: Align with center panel width */}
          <div className="flex w-full">
            {leftVisible && <div className="w-80 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <ChatInput 
                onSendMessage={onChatSendMessage}
                disabled={chatInputDisabled}
                isSending={chatInputSending}
              />
            </div>
            {rightVisible && <div className="w-80 flex-shrink-0" />}
          </div>
        </div>
        <div className="block lg:hidden">
          {/* Mobile: Full width */}
          <ChatInput 
            onSendMessage={onChatSendMessage}
            disabled={chatInputDisabled}
            isSending={chatInputSending}
          />
        </div>
      </div>
    </div>
  );
};

export default ThreeContainerLayout;
