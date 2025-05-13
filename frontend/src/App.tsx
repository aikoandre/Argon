// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import PersonasPage from "./pages/PersonasPage";
import ChatsListPage from "./pages/ChatsListPage";
import NewChatPage from "./pages/NewChatPage";
import ChatPage from "./pages/ChatPage";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="bg-gray-900 text-gray-100 min-h-screen flex flex-col md:flex-row">
        {/* Sidebar */}
        <nav className="bg-gray-800 p-4 shadow-md w-full md:w-64 md:min-h-screen">
          {" "}
          {/* Ajustado para sidebar */}
          <div className="container mx-auto md:mx-0 md:flex md:flex-col space-y-4">
            {" "}
            {/* Ajustes para layout de sidebar */}
            <div className="text-2xl font-bold mb-6 text-center md:text-left">
              Argon
            </div>
            <Link
              to="/"
              className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
            >
              Home
            </Link>
            <Link
              to="/chats"
              className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
            >
              Chats
            </Link>{" "}
            {/* <<--- Link */}
            <Link
              to="/personas"
              className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors"
            >
              My Personas
            </Link>
            {/* Adicione links para Characters, Scenarios, WorldLore aqui */}
            <Link
              to="/settings"
              className="block py-2 px-3 rounded hover:bg-gray-700 hover:text-blue-400 transition-colors mt-auto"
            >
              Settings
            </Link>{" "}
            {/* mt-auto para empurrar para baixo */}
          </div>
        </nav>

        {/* Área de Conteúdo Principal */}
        <main className="flex-grow">
          {" "}
          {/* flex-grow para ocupar o resto do espaço */}
          {/* O padding pode ser aplicado aqui ou nas páginas individuais */}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/personas" element={<PersonasPage />} />
            <Route path="/chats" element={<ChatsListPage />} />{" "}
            {/* <<--- Rota */}
            <Route path="/new-chat" element={<NewChatPage />} />{" "}
            {/* <<--- Rota */}
            <Route path="/chat/:chatId" element={<ChatPage />} />{" "}
            {/* <<--- Rota */}
            {/* Adicione mais rotas aqui */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
