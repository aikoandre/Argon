// frontend/src/pages/ChatPage.tsx
import React, { useState, useEffect, type FormEvent, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getChatSessionMessages,
  addMessageToSession,
  getChatSessionDetails,
} from "../services/api";
import type { ChatMessageData, ChatSessionData } from "../services/api";

// Default avatar images - replace these with your actual avatar URLs
const DEFAULT_USER_AVATAR = "/user-avatar.png";
const DEFAULT_BOT_AVATAR = "/bot-avatar.png";

const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sessionDetails, setSessionDetails] = useState<ChatSessionData | null>(
    null
  );
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const chatContainerRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (!chatId) {
      setError("Chat ID is missing.");
      setIsLoadingMessages(false);
      return;
    }

    const fetchMessagesAndDetails = async () => {
      setIsLoadingMessages(true);
      setError(null);
      try {
        const [msgs, details] = await Promise.all([
          getChatSessionMessages(chatId),
          getChatSessionDetails(chatId),
        ]);
        setMessages(msgs);
        setSessionDetails(details);
      } catch (err) {
        setError("Failed to load chat messages or session details.");
        console.error(err);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    fetchMessagesAndDetails();
  }, [chatId]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    setIsSending(true);
    setError(null);
    const tempMessageId = `temp-${Date.now()}`; // ID temporário para exibição otimista
    const userMessage: ChatMessageData = {
      id: tempMessageId,
      chat_session_id: chatId,
      sender_type: "USER",
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    // Adição otimista da mensagem do usuário
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    const currentMessageContent = newMessage.trim();
    setNewMessage("");

    try {
      const sentMessage = await addMessageToSession(chatId, {
        content: currentMessageContent,
        sender_type: "USER",
      });
      // Substitui a mensagem temporária pela mensagem real do backend
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempMessageId ? sentMessage : msg
        )
      );
      // TODO: Aqui é onde você acionaria a IA para responder no futuro
    } catch (err) {
      setError("Failed to send message. Please try again.");
      console.error(err);
      // Remove a mensagem otimista se falhar
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== tempMessageId)
      );
      setNewMessage(currentMessageContent); // Restaura o texto no input
    } finally {
      setIsSending(false);
    }
  };

  // Function to format timestamp
  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "";
    }
  };

  if (isLoadingMessages) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center text-gray-400 p-10 animate-pulse">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <p className="text-center text-red-500 p-10 rounded-lg bg-gray-800 shadow-lg">
          {error}
        </p>
      </div>
    );
  }

  if (!sessionDetails) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <p className="text-center text-gray-400 p-10 rounded-lg bg-gray-800 shadow-lg">
          Chat session not found.
        </p>
      </div>
    );
  }

  // Default persona name for the user if not available
  const defaultUserPersona = "User";

  return (
    <div className="relative h-screen bg-gray-900">
      {/* No chat header - removed as requested */}
      
      {/* Container das mensagens sem padding-top (header removido) */}
      <div className="h-full overflow-hidden pb-20">
        <div 
          ref={chatContainerRef}
          className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        >
          <div className="max-w-4xl mx-auto px-4 pb-4">
            {messages.length === 0 && (
              <div className="flex justify-center my-10">
                <p className="text-gray-500 text-center italic">
                  No messages yet. Start a conversation!
                </p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div key={msg.id} className="mb-4">
                <div
                  className={`rounded-lg ${
                    msg.sender_type === "USER"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-800 text-gray-100"
                  }`}
                >
                  <div className="p-3 flex">
                    {/* Imagem */}
                    <div className="flex-shrink-0 w-16 h-24 mr-3">
                      <img
                        src={msg.sender_type === "USER" ? DEFAULT_USER_AVATAR : DEFAULT_BOT_AVATAR}
                        alt={msg.sender_type === "USER" ? "User" : "Bot"}
                        className="w-full h-full object-cover rounded-lg bg-gray-700"
                        onError={(e) => {
                          const fallback = msg.sender_type === "USER"
                            ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E"
                            : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cpath d='M8 9.05v-.1'%3E%3C/path%3E%3Cpath d='M16 9.05v-.1'%3E%3C/path%3E%3Cpath d='M12 13a4 4 0 0 1-4 4'%3E%3C/path%3E%3Cpath d='M12 13a4 4 0 0 0 4 4'%3E%3C/path%3E%3C/svg%3E";
                          (e.target as HTMLImageElement).src = fallback;
                        }}
                      />
                    </div>
                    {/* Nome, data/hora e mensagem */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center mb-1 flex-wrap">
                        <span className="font-medium text-purple-400 mr-2">
                          {msg.sender_type === "USER" ? defaultUserPersona : "Assistant"}
                        </span>
                        <span className="text-xs text-gray-400 mr-2">
                          {new Date(msg.timestamp).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words mt-0.5">{msg.content}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Container do input fixo no bottom */}
      <div className="absolute bottom-0 left-0 right-0 py-3">
        <div className="max-w-4xl mx-auto px-4">
          <form onSubmit={handleSendMessage} className="relative">
            <textarea
              rows={1}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as any);
                }
              }}
              className="w-full p-4 pr-14 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-white placeholder-gray-400 outline-none"
              style={{ minHeight: "50px", maxHeight: "120px" }}
            />
            <button
              type="submit"
              disabled={isSending || !newMessage.trim()}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center transition duration-150 ease-in-out disabled:opacity-50"
            >
              {isSending ? (
                <span className="animate-spin">⟳</span>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;