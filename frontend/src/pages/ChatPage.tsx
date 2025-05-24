// frontend/src/pages/ChatPage.tsx
import React, { useState, useEffect, type FormEvent, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getChatSessionMessages,
  addMessageToSession,
  getChatSessionDetails,
  getUserSettings,
  getUserPersonaById,
} from "../services/api";
import type { ChatMessageData, ChatSessionData } from "../services/api";
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

// Default avatar images - replace these with your actual avatar URLs
// Default avatar images - using data URLs to avoid file serving issues for defaults
const DEFAULT_USER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
const DEFAULT_BOT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cpath d='M8 9.05v-.1'%3E%3C/path%3E%3Cpath d='M16 9.05v-.1'%3E%3C/path%3E%3Cpath d='M12 13a4 4 0 0 1-4 4'%3E%3C/path%3E%3Cpath d='M12 13a4 4 0 0 0 4 4'%3E%3C/path%3E%3C/svg%3E";

const iconBaseClass = "material-icons-outlined text-2xl flex-shrink-0";
const SendIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>send</span>
);

// Helper function to get proper image URL for persona images
const getImageUrl = (imageUrl: string | null) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:')) return imageUrl;

  // Normalize the URL by removing common incorrect prefixes and ensuring a clean path
  let cleanedPath = imageUrl
    .replace(/^(https?:\/\/[^/]+)?\/?/, '') // Remove http(s)://domain:port/
    .replace(/(api\/images\/serve\/|static\/images\/|static\/)/g, '') // Remove all instances of specific incorrect prefixes
    .split('?')[0]; // Remove query parameters

  // Decode URI components (e.g., %2F to /)
  cleanedPath = decodeURIComponent(cleanedPath);

  // Ensure no leading/trailing slashes from the cleaning process
  cleanedPath = cleanedPath.replace(/^\/|\/$/g, '');

  // Construct the final static URL with the correct base
  return `/static/images/${cleanedPath}`;
};

