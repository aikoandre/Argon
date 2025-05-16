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
import { 
  HouseDoorFill, 
  ChatDotsFill, 
  PeopleFill, 
  PersonBadgeFill, 
  CollectionFill, 
  Globe2, 
  GearFill 
} from 'react-bootstrap-icons';

function AppWrapper() {
  const location = useLocation();

  // Bootstrap icon components
  const HomeIcon = () => <HouseDoorFill className="w-5 h-5 mr-3 inline-block align-middle" />;
  const ChatsIcon = () => <ChatDotsFill className="w-5 h-5 mr-3 inline-block align-middle" />;
  const PersonasIcon = () => <PeopleFill className="w-5 h-5 mr-3 inline-block align-middle" />;
  const CharactersIcon = () => <PersonBadgeFill className="w-5 h-5 mr-3 inline-block align-middle" />;
  const ScenariosIcon = () => <CollectionFill className="w-5 h-5 mr-3 inline-block align-middle" />;
  const WorldsIcon = () => <Globe2 className="w-5 h-5 mr-3 inline-block align-middle" />;
  const SettingsIcon = () => <GearFill className="w-5 h-5 mr-3 inline-block align-middle" />;

  return (
    <div className="min-h-screen flex flex-col md:flex-row p-6 gap-4 bg-app-bg text-app-accent">
      {/* Sidebar */}
      <nav className="bg-app-surface p-6 shadow-lg flex-shrink-0 w-full md:w-64 flex flex-col overflow-y-auto rounded-2xl backdrop-blur-sm" 
           style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        <div className="flex flex-col space-y-3 w-full">
          <div className="text-3xl px-3 font-bold mb-6 text-center font-quintessential">
            Argon
          </div>
          <Link
            to="/"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center"
          >
            <HomeIcon /> Home
          </Link>
          <Link
            to="/chats"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center"
          >
            <ChatsIcon /> Chats
          </Link>
          <Link
            to="/personas"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center"
          >
            <PersonasIcon /> Personas
          </Link>
          <Link
            to="/characters"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center"
          >
            <CharactersIcon /> Characters
          </Link>
          <Link
            to="/scenarios"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center"
          >
            <ScenariosIcon /> Scenarios
          </Link>
          <Link
            to="/world-lore"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center"
          >
            <WorldsIcon /> Worlds
          </Link>
          <Link
            to="/settings"
            className="text-xl font-montserrat block py-2 px-3 rounded transition-colors hover:bg-app-surface/50 flex items-center"
          >
            <SettingsIcon /> Settings
          </Link>
        </div>
      </nav>
      {/* Main Content Area */}
      <main className={`flex-grow ${location.pathname.startsWith('/chat/') ? '' : 'p-4 md:p-6'}`}>
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
