// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import ChatsListPage from "./pages/ChatsListPage";
import NewChatPage from "./pages/NewChatPage";
import ChatPage from "./pages/ChatPage";
import CharactersPage from "./pages/CharactersPage";
import ScenariosPageContext from "./pages/ScenariosPage";
import PersonasPageContext from "./pages/PersonasPage";
import MasterWorldPageContext from "./pages/MasterWorldPage";
import { ThreeContainerLayout } from './components/Layout';
import { LayoutProvider, useLayout } from './contexts/LayoutContext';

// Modern Material Icons component using TailwindCSS
const MaterialIcon = ({ icon, className = "" }: { icon: string; className?: string }) => (
  <span className={`material-icons-outlined text-2xl flex-shrink-0 ${className}`}>
    {icon}
  </span>
);

// Navigation icon components
const navigationIcons = {
  leftPanel: () => <MaterialIcon icon="view_sidebar" />,
  home: () => <MaterialIcon icon="home" />,
  chat: () => <MaterialIcon icon="chat" />,
  person: () => <MaterialIcon icon="person" />,
  view_list: () => <MaterialIcon icon="view_list" />,
  public: () => <MaterialIcon icon="public" />,
  groups: () => <MaterialIcon icon="groups" />,
  settings: () => <MaterialIcon icon="settings" />,
  rightPanel: () => <MaterialIcon icon="menu" />,
} as const;

function AppWrapper() {
  const location = useLocation();
  const { layoutState, toggleLeftPanel, toggleRightPanel } = useLayout();

  const iconButtonClass = "w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-app-surface/50";

  const headerContent = (
    <header className="h-[56px] flex justify-center items-center pt-1">
      <div className="w-full">
        {/* Navigation Header */}
        <div className="bg-app-bg shadow-lg rounded-lg border-4 border-app-bg">
          {/* Header Layout: All icons with equal spacing */}
          <div className="flex items-center justify-center w-full gap-x-4">
            {/* Left Panel Toggle */}
            <button
              onClick={toggleLeftPanel}
              className={`${iconButtonClass} ${layoutState.leftPanelVisible ? 'text-app-text' : 'text-app-text-secondary'}`}
              title="Toggle Left Panel"
            >
              {navigationIcons.leftPanel()}
            </button>

            {/* Navigation Icons */}
            <Link
              to="/"
              className={`${iconButtonClass} ${
                location.pathname === "/" ? "text-app-text" : "text-app-text-secondary"
              }`}
            >
              {navigationIcons.home()}
            </Link>
            <Link
              to="/chats"
              className={`${iconButtonClass} ${
                location.pathname.startsWith("/chat") ? "text-app-text" : "text-app-text-secondary"
              }`}
            >
              {navigationIcons.chat()}
            </Link>
            <Link
              to="/characters"
              className={`${iconButtonClass} ${
                location.pathname === "/characters" ? "text-app-text" : "text-app-text-secondary"
              }`}
            >
              {navigationIcons.person()}
            </Link>
            <Link
              to="/scenarios"
              className={`${iconButtonClass} ${
                location.pathname === "/scenarios" ? "text-app-text" : "text-app-text-secondary"
              }`}
            >
              {navigationIcons.view_list()}
            </Link>
            <Link
              to="/world-lore"
              className={`${iconButtonClass} ${
                location.pathname.startsWith("/world-lore") ? "text-app-text" : "text-app-text-secondary"
              }`}
              title="Master Worlds"
            >
              {navigationIcons.public()}
            </Link>
            <Link
              to="/personas"
              className={`${iconButtonClass} ${
                location.pathname === "/personas" ? "text-app-text" : "text-app-text-secondary"
              }`}
            >
              {navigationIcons.groups()}
            </Link>
            <Link
              to="/settings"
              className={`${iconButtonClass} ${
                location.pathname === "/settings" ? "text-app-text" : "text-app-text-secondary"
              }`}
            >
              {navigationIcons.settings()}
            </Link>

            {/* Right Panel Toggle */}
            <button
              onClick={toggleRightPanel}
              className={`${iconButtonClass} ${layoutState.rightPanelVisible ? 'text-app-text' : 'text-app-text-secondary'}`}
              title="Toggle Right Panel"
            >
              {navigationIcons.rightPanel()}
            </button>
          </div>
        </div>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-white">
      {/* Main Content Area - Full Width */}
      <main className="flex-grow overflow-hidden transition-all duration-300 ease-in-out flex flex-col">
        <ThreeContainerLayout header={headerContent}>
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
      <AppWrapper />
    </LayoutProvider>
  </Router>
);

export default App;