// Helper function to apply custom formatting before Markdown parsing
const applyCustomFormatting = (content: string) => {
  let formattedContent = content;

  // Replace "text" with <span class="text-app-chat">text</span> for blue color
  formattedContent = formattedContent.replace(/"([^"]+)"/g, '<span class="text-app-chat">$1</span>');

  return formattedContent;
};


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
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [activePersonaName, setActivePersonaName] = useState<string>("User");
  const [activePersonaImageUrl, setActivePersonaImageUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const inputAreaRef = useRef<null | HTMLDivElement>(null);

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

    // Fetch active persona from user settings
    const fetchActivePersona = async () => {
      try {
        const settings = await getUserSettings();
        setActivePersonaId(settings?.active_persona_id || null);
        if (settings?.active_persona_id) {
          try {
            const persona = await getUserPersonaById(settings.active_persona_id);
            setActivePersonaName(persona.name || "User");
            const rawPersonaImageUrl = persona.image_url || null;
            const processedPersonaImageUrl = getImageUrl(rawPersonaImageUrl);
            setActivePersonaImageUrl(processedPersonaImageUrl);
          } catch (err) {
            console.error("Error fetching active persona or its image:", err);
            setActivePersonaName("User");
            setActivePersonaImageUrl(null);
          }
        } else {
          setActivePersonaName("User");
          setActivePersonaImageUrl(null);
        }
      } catch (err) {
        console.error("Error fetching user settings for active persona:", err); // More specific error log
        setActivePersonaId(null);
        setActivePersonaName("User");
        setActivePersonaImageUrl(null);
      }
    };
    fetchActivePersona();
  }, [chatId]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    setIsSending(true);
    setError(null);
    const tempMessageId = `temp-${Date.now()}`;
    const userMessage: ChatMessageData = {
      id: tempMessageId,
      chat_session_id: chatId,
      sender_type: "USER",
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      // Include message_metadata if activePersonaId is a non-empty string
      message_metadata: activePersonaId && activePersonaId !== "" ? { active_persona_id: activePersonaId, active_persona_name: activePersonaName } : undefined,
      // Store active persona details directly in the message
      active_persona_name: activePersonaName,
      active_persona_image_url: activePersonaImageUrl,
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    const currentMessageContent = newMessage.trim();
    setNewMessage("");

    try {
      const aiResponseMessage = await addMessageToSession(chatId, {
        content: currentMessageContent,
        sender_type: "USER",
        user_persona_id: activePersonaId || undefined, // Pass the active persona ID
        message_metadata: activePersonaId && activePersonaId !== "" ? { active_persona_id: activePersonaId, active_persona_name: activePersonaName } : undefined,
        active_persona_name: activePersonaName, // Send to backend (for message display)
        active_persona_image_url: activePersonaImageUrl, // Send to backend (for message display)
      });
      setMessages((prevMessages) => [...prevMessages, aiResponseMessage]);
    } catch (err) {
      setError("Failed to send message. Please try again.");
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== tempMessageId)
      );
      setNewMessage(currentMessageContent);
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-gray-400 p-10 animate-pulse">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4"></div>
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

  return (
    <div className="flex flex-col h-screen overflow-hidden"> {/* Changed to h-screen */}

      {/* Área de mensagens com scroll, alinhada ao final */}
      <div className="flex-grow flex-shrink-1 w-full overflow-y-auto max-w-full min-h-0 flex flex-col justify-end"> {/* Added flex flex-col justify-end */}
        <div className="max-w-4xl mx-auto px-4 w-full"> {/* New wrapper for centering */}
          {messages.map((msg) => {
            const rawAiImageUrl = msg.active_persona_image_url ?? null;
            const processedAiAvatarSrc = getImageUrl(rawAiImageUrl) || DEFAULT_BOT_AVATAR;
            const aiName = msg.active_persona_name || "Assistant";

            const userImageSrc = getImageUrl(msg.active_persona_image_url ?? activePersonaImageUrl) || DEFAULT_USER_AVATAR;
            const finalImageSrc = msg.sender_type === "USER" ? userImageSrc : processedAiAvatarSrc;

            return (
            <div key={msg.id} className="mb-4">
              <div
                className={`rounded-2xl ${
                  msg.sender_type === "USER"
                    ? "bg-app-surface text-white"
                    : "bg-app-surface text-gray-100"
                }`}
              >
                <div className="p-3 flex">
                  {/* Imagem */}
                  <div className="flex-shrink-0 w-16 h-24 mr-3">
                    <img
                      src={finalImageSrc}
                      alt={msg.sender_type === "USER" ? "User" : "Bot"}
                      className="w-full h-full object-cover rounded-lg bg-gray-700"
                      onError={(e) => {
                        const fallback = msg.sender_type === "USER"
                          ? DEFAULT_USER_AVATAR
                          : DEFAULT_BOT_AVATAR;
                        (e.target as HTMLImageElement).src = fallback;
                        console.error(`ERROR: Failed to load image for message ${msg.id}. Fallback used. Original URL: ${finalImageSrc}`);
                      }}
                    />
                  </div>
                  {/* Nome, data/hora e mensagem */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center mb-1 flex-wrap">
                      <span className="font-medium text-white mr-2">
                        {msg.sender_type === "USER"
                          ? msg.active_persona_name || msg.message_metadata?.active_persona_name || activePersonaName
                          : aiName}
                      </span>
                      <span className="text-xs text-gray-400 mr-2">
                        {new Date(msg.timestamp).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <ReactMarkdown
                      className="whitespace-pre-wrap break-words mt-0.5"
                      rehypePlugins={[rehypeRaw]}
                    >
                      {applyCustomFormatting(msg.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          );})}
          <div ref={messagesEndRef} />
          {messages.length === 0 && (
            <div className="flex justify-center my-10">
              <div className="text-center py-10">
          <p className="text-xl text-gray-500 mb-4">No messages yet. Send a message!</p>
        </div>
            </div>
          )}
        </div>
      </div>
      <div
        ref={inputAreaRef}
        className="flex w-full flex-col-reverse flex-shrink-0"
      >
        <div className="max-w-4xl mx-auto px-2 sm:px-4 w-full">
          <form onSubmit={handleSendMessage} className="relative">
            <textarea
              rows={1}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                // Auto-resize logic
                const ta = e.target as HTMLTextAreaElement;
                ta.style.height = 'auto';
                ta.style.height = ta.scrollHeight + 'px';
              }}
              placeholder="Type a message..."
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as any);
                }
              }}
              className="w-full p-4 pr-14 bg-app-surface rounded-2xl text-white placeholder-gray-400 outline-none resize-none"
              style={{overflow: 'hidden', minHeight: '48px', maxHeight: '200px'}}
            />
            <button
              type="submit"
              disabled={isSending || !newMessage.trim()}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center"
            >
              {isSending ? (
                <span className="animate-spin">⟳</span>
              ) : (
                <SendIcon className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
