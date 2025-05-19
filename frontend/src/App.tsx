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
    <div className="min-h-screen flex flex-col md:flex-row p-6 bg-app-bg text-white">
      {/* Sidebar Container */}
      <div
        className="relative flex-shrink-0 w-[250px]"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* Sidebar Content */}
        <div className="bg-app-surface shadow-lg rounded-2xl backdrop-blur-sm h-full overflow-y-auto p-6">
          <nav className="flex flex-col h-full">
            <div className="flex flex-col w-full gap-y-3 pt-6">
              <div className="text-3xl px-3 font-bold mb-3 text-center font-quintessential">
                Argon
              </div>
          <Link
            to="/"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center ml-6"
          >
            <HomeIcon className="mr-3" />
            <span>Home</span>
          </Link>
          <Link
            to="/chats"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center ml-6"
          >
            <ChatsIcon className="mr-3" />
            <span>Chats</span>
          </Link>
          <Link
            to="/personas"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center ml-6"
          >
            <PersonasIcon className="mr-3" />
            <span>Personas</span>
          </Link>
          <Link
            to="/characters"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center ml-6"
          >
            <CharactersIcon className="mr-3" />
            <span>Characters</span>
          </Link>
          <Link
            to="/scenarios"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center ml-6"
          >
            <ScenariosIcon className="mr-3" />
            <span>Scenarios</span>
          </Link>
          <Link
            to="/world-lore"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center ml-6"
          >
            <WorldsIcon className="mr-3" />
            <span>Worlds</span>
          </Link>
          <Link
            to="/settings"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center ml-6"
          >
            <SettingsIcon className="mr-3" />
            <span>Settings</span>
          </Link>
            </div>
          </nav>
        </div>

      </div>
      {/* Main Content Area */}
      <main className={`flex-grow overflow-hidden transition-all duration-300 ease-in-out md:ml-4 ${location.pathname.startsWith('/chat/') ? '' : 'p-4 md:p-6'}`}>
        <div className="container mx-auto">
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
