// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import ChatsListPage from "./pages/ChatsListPage";
import NewChatPage from "./pages/NewChatPage";
import ChatPage from "./pages/ChatPage";
import CharactersPage from "./pages/CharactersPage";
import ScenariosPageContext from "./pages/ScenariosPage";
import PersonasPageContext from "./pages/PersonasPage";
import MasterWorldPageContext from "./pages/MasterWorldPage";
import { ThreeContainerLayout, HeaderNavigationBar } from './components/Layout';
import { LayoutProvider, useLayout } from './contexts/LayoutContext';
import { ChatInputProvider } from './contexts/ChatInputContext';
import { ActiveCardProvider } from './contexts/ActiveCardContext';

function AppWrapper() {
  const { layoutState, toggleLeftPanel, toggleRightPanel } = useLayout();

  const headerContent = (
    <HeaderNavigationBar
      onToggleLeftPanel={toggleLeftPanel}
      onToggleRightPanel={toggleRightPanel}
      leftPanelVisible={layoutState.leftPanelVisible}
      rightPanelVisible={layoutState.rightPanelVisible}
    />
  );

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-white">
      {/* Main Content Area - Full Width */}
      <main className="flex-grow overflow-hidden transition-all duration-300 ease-in-out flex flex-col">
        <ThreeContainerLayout 
          header={headerContent}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/chats" element={<ChatsListPage />} />
            <Route path="/new-chat" element={<NewChatPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
            <Route path="/personas" element={<PersonasPageContext />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/scenarios" element={<ScenariosPageContext />} />
            <Route path="/world-lore" element={<MasterWorldPageContext />} />
            <Route path="/world-lore/entries" element={<MasterWorldPageContext />} />
            <Route path="/world-lore/:masterWorldId/entries" element={<MasterWorldPageContext />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </ThreeContainerLayout>
      </main>
    </div>
  );
}

const App = () => (
  <Router>
    <LayoutProvider>
      <ChatInputProvider>
        <ActiveCardProvider>
          <AppWrapper />
        </ActiveCardProvider>
      </ChatInputProvider>
    </LayoutProvider>
  </Router>
);

export default App;
