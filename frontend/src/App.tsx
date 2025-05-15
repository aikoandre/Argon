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

function AppWrapper() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <nav className="bg-gray-800 p-4 shadow-md flex-shrink-0 w-full md:w-64">
        <div className="flex flex-col space-y-2">
          <div className="text-3xl px-3 font-bold mb-6 text-center quintessential-regular">
            Argon
          </div>
          <Link
            to="/"
            className="text-xl montserrat block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
          >
            Home
          </Link>
          <Link
            to="/chats"
            className="text-xl montserrat block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
          >
            Chats
          </Link>
          <Link
            to="/personas"
            className="text-xl montserrat block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
          >
            Personas
          </Link>
          <Link
            to="/characters"
            className="text-xl montserrat block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
          >
            Characters
          </Link>
          <Link
            to="/scenarios"
            className="text-xl montserrat block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
          >
            Scenarios
          </Link>{" "}
          <Link
            to="/world-lore"
            className="text-xl montserrat block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
          >
            Worlds
          </Link>{" "}
          <Link
            to="/settings"
            className="text-xl montserrat block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
          >
            Settings
          </Link>
        </div>
      </nav>{" "}
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
