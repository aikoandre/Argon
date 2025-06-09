// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import ChatsListPage from "./pages/ChatsListPage";
import NewChatPage from "./pages/NewChatPage";
import ChatPage from "./pages/ChatPage";
import CharactersPage from "./pages/CharactersPage";
import ScenariosPageContext from "./pages/ScenariosPageContext";
import PersonasPageContext from "./pages/PersonasPageContext";
import MasterWorldPageContext from "./pages/MasterWorldPageContext";
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
  home: () => <MaterialIcon icon="home" />,
  chat: () => <MaterialIcon icon="chat" />,
  person: () => <MaterialIcon icon="person" />,
  view_list: () => <MaterialIcon icon="view_list" />,
  public: () => <MaterialIcon icon="public" />,
  groups: () => <MaterialIcon icon="groups" />,
  settings: () => <MaterialIcon icon="settings" />,
} as const;

function AppWrapper() {
  const location = useLocation();
  const { layoutState, toggleLeftPanel, toggleRightPanel } = useLayout();

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-white">
      {/* Combined Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-[56px] flex justify-center items-center z-50 mt-1">
        <div className="w-full max-w-2xl lg:max-w-3xl mx-4">
          {/* Navigation Header */}
          <div className="bg-app-surface shadow-lg rounded-2xl p-2 flex items-center justify-between">
            {/* Left Panel Toggle */}
            <button
              onClick={toggleLeftPanel}
              className={`px-2 rounded-full transition-colors hover:bg-app-surface/50 ${
                layoutState.leftPanelVisible ? 'text-app-text' : 'text-app-text-secondary'
              }`}
              title="Toggle Left Panel"
            >
              <MaterialIcon icon="side_navigation" />
            </button>

            {/* Central Navigation Icons */}
            <div className="flex items-center justify-center gap-1">
              <Link
                to="/"
                className={`px-2 rounded-full transition-colors ${
                  location.pathname === "/" ? "text-app-text" : "text-app-text-secondary"
                } hover:bg-app-surface/50`}
              >
                {navigationIcons.home()}
              </Link>
              <Link
                to="/chats"
                className={`px-2 rounded-full transition-colors ${
                  location.pathname.startsWith("/chat") ? "text-app-text" : "text-app-text-secondary"
                } hover:bg-app-surface/50`}
              >
                {navigationIcons.chat()}
              </Link>
              <Link
                to="/characters"
                className={`px-2 rounded-full transition-colors ${
                  location.pathname === "/characters" ? "text-app-text" : "text-app-text-secondary"
                } hover:bg-app-surface/50`}
              >
                {navigationIcons.person()}
              </Link>
              <Link
                to="/scenarios"
                className={`px-2 rounded-full transition-colors ${
                  location.pathname === "/scenarios" ? "text-app-text" : "text-app-text-secondary"
                } hover:bg-app-surface/50`}
              >
                {navigationIcons.view_list()}
              </Link>
              <Link
                to="/world-lore"
                className={`px-2 rounded-full transition-colors ${
                  location.pathname.startsWith("/world-lore") ? "text-app-text" : "text-app-text-secondary"
                } hover:bg-app-surface/50`}
                title="Master Worlds"
              >
                {navigationIcons.public()}
              </Link>
              <Link
                to="/personas"
                className={`px-2 rounded-full transition-colors ${
                  location.pathname === "/personas" ? "text-app-text" : "text-app-text-secondary"
                } hover:bg-app-surface/50`}
              >
                {navigationIcons.groups()}
              </Link>
              <Link
                to="/settings"
                className={`px-2 rounded-full transition-colors ${
                  location.pathname === "/settings" ? "text-app-text" : "text-app-text-secondary"
                } hover:bg-app-surface/50`}
              >
                {navigationIcons.settings()}
              </Link>
            </div>

            {/* Right Panel Toggle */}
            <button
              onClick={toggleRightPanel}
              className={`px-2 rounded-full transition-colors hover:bg-app-surface/50 ${
                layoutState.rightPanelVisible ? 'text-app-text' : 'text-app-text-secondary'
              }`}
              title="Toggle Right Panel"
            >
              <MaterialIcon icon="menu" />
            </button>
          </div>
        </div>
      </header>
      {/* Spacer to push content below fixed header */}
      <div className="h-[56px]"></div> {/* Match header height */}
      {/* Main Content Area - Full Width */}
      <main className="flex-grow overflow-hidden transition-all duration-300 ease-in-out flex flex-col">
        <ThreeContainerLayout>
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
