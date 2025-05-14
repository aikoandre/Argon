// frontend/src/pages/ChatPage.tsx
import React, { useState, useEffect, type FormEvent, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getChatSessionMessages,
  addMessageToSession,
  getChatSessionDetails,
} from "../services/api";
import type { ChatMessageData, ChatSessionData } from "../services/api";

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

  const messagesEndRef = useRef<null | HTMLDivElement>(null); // Para scroll automático

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]); // Scrolla sempre que novas mensagens chegam

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
        // Buscar mensagens e detalhes da sessão em paralelo
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
      timestamp: new Date().toISOString(), // Timestamp local temporário
      // message_metadata: {}, // Se tiver
    };

    // Adição otimista da mensagem do usuário
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    const currentMessageContent = newMessage.trim();
    setNewMessage(""); // Limpa o input

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

  if (isLoadingMessages) {
    return <p className="text-center text-gray-400 p-10">Loading chat...</p>;
  }
  if (error) {
    return <p className="text-center text-red-500 p-10">{error}</p>;
  }
  if (!sessionDetails) {
    return (
      <p className="text-center text-gray-400 p-10">Chat session not found.</p>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme.navHeight)] max-h-[calc(100vh-80px)]">
      {" "}
      {/* Ajuste a altura conforme sua navbar */}
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-semibold text-white">
          {sessionDetails.title || `Chat ${chatId?.substring(0, 8)}`}
        </h1>
        {/* Poderia mostrar o nome do GM/Cenário aqui */}
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-750">
        {" "}
        {/* bg-gray-750 como exemplo, use sua cor */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender_type === "USER" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl shadow ${
                msg.sender_type === "USER"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-600 text-gray-100"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.sender_type === "USER"
                    ? "text-blue-200 text-right"
                    : "text-gray-400 text-left"
                }`}
              >
                {/* {new Date(msg.timestamp).toLocaleTimeString()} - {msg.sender_type} */}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* Elemento para scroll */}
      </div>
      <form
        onSubmit={handleSendMessage}
        className="p-4 bg-gray-800 border-t border-gray-700"
      >
        <div className="flex items-center">
          <textarea
            rows={1} // Começa com 1 linha, pode aumentar com o texto
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type anything..."
            disabled={isSending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e as any); // FormEvent esperado
              }
            }}
            className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-l-lg focus:ring-blue-500 focus:border-blue-500 resize-none text-white placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={isSending || !newMessage.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-3 rounded-r-lg transition duration-150 ease-in-out disabled:opacity-50"
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPage;
