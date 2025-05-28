// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import PersonasPage from "./pages/PersonasPage";
import ChatsListPage from "./pages/ChatsListPage";
import NewChatPage from "./pages/NewChatPage";
import ChatPage from "./pages/ChatPage";
import CharactersPage from "./pages/CharactersPage";
import MasterWorldsPage from "./pages/MasterWorldsPage";
import LoreEntriesPage from "./pages/LoreEntriesPage";
import ScenariosPage from "./pages/ScenariosPage";
import "./App.css";
import "./styles/colors.css";
import "./styles/fonts.css";

function AppWrapper() {
  const location = useLocation();

  // Use Material Icons Outlined for no fill
  const iconBaseClass = "material-icons-outlined text-2xl flex-shrink-0";
  const HomeIcon = ({ className }: { className?: string }) => (
    <span className={`${iconBaseClass} ${className || ''}`.trim()}>home</span>
  );
  const ChatsIcon = ({ className }: { className?: string }) => (
    <span className={`${iconBaseClass} ${className || ''}`.trim()}>chat</span>
  );
  const PersonasIcon = ({ className }: { className?: string }) => (
    <span className={`${iconBaseClass} ${className || ''}`.trim()}>groups</span>
  );
  const CharactersIcon = ({ className }: { className?: string }) => (
    <span className={`${iconBaseClass} ${className || ''}`.trim()}>person</span>
  );
  const ScenariosIcon = ({ className }: { className?: string }) => (
    <span className={`${iconBaseClass} ${className || ''}`.trim()}>view_list</span>
  );
  const WorldsIcon = ({ className }: { className?: string }) => (
    <span className={`${iconBaseClass} ${className || ''}`.trim()}>public</span>
  );
  const SettingsIcon = ({ className }: { className?: string }) => (
    <span className={`${iconBaseClass} ${className || ''}`.trim()}>settings</span>
  );

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-white">
      {/* Combined Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-[56px] flex justify-center items-center z-50 mt-3">
        {/* Navigation Header */}
        <div className="bg-app-surface shadow-lg rounded-3xl p-3 flex items-center gap-x-4">
        <Link
          to="/"
          className={`px-2 rounded-full transition-colors ${
            location.pathname === "/" ? "text-app-accent" : "text-app-flat"
          } hover:bg-app-surface/50`}
        >
          <HomeIcon />
        </Link>
        <Link
          to="/chats"
          className={`px-2 rounded-full transition-colors ${
            location.pathname.startsWith("/chat") ? "text-app-accent" : "text-app-flat"
          } hover:bg-app-surface/50`}
        >
          <ChatsIcon />
        </Link>
        <Link
          to="/characters"
          className={`px-2 rounded-full transition-colors ${
            location.pathname === "/characters" ? "text-app-accent" : "text-app-flat"
          } hover:bg-app-surface/50`}
        >
          <CharactersIcon />
        </Link>
        <Link
          to="/scenarios"
          className={`px-2 rounded-full transition-colors ${
            location.pathname === "/scenarios" ? "text-app-accent" : "text-app-flat"
          } hover:bg-app-surface/50`}
        >
          <ScenariosIcon />
        </Link>
        <Link
          to="/world-lore"
          className={`px-2 rounded-full transition-colors ${
            location.pathname.startsWith("/world-lore") ? "text-app-accent" : "text-app-flat"
          } hover:bg-app-surface/50`}
        >
          <WorldsIcon />
        </Link>
        <Link
          to="/personas"
          className={`px-2 rounded-full transition-colors ${
            location.pathname === "/personas" ? "text-app-accent" : "text-app-flat"
          } hover:bg-app-surface/50`}
        >
          <PersonasIcon />
        </Link>
        <Link
          to="/settings"
          className={`px-2 rounded-full transition-colors ${
            location.pathname === "/settings" ? "text-app-accent" : "text-app-flat"
          } hover:bg-app-surface/50`}
        >
          <SettingsIcon />
        </Link>
        </div>
      </header>
      {/* Spacer to push content below fixed header */}
      <div className="h-[56px]"></div> {/* Match header height */}
      {/* Main Content Area */}
      <main className={`flex-grow overflow-hidden transition-all duration-300 ease-in-out flex flex-col ${location.pathname.startsWith('/chat/') ? '' : 'p-4 md:p-6'}`}>
        <div className="container mx-auto flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/chats" element={<ChatsListPage />} />
            <Route path="/new-chat" element={<NewChatPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
            <Route path="/personas" element={<PersonasPage />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/scenarios" element={<ScenariosPage />} />
            <Route path="/world-lore" element={<MasterWorldsPage />} />
            <Route
              path="/world-lore/:masterWorldId/entries"
              element={<LoreEntriesPage />}
            />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;
