// frontend/src/pages/ChatsListPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // useNavigate para redirecionar
import { getAllChatSessions } from "../services/api";
import type { ChatSessionListedData } from "../services/api";

const ChatsListPage: React.FC = () => {
  const [chatSessions, setChatSessions] = useState<ChatSessionListedData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAllChatSessions();
        setChatSessions(data);
      } catch (err) {
        setError("Failed to load chat sessions.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSessions();
  }, []);

  if (isLoading) {
    return (
      <p className="text-center text-gray-400 p-10">Loading chat sessions...</p>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-white">My Chats</h1>
      </div>

      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}

      {chatSessions.length === 0 && !isLoading && (
        <div className="text-center py-10">
          <p className="text-xl text-gray-500 mb-4">No active chats yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {chatSessions.map((session) => (
          <div
            key={session.id}
            className="bg-gray-800 p-4 rounded-lg shadow-md hover:bg-gray-700 cursor-pointer transition-colors duration-200"
            onClick={() => navigate(`/chat/${session.id}`)} // Navega para a ChatPage
          >
            <h2 className="text-xl font-semibold text-blue-400 mb-1">
              {session.title || `Chat ${session.id.substring(0, 8)}`}
            </h2>
            <p className="text-sm text-gray-400">
              Last active: {new Date(session.last_active_at).toLocaleString()}
            </p>
            {/* Você pode adicionar mais infos aqui, como nome do cenário ou GM, se ChatSessionListedData incluir */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatsListPage;
