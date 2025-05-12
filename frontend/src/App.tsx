// frontend-react/src/App.tsx
import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { fetchTestData } from "./apiService"; // Importa a função da API

function App() {
  const [count, setCount] = useState(0);
  // Estado para armazenar a mensagem vinda do backend
  const [backendMessage, setBackendMessage] = useState<string>(
    "Carregando mensagem do backend..."
  );

  // useEffect para chamar a API quando o componente montar
  useEffect(() => {
    fetchTestData()
      .then((data) => {
        // Assume que a API retorna { message: "Alguma coisa" }
        setBackendMessage(
          data.message || "Mensagem recebida, mas formato inesperado."
        );
      })
      .catch((error) => {
        console.error("Falha ao buscar dados do backend:", error);
        setBackendMessage(
          "Falha ao conectar com o backend. Verifique o console."
        );
      });
  }, []); // Array vazio significa que roda apenas uma vez na montagem

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React + ARE</h1>
      {/* Exibe a mensagem do backend */}
      <p>
        <strong>Mensagem do Backend:</strong> {backendMessage}
      </p>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
