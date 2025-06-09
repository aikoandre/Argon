// frontend/src/pages/ChatPage.tsx
import React, { useState, useEffect, type FormEvent, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios"; // Import axios
import {
  getChatSessionMessages,
  getChatSessionDetails,
  getUserSettings,
  getUserPersonaById,
  updateUserSettings, // Added for clearing active persona on 404
  getCharacterCardById, // Import for character card details
  getScenarioCardById, // Import for scenario card details
  addMessageToSession, // Import addMessageToSession for sending messages
} from "../services/api";
import { type ChatSessionData } from "../services/api"; // ChatSessionData is from api.ts
import { type ChatMessageData } from "../types/chat"; // Only import ChatMessageData, remove unused types

// Default avatar images - using data URLs to avoid file serving issues for defaults
const DEFAULT_USER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
const DEFAULT_BOT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cpath d='M8 9.05v-.1'%3E%3C/path%3E%3Cpath d='M16 9.05v-.1'%3E%3C/path%3E%3Cpath d='M12 13a4 4 0 0 1-4 4'%3E%3C/path%3E%3Cpath d='M12 13a4 4 0 0 0 4 4'%3E%3C/path%3E%3C/svg%3E";

const iconBaseClass = "material-icons-outlined text-2xl flex-shrink-0";
const SendIcon = ({ className }: { className?: string }) => (
  <span className={`${iconBaseClass} ${className || ''}`.trim()}>send</span>
);


const ArrowBackIcon = ({ className, onClick, disabled }: { className?: string; onClick: () => void; disabled?: boolean }) => (
  <span className={`${iconBaseClass} ${className || ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={disabled ? undefined : onClick}>arrow_back_ios</span>
);

const ArrowForwardIcon = ({ className, onClick, disabled }: { className?: string; onClick: () => void; disabled?: boolean }) => (
  <span className={`${iconBaseClass} ${className || ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={disabled ? undefined : onClick}>arrow_forward_ios</span>
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

const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sessionDetails, setSessionDetails] = useState<ChatSessionData | null>(
    null
  );
  const [newMessage, setNewMessage] = useState("");
  const [allBeginningMessages, setAllBeginningMessages] = useState<string[]>([]);
  const [currentBeginningMessageIndex, setCurrentBeginningMessageIndex] = useState<number>(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [activePersonaName, setActivePersonaName] = useState<string>("User");
  const [activePersonaImageUrl, setActivePersonaImageUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const inputAreaRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]); // Remove streamedAiMessage from dependency

  const hasSentBeginningMessageRef = useRef(false); // Ref to track if beginning message has been sent for the current chat

  useEffect(() => {

    // Reset the ref when chatId changes
    hasSentBeginningMessageRef.current = false;

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

        // Cache card name and image for use in render
        if (details) {
          if (details.card_type === 'character' && details.card_id) {
            const character = await getCharacterCardById(details.card_id);
            (window as any).__characterCardNameCache = (window as any).__characterCardNameCache || {};
            (window as any).__characterCardNameCache[details.card_id] = character.name;
            (window as any).__characterCardImageCache = (window as any).__characterCardImageCache || {};
            (window as any).__characterCardImageCache[details.card_id] = character.image_url || null;
          } else if (details.card_type === 'scenario' && details.card_id) {
            const scenario = await getScenarioCardById(details.card_id);
            (window as any).__scenarioCardNameCache = (window as any).__scenarioCardNameCache || {};
            (window as any).__scenarioCardNameCache[details.card_id] = scenario.name;
            (window as any).__scenarioCardImageCache = (window as any).__scenarioCardImageCache || {};
            (window as any).__scenarioCardImageCache[details.card_id] = scenario.image_url || null;
          }
        }

        setMessages(msgs.map((msg: ChatMessageData) => {
          // Cast msg to ChatMessageData to access extended properties
          const chatMsg = msg as ChatMessageData;
          if (chatMsg.sender_type === "AI") {
            // For regular AI messages, initialize with current content as the first response
            return {
              ...chatMsg,
              ai_responses: chatMsg.ai_responses || [{ content: chatMsg.content, timestamp: chatMsg.timestamp }],
              current_response_index: chatMsg.current_response_index !== undefined ? chatMsg.current_response_index : (chatMsg.ai_responses?.length || 1) - 1,
            };
          }
          return chatMsg;
        }));
        setSessionDetails(details);

        // Populate allBeginningMessages from card details regardless of existing messages
        if (details) {
          let fetchedBeginningMessages: string[] = [];
          if (details.card_type === "character" && details.card_id) {
            const character = await getCharacterCardById(details.card_id);
            if (character.beginning_messages && character.beginning_messages.length > 0) {
              fetchedBeginningMessages = character.beginning_messages;
            }
          } else if (details.card_type === "scenario" && details.card_id) {
            const scenario = await getScenarioCardById(details.card_id);
            if (scenario.beginning_message && scenario.beginning_message.length > 0) {
              fetchedBeginningMessages = scenario.beginning_message;
            }
          }
          setAllBeginningMessages(fetchedBeginningMessages);
          // If the first message is a beginning message, set its index
          if (msgs.length > 0 && msgs[0].is_beginning_message && msgs[0].message_metadata?.current_response_index !== undefined) {
            setCurrentBeginningMessageIndex(msgs[0].message_metadata.current_response_index);
          } else {
            setCurrentBeginningMessageIndex(0); // Default to first if not found or not a beginning message
          }
        }
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
          } catch (err: unknown) { // Explicitly type err as unknown
            console.error("Error fetching active persona or its image:", err);
            if (axios.isAxiosError(err) && err.response?.status === 404) {
              console.warn("Active persona not found (404). Clearing active_persona_id in settings.");
              await updateUserSettings({ active_persona_id: null }); // Clear the invalid persona ID
              // Re-fetch settings immediately to reflect the cleared persona ID
              const updatedSettings = await getUserSettings();
              setActivePersonaId(updatedSettings?.active_persona_id || null);
            }
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

  const updatePersonaCache = (cardType: string | undefined, cardId: string | undefined, name: string | undefined, imageUrl: string | undefined | null) => {
    if (!cardType || !cardId) return;
    
    if (cardType === 'character') {
      (window as any).__characterCardNameCache = (window as any).__characterCardNameCache || {};
      (window as any).__characterCardNameCache[cardId] = name;
      (window as any).__characterCardImageCache = (window as any).__characterCardImageCache || {};
      (window as any).__characterCardImageCache[cardId] = imageUrl;
    } else if (cardType === 'scenario') {
      (window as any).__scenarioCardNameCache = (window as any).__scenarioCardNameCache || {};
      (window as any).__scenarioCardNameCache[cardId] = name;
      (window as any).__scenarioCardImageCache = (window as any).__scenarioCardImageCache || {};
      (window as any).__scenarioCardImageCache[cardId] = imageUrl;
    }
  };

  const handleSendMessage = async (e: FormEvent, regenerateMessageId?: string) => {
    e.preventDefault();
    if (!newMessage.trim() && !regenerateMessageId) return;

    setIsSending(true);
    // Remove unused streaming state
    // setIsStreaming(false);
    // setStreamedAiMessage("");
    setError(null);

    let userMessageContent = newMessage.trim();

    if (regenerateMessageId) {
      // Find the user message associated with the AI message to regenerate
      const aiMessageIndex = messages.findIndex(msg => msg.id === regenerateMessageId);
      if (aiMessageIndex > -1) {
        // Assuming the user message is the one immediately preceding the AI message
        // This logic might need refinement if messages can be reordered or if there are system messages in between
        const potentialUserMessage = messages[aiMessageIndex - 1];
        if (potentialUserMessage && potentialUserMessage.sender_type === "USER") {
          userMessageContent = potentialUserMessage.content; // Use the content of the original user message
        } else {
          setError("Could not find the original user message to regenerate from.");
          setIsSending(false);
          return;
        }
      } else {
        setError("AI message to regenerate not found.");
        setIsSending(false);
        return;
      }
    }

    const tempMessageId = `temp-${Date.now()}`;
    if (!regenerateMessageId) {
      // Only add a new user message if it's not a regeneration
      // Garantir timestamp crescente
      let userTimestamp = new Date().toISOString();
      if (messages.length > 0) {
        const lastMsgTime = new Date(messages[messages.length - 1].timestamp).getTime();
        const now = Date.now();
        if (now <= lastMsgTime) {
          userTimestamp = new Date(lastMsgTime + 1).toISOString();
        }
      }
      const userMessage: ChatMessageData = {
        id: tempMessageId,
        chat_session_id: chatId!,
        sender_type: "USER",
        content: userMessageContent,
        timestamp: userTimestamp,
        message_metadata: activePersonaId && activePersonaId !== "" ? { active_persona_id: activePersonaId, active_persona_name: activePersonaName } : undefined,
        active_persona_name: activePersonaName,
        active_persona_image_url: activePersonaImageUrl,
      };
      setMessages((prevMessages) => [...prevMessages, userMessage]);
    }

    setNewMessage("");

    try {
      // Use addMessageToSession instead of streaming
      const aiResponse = await addMessageToSession(
        chatId!,
        {
          content: userMessageContent,
          sender_type: "USER",
          user_persona_id: activePersonaId || undefined,
          message_metadata: activePersonaId && activePersonaId !== "" ? { active_persona_id: activePersonaId, active_persona_name: activePersonaName } : undefined,
          active_persona_name: activePersonaName,
          active_persona_image_url: activePersonaImageUrl,
          current_beginning_message_index: messages.length === 1 && messages[0].is_beginning_message ? currentBeginningMessageIndex : undefined,
        }
      );
      // --- Patch: Ensure card name/image are cached and available for AI messages ---
      if (sessionDetails && sessionDetails.card_type && typeof sessionDetails.card_id === 'string') {
        const cardId = sessionDetails.card_id;
        if (sessionDetails.card_type === 'character') {
          if (!(window as any).__characterCardNameCache?.[cardId] || !(window as any).__characterCardImageCache?.[cardId]) {
            getCharacterCardById(cardId).then(character => {
              (window as any).__characterCardNameCache = (window as any).__characterCardNameCache || {};
              (window as any).__characterCardNameCache[cardId] = character.name;
              (window as any).__characterCardImageCache = (window as any).__characterCardImageCache || {};
              (window as any).__characterCardImageCache[cardId] = character.image_url || null;
            });
          }
        } else if (sessionDetails.card_type === 'scenario') {
          if (!(window as any).__scenarioCardNameCache?.[cardId] || !(window as any).__scenarioCardImageCache?.[cardId]) {
            getScenarioCardById(cardId).then(scenario => {
              (window as any).__scenarioCardNameCache = (window as any).__scenarioCardNameCache || {};
              (window as any).__scenarioCardNameCache[cardId] = scenario.name;
              (window as any).__scenarioCardImageCache = (window as any).__scenarioCardImageCache || {};
              (window as any).__scenarioCardImageCache[cardId] = scenario.image_url || null;
            });
          }
        }
      }
      // --- End Patch ---
      // Update persona cache if we have new information
      if (sessionDetails) {
        updatePersonaCache(
          sessionDetails.card_type,
          sessionDetails.card_id,
          aiResponse.ai_message.active_persona_name || undefined,
          aiResponse.ai_message.active_persona_image_url || undefined
        );
      }
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          ...aiResponse.ai_message,
        },
      ]);
    } catch (err) {
      setError("Failed to get AI response.");
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleRegenerate = (aiMessageId: string) => {
    const aiMessage = messages.find(msg => msg.id === aiMessageId);
    // Prevent regeneration if it's a beginning message
    if (aiMessage?.message_metadata?.is_beginning_message) {
      setError("Cannot regenerate a beginning message.");
      return;
    }

    if (aiMessage && aiMessage.sender_type === "AI") {
      const aiMessageIndex = messages.findIndex(msg => msg.id === aiMessageId);
      if (aiMessageIndex > 0) {
        const userMessage = messages[aiMessageIndex - 1];
        if (userMessage && userMessage.sender_type === "USER") {
          setNewMessage(userMessage.content);
          handleSendMessage({ preventDefault: () => {} } as FormEvent, aiMessageId);
        } else {
          setError("Could not find the preceding user message to regenerate from.");
        }
      } else {
        setError("Cannot regenerate the first message in the chat.");
      }
    }
  };

  const handleNavigateBeginningMessage = (direction: 'prev' | 'next') => {
    setMessages(prevMessages => {
      // Find the beginning message in the current messages array
      const beginningMessageIndexInChat = prevMessages.findIndex(msg => msg.is_beginning_message);
      if (beginningMessageIndexInChat === -1) return prevMessages; // No beginning message found

      let newIndex = currentBeginningMessageIndex;
      if (direction === 'prev') {
        newIndex = Math.max(0, newIndex - 1);
      } else {
        newIndex = Math.min(allBeginningMessages.length - 1, newIndex + 1);
      }

      setCurrentBeginningMessageIndex(newIndex); // Update the index state

      // Update the content of the existing beginning message in the chat
      const updatedMessages = [...prevMessages];
      updatedMessages[beginningMessageIndexInChat] = {
        ...updatedMessages[beginningMessageIndexInChat],
        content: allBeginningMessages[newIndex],
        timestamp: new Date().toISOString(), // Update timestamp to reflect change
      } as ChatMessageData; // Cast to ChatMessageData to ensure type safety

      return updatedMessages;
    });
  };

  const handleNavigateResponse = (aiMessageId: string, direction: 'prev' | 'next') => {
    setMessages(prevMessages => prevMessages.map(msg => {
      // This function is now specifically for regular AI responses (not beginning messages)
      if (msg.id === aiMessageId && msg.sender_type === "AI" && !msg.is_beginning_message && msg.ai_responses && msg.ai_responses.length > 1) {
        let newIndex = msg.current_response_index !== undefined ? msg.current_response_index : msg.ai_responses.length - 1;
        if (direction === 'prev') {
          newIndex = (newIndex - 1 + msg.ai_responses.length) % msg.ai_responses.length;
        } else {
          newIndex = (newIndex + 1) % msg.ai_responses.length;
        }
        return {
          ...msg,
          content: msg.ai_responses[newIndex].content,
          timestamp: msg.ai_responses[newIndex].timestamp,
          current_response_index: newIndex,
        };
      }
      return msg;
    }));
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
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden bg-app-bg">
      {/* Chat messages section */}
      <div className="flex-1 min-h-0">
        {/* Remove max-w-xl lg:max-w-2xl mx-auto to make chat area full width */}
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-app-accent scrollbar-track-app-surface/30 rounded-xl min-h-0 px-4 py-2">
            {messages.length === 0 && (
              <div className="flex justify-center pb-4">
                <div className="text-center">
                  <p className="text-xl text-gray-500">No messages yet. Send a message!</p>
                </div>
              </div>
            )}
            {/* Regular messages */}
            {[...messages]
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .map((msg) => {
                // For AI messages, always use card name/image if persona fields are missing
                let aiName = msg.active_persona_name;
                let aiImageUrl = msg.active_persona_image_url;
                if (msg.sender_type === "AI") {
                  if (!aiName && sessionDetails?.card_type === 'character' && sessionDetails.card_id) {
                    aiName = (window as any).__characterCardNameCache?.[sessionDetails.card_id];
                  } else if (!aiName && sessionDetails?.card_type === 'scenario' && sessionDetails.card_id) {
                    aiName = (window as any).__scenarioCardNameCache?.[sessionDetails.card_id];
                  }
                  // Never fallback to 'Assistant' for AI
                  // For image, use card image if persona image is missing
                  if (!aiImageUrl && sessionDetails?.card_type === 'character' && sessionDetails.card_id) {
                    aiImageUrl = (window as any).__characterCardImageCache?.[sessionDetails.card_id] ?? null;
                  } else if (!aiImageUrl && sessionDetails?.card_type === 'scenario' && sessionDetails.card_id) {
                    aiImageUrl = (window as any).__scenarioCardImageCache?.[sessionDetails.card_id] ?? null;
                  }
                }
                const processedAiAvatarSrc = getImageUrl(aiImageUrl ?? null) || DEFAULT_BOT_AVATAR;
              return (
                <div key={msg.id}>
                  <div
                    className={`rounded-2xl ${
                      msg.sender_type === "USER"
                        ? "bg-app-surface text-white"
                        : "bg-app-surface text-gray-100"
                    } relative`}
                  >
                    <div className="p-3 flex">
                      <div className="flex-shrink-0 w-20 mr-3">
                        <img
                          src={msg.sender_type === "USER"
                            ? getImageUrl(msg.active_persona_image_url ?? activePersonaImageUrl) || DEFAULT_USER_AVATAR
                            : processedAiAvatarSrc}
                          alt={msg.sender_type === "USER" ? "User" : aiName || "AI"}
                          className="w-full h-auto max-h-32 object-cover rounded-md bg-gray-700"
                          onError={(e) => {
                            const fallback =
                              msg.sender_type === "USER"
                                ? DEFAULT_USER_AVATAR
                                : DEFAULT_BOT_AVATAR;
                            (e.target as HTMLImageElement).src = fallback;
                            console.error(
                              `ERROR: Failed to load image for message ${msg.id}. Fallback used. Original URL: ${processedAiAvatarSrc}`
                            );
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
                        {/* Message content with custom formatting, no markdown */}
                        <div className="break-words mt-0">
                          {msg.content.split(/(```[\s\S]*?```|\n)/g).map((part, idx, arr) => {
                            // Remove leading line breaks for the first paragraph
                            if (idx === 0) part = part.replace(/^\n+/, '');
                            if (part.startsWith('```') && part.endsWith('```')) {
                              // Code block
                              const code = part.slice(3, -3).replace(/^\n|\n$/g, '');
                              // Remove top margin for the first code block
                              const preClass = idx === 0 ? "bg-black text-white rounded-md p-3 mb-2 overflow-x-auto text-sm" : "bg-black text-white rounded-md p-3 my-2 overflow-x-auto text-sm";
                              return (
                                <pre key={idx} className={preClass}>
                                  <code>{code}</code>
                                </pre>
                              );
                            } else if (part === '\n') {
                              // Only render <br> if not the first element and previous part is not a code block
                              if (idx === 0) return null;
                              const prev = arr[idx - 1] || '';
                              if (prev.startsWith('```') && prev.endsWith('```')) return null;
                              return <br key={idx} />;
                            } else {
                              // Inline text, apply custom formatting for quoted and italic text
                              let formatted = part
                                .replace(/"([^"]+)"/g, '<span class="text-app-chat">$1</span>')
                                .replace(/\*([^*]+)\*/g, '<em>$1</em>');
                              // Remove top margin for the first inline text
                              return <span key={idx} style={idx === 0 ? { marginTop: 0 } : {}} dangerouslySetInnerHTML={{ __html: formatted }} />;
                            }
                          })}
                        </div>
                      </div>
                    </div>
                    {msg.sender_type === "AI" &&
                      msg.ai_responses &&
                      msg.ai_responses.length > 0 &&
                      (msg.is_beginning_message ? (
                        // For beginning messages: show arrows only if more than one beginning message exists
                        allBeginningMessages.length > 1 && (
                          <div className="absolute top-2 right-2 flex items-center space-x-1 text-gray-400 text-sm">
                            <ArrowBackIcon
                              className="!text-lg"
                              onClick={() => handleNavigateBeginningMessage("prev")}
                              disabled={currentBeginningMessageIndex === 0}
                            />
                            <span>{`${currentBeginningMessageIndex + 1}/${allBeginningMessages.length}`}</span>
                            <ArrowForwardIcon
                              className="!text-lg"
                              onClick={() => handleNavigateBeginningMessage('next')}
                              disabled={currentBeginningMessageIndex === allBeginningMessages.length - 1}
                            />
                          </div>
                        )
                      ) : (
                        // For regular AI messages: show arrows if more than one response, allow regeneration
                        <div className="absolute top-2 right-2 flex items-center space-x-1 text-gray-400 text-sm">
                          {msg.current_response_index !== 0 && (
                            <ArrowBackIcon className="!text-lg" onClick={() => handleNavigateResponse(msg.id, 'prev')} />
                          )}
                          <span>{`${(msg.current_response_index || 0) + 1}/${msg.ai_responses!.length}`}</span>
                          <ArrowForwardIcon
                            className="!text-lg"
                            onClick={() => {
                              if ((msg.current_response_index || 0) === msg.ai_responses!.length - 1) {
                                handleRegenerate(msg.id);
                              } else {
                                handleNavigateResponse(msg.id, 'next');
                              }
                            }}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
            {/* End of messages map */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
      {/* Input area */}
      <div
        ref={inputAreaRef}
        className="flex justify-center px-4 bg-app-bg" // removed border-t to fix white line
      >
        <div className="w-full py-2">
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
              className="absolute right-3 top-1 transform text-white font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center"
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
}

export default ChatPage;
