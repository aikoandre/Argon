// frontend/src/pages/ChatsListPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllChatSessions,
  updateChatSessionTitle,
  deleteChatSession,
} from "../services/api";
import type { ChatSessionListedData } from "../services/api";

const ChatsListPage: React.FC = () => {
  const [chatSessions, setChatSessions] = useState<ChatSessionListedData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
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

  const handleEditTitle = (session: ChatSessionListedData) => {
    setEditingChatId(session.id);
    setEditingTitle(session.title || `Chat ${session.id.substring(0, 8)}`);
  };

  const handleSaveTitle = async () => {
    if (!editingChatId) return;
    try {
      await updateChatSessionTitle(editingChatId, editingTitle);
      setChatSessions(sessions => sessions.map(s => 
        s.id === editingChatId 
          ? { ...s, title: editingTitle }
          : s
      ));
      setEditingChatId(null);
    } catch (err) {
      setError("Failed to update chat title.");
      console.error(err);
    }
  };

  const handleCancelEdit = () => {
    setEditingChatId(null);
    setEditingTitle("");
  };

  const handleDelete = async (chatId: string) => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    
    try {
      await deleteChatSession(chatId);
      setChatSessions(sessions => sessions.filter(s => s.id !== chatId));
    } catch (err) {
      setError("Failed to delete chat.");
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <p className="text-center text-gray-400 p-10">Loading chat sessions...</p>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-4xl font-bold text-white mb-8">My Chats</h1>

      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}


      <div className="space-y-4">
        {chatSessions.map((session) => (
          <div
            key={session.id}
            className="bg-gray-800 p-4 rounded-lg shadow-md hover:bg-gray-700 transition-colors"
          >
            <div className="flex justify-between items-start">
              {editingChatId === session.id ? (
                <div className="flex items-center gap-2 flex-grow">
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="flex-grow bg-gray-700 text-white p-2 rounded-md"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTitle}
                    className="text-green-500 hover:text-green-400"
                    title="Save"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-red-500 hover:text-red-400"
                    title="Cancel"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-grow cursor-pointer" onClick={() => navigate(`/chat/${session.id}`)}>
                    <h2 className="text-xl font-semibold text-blue-400 mb-1">
                      {session.title || `Chat ${session.id.substring(0, 8)}`}
                    </h2>
                    <p className="text-sm text-gray-400">
                      Last active: {new Date(session.last_active_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditTitle(session); }}
                      className="text-gray-400 hover:text-blue-500"
                      title="Edit Title"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                      className="text-gray-400 hover:text-red-500"
                      title="Delete Chat"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 10-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatsListPage;
