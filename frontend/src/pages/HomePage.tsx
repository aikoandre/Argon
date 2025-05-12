import React from "react";
import { Link } from "react-router-dom";

interface HomePageProps {
  newChatMode?: boolean; // Para diferenciar quando viemos de "novo chat"
}

function HomePage({ newChatMode }: HomePageProps) {
  // Lógica para buscar e listar chats existentes virá aqui
  // Lógica para iniciar novo chat virá aqui
  return (
    <div>
      <h2>{newChatMode ? "Start New Chat" : "Existing Chats"}</h2>
      {/* Placeholder para lista de chats */}
      <p>Lista de chats aparecerá aqui.</p>
      {!newChatMode && <Link to="/new-chat">Start New Chat</Link>}
      {/* Se newChatMode, mostrar seleção de cenário/personagem GM */}
    </div>
  );
}
export default HomePage;
