import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import React from "react";

function App() {
  const [backendMessage, setBackendMessage] = useState("");
  const [userInput, setUserInput] = useState("");
  const [chatResponse, setChatResponse] = useState("");

  // Teste para a rota raiz do backend
  useEffect(() => {
    fetch("http://localhost:8000/") // URL do seu backend FastAPI
      .then((response) => response.json())
      .then((data) => setBackendMessage(data.message))
      .catch((error) => console.error("Erro ao buscar no backend:", error));
  }, []);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: "test-chat-001",
          user_input: userInput,
        }),
      });
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      setChatResponse(data.ia_response);
      setUserInput(""); // Limpa o input
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      setChatResponse(`Erro ao comunicar com a IA: ${error}`);
    }
  };

  return (
    <div className="App">
      <h1>Meu App de Roleplay</h1>
      <p>Mensagem do Backend: {backendMessage}</p>
      <div>
        <input
          type="text"
          value={userInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setUserInput(e.target.value)
          } // Tipagem explícita do evento
          placeholder="Digite sua mensagem..."
        />
        <button onClick={handleSendMessage}>Enviar</button>
      </div>
      {chatResponse && (
        <div>
          <h3>Resposta da IA:</h3>
          <p>{chatResponse}</p>
        </div>
      )}
    </div>
  );
}

export default App;
