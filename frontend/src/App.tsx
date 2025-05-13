// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import PersonasPage from "./pages/PersonasPage";
import "./App.css"; // Você pode criar/estilizar este arquivo

function App() {
  return (
    <Router>
      {/* Exemplo de um layout básico com Tailwind para tema escuro */}
      <div className="bg-gray-900 text-gray-100 min-h-screen">
        <nav className="bg-gray-800 p-4 shadow-md">
          <div className="container mx-auto flex space-x-6">
            <Link
              to="/"
              className="text-lg font-semibold hover:text-blue-400 transition-colors"
            >
              Home
            </Link>
            <Link
              to="/personas"
              className="text-lg font-semibold hover:text-blue-400 transition-colors"
            >
              My Personas
            </Link>{" "}
            {/* <<--- Link */}
            {/* Adicione links para Characters, World, Scenarios, Chat aqui */}
            <Link
              to="/settings"
              className="text-lg font-semibold hover:text-blue-400 transition-colors"
            >
              Settings
            </Link>
          </div>
        </nav>

        <main className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/personas" element={<PersonasPage />} />{" "}
            {/* Adicione mais rotas aqui */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
