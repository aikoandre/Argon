// frontend/src/pages/ChatsListPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // useNavigate para redirecionar
import { getAllChatSessions, deleteChatSession, updateChatSessionTitle } from "../services/api";
import { CardImage } from "../components/CardImage";
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

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      setChatSessions(prevSessions => prevSessions.filter(session => session.id !== sessionId));
    } catch (err) {
      setError("Failed to delete chat session.");
      console.error(err);
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      const updatedSession = await updateChatSessionTitle(sessionId, newTitle);
      setChatSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === sessionId ? { ...session, title: updatedSession.title } : session
        )
      );
    } catch (err) {
      setError("Failed to rename chat session.");
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <p className="text-center text-gray-400 p-10">Loading chat sessions...</p>
    );
  }

  return (
    <div className="container p-4 md:p-8 max-h-screen overflow-y-auto custom-scrollbar"> {/* Removed mx-auto */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-white font-quintessential">My Chats</h1>
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
        {chatSessions
          .filter(session => (session.user_message_count && session.user_message_count > 0)) // Filter sessions with user messages
          .map((session) => {
            const isCharacter = session.card_type === 'character';
            const CardImageComponent = CardImage;
            
            return (
              <div
                key={session.id}
                className="bg-app-surface p-4 rounded-lg shadow-md cursor-pointer transform transition-transform duration-300 hover:scale-105 flex items-center gap-4"
                onClick={() => navigate(`/chat/${session.id}`)}
              >
                <div className="flex-shrink-0 w-16 h-24">
                  <CardImageComponent
                    imageUrl={session.card_image_url || null}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                
                <div className="flex-1" onClick={() => navigate(`/chat/${session.id}`)}> {/* Make content clickable */}
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-semibold text-app-text">
                      {session.title || `Chat ${session.id.substring(0, 8)}`}
                    </h2>
                    <span className="text-xs px-2 py-1 rounded-full bg-app-text-2 text-app-surface">
                      {isCharacter ? 'Character' : 'Scenario'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Last active: {new Date(session.last_active_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* Rename Button */}
                  <button
                    className="p-2 rounded-full hover:bg-app-surface-2 text-gray-400 hover:text-white transition-colors"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      // Implement rename logic here
                      const newTitle = prompt("Enter new title for chat:", session.title || `Chat ${session.id.substring(0, 8)}`);
                      if (newTitle !== null && newTitle.trim() !== "") {
                        handleRenameSession(session.id, newTitle.trim());
                      }
                    }}
                    title="Rename Chat"
                  >
                    <span className="material-icons-outlined text-xl">edit</span>
                  </button>
                  {/* Delete Button */}
                  <button
                    className="p-2 rounded-full hover:bg-red-700 text-gray-400 hover:text-white transition-colors"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      if (window.confirm(`Are you sure you want to delete "${session.title || `Chat ${session.id.substring(0, 8)}`}"?`)) {
                        handleDeleteSession(session.id);
                      }
                    }}
                    title="Delete Chat"
                  >
                    <span className="material-icons-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        {/* Você pode adicionar mais infos aqui, como nome do cenário ou GM, se ChatSessionListedData incluir */}
      </div>
    </div>
  );
};

export default ChatsListPage;
// No changes needed for image filename logic here. This page uses the imageUrl provided by the backend, which is now always correct and cache-busted by the card pages. No filename display logic is needed in this file.
