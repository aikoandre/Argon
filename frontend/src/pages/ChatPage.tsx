// frontend/src/pages/ChatPage.tsx
import React, { useState, useEffect, type FormEvent, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getChatSessionMessages,
  addMessageToSession,
  getChatSessionDetails,
  getUserSettings,
  getUserPersonaById,
  getCharacterCardById, // Import for character card details
  getScenarioCardById, // Import for scenario card details
} from "../services/api";
import {
  type ChatMessageData as ApiChatMessageData,
  type ChatSessionData,
} from "../services/api";
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw'; // eslint-disable-line @typescript-eslint/ban-ts-comment

// Extend ChatMessageData for frontend use to include multiple AI responses and navigation state
interface ChatMessageData extends ApiChatMessageData {
  ai_responses?: { content: string; timestamp: string }[];
  current_response_index?: number;
  user_message_id?: string; // To link AI responses back to the user message that prompted them
  is_beginning_message?: boolean; // To identify initial messages from character/scenario cards
}

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

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

        setMessages(msgs.map(msg => {
          if (msg.sender_type === "AI") {
            // For regular AI messages, initialize with current content as the first response
            return {
              ...msg,
              ai_responses: [{ content: msg.content, timestamp: msg.timestamp }],
              current_response_index: 0,
            };
          }
          return msg;
        }));
        setSessionDetails(details);

        // Logic to handle beginning messages if chat is new
        if (msgs.length === 0 && details && !hasSentBeginningMessageRef.current) {
          let fetchedBeginningMessages: string[] = [];
          let senderName: string | null = null;
          let senderImageUrl: string | null = null;

          if (details.card_type === "character" && details.card_id) {
            const character = await getCharacterCardById(details.card_id);
            if (character.beginning_messages && character.beginning_messages.length > 0) {
              fetchedBeginningMessages = character.beginning_messages;
              senderName = character.name;
              senderImageUrl = character.image_url ?? null;
            }
          } else if (details.card_type === "scenario" && details.card_id) {
            const scenario = await getScenarioCardById(details.card_id);
            if (scenario.beginning_message && scenario.beginning_message.length > 0) {
              fetchedBeginningMessages = scenario.beginning_message;
              senderName = scenario.name;
              senderImageUrl = scenario.image_url ?? null;
            }
          }

          if (fetchedBeginningMessages.length > 0) {
            setAllBeginningMessages(fetchedBeginningMessages);
            setCurrentBeginningMessageIndex(0); // Start with the first beginning message

            // Construct the initial message for the frontend state
            const initialBeginningMessage: ChatMessageData = {
              id: `beginning-message-${Date.now()}`, // Unique ID for this frontend-only message
              chat_session_id: chatId!,
              sender_type: "AI",
              content: fetchedBeginningMessages[0], // Display the first message
              timestamp: new Date().toISOString(),
              is_beginning_message: true, // Mark as beginning message
              active_persona_name: senderName,
              active_persona_image_url: senderImageUrl,
              // No ai_responses needed here, as navigation is handled by currentBeginningMessageIndex
            };
            setMessages([initialBeginningMessage]);
            hasSentBeginningMessageRef.current = true; // Mark that the initial message has been set
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

  const handleSendMessage = async (e: FormEvent, regenerateMessageId?: string) => {
    e.preventDefault();
    if (!newMessage.trim() && !regenerateMessageId) return; // Ensure there's content or it's a regeneration request

    setIsSending(true);
    setError(null);

    let userMessageContent = newMessage.trim();
    let userMessageToRegenerate: ChatMessageData | undefined;

    if (regenerateMessageId) {
      // Find the user message associated with the AI message to regenerate
      const aiMessageIndex = messages.findIndex(msg => msg.id === regenerateMessageId);
      if (aiMessageIndex > -1) {
        // Assuming the user message is the one immediately preceding the AI message
        // This logic might need refinement if messages can be reordered or if there are system messages in between
        const potentialUserMessage = messages[aiMessageIndex - 1];
        if (potentialUserMessage && potentialUserMessage.sender_type === "USER") {
          userMessageToRegenerate = potentialUserMessage;
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
      const userMessage: ChatMessageData = {
        id: tempMessageId,
        chat_session_id: chatId!,
        sender_type: "USER",
        content: userMessageContent,
        timestamp: new Date().toISOString(),
        message_metadata: activePersonaId && activePersonaId !== "" ? { active_persona_id: activePersonaId, active_persona_name: activePersonaName } : undefined,
        active_persona_name: activePersonaName,
        active_persona_image_url: activePersonaImageUrl,
      };
      setMessages((prevMessages) => [...prevMessages, userMessage]);
    }

    const currentMessageContent = newMessage.trim();
    setNewMessage(""); // Clear input only if it's a new message

    try {
      // Determine if this is the first user message after a beginning message
      const isFirstUserMessageAfterBeginning = messages.length === 1 && messages[0].is_beginning_message;

      const aiResponseMessage = await addMessageToSession(chatId!, {
        content: userMessageContent, // Always send the user's message content
        sender_type: "USER",
        user_persona_id: activePersonaId || undefined,
        message_metadata: activePersonaId && activePersonaId !== "" ? { active_persona_id: activePersonaId, active_persona_name: activePersonaName } : undefined,
        active_persona_name: activePersonaName,
        active_persona_image_url: activePersonaImageUrl,
        // Pass current_beginning_message_index only if it's the first user message after a beginning message
        current_beginning_message_index: isFirstUserMessageAfterBeginning ? currentBeginningMessageIndex : undefined,
      });

      setMessages((prevMessages) => {
        if (regenerateMessageId) {
          // Find the AI message to update
          return prevMessages.map((msg) => {
            if (msg.id === regenerateMessageId && msg.sender_type === "AI") {
              const updatedResponses = [...(msg.ai_responses || [{ content: msg.content, timestamp: msg.timestamp }]), { content: aiResponseMessage.content, timestamp: aiResponseMessage.timestamp }];
              return {
                ...msg,
                content: aiResponseMessage.content, // Update current content
                timestamp: aiResponseMessage.timestamp, // Update timestamp to latest
                ai_responses: updatedResponses,
                current_response_index: updatedResponses.length - 1, // Show the new response
              };
            }
            return msg;
          });
        } else {
          // Add new AI message, linking it to the user message that just sent
          const updatedAiMessage: ChatMessageData = {
            ...aiResponseMessage,
            ai_responses: [{ content: aiResponseMessage.content, timestamp: aiResponseMessage.timestamp }],
            current_response_index: 0,
            user_message_id: tempMessageId, // Link to the user message
          };
          return [...prevMessages, updatedAiMessage];
        }
      });
    } catch (err) {
      setError("Failed to send message. Please try again.");
      if (!regenerateMessageId) {
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== tempMessageId)
        );
        setNewMessage(currentMessageContent);
      }
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
                } relative`}
              >
                <div className="p-3 flex">
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
                      rehypePlugins={[rehypeRaw as any]}
                    >
                      {applyCustomFormatting(msg.content)}
                    </ReactMarkdown>
                  </div>
                </div>
                {msg.sender_type === "AI" && msg.ai_responses && msg.ai_responses.length > 0 && (
                  // Conditional rendering for navigation arrows based on message type
                  msg.is_beginning_message ? (
                    // For beginning messages: show arrows only if more than one beginning message exists
                    allBeginningMessages.length > 1 && (
                      <div className="absolute top-2 right-2 flex items-center space-x-1 text-gray-400 text-sm">
                        <ArrowBackIcon
                          className="!text-lg"
                          onClick={() => handleNavigateBeginningMessage('prev')}
                          // Disable if at the first beginning message
                          disabled={currentBeginningMessageIndex === 0}
                        />
                        <span>{`${currentBeginningMessageIndex + 1}/${allBeginningMessages.length}`}</span>
                        <ArrowForwardIcon
                          className="!text-lg"
                          onClick={() => handleNavigateBeginningMessage('next')}
                          // Disable if at the last beginning message (no regeneration)
                          disabled={currentBeginningMessageIndex === allBeginningMessages.length - 1}
                        />
                      </div>
                    )
                  ) : (
                    // For regular AI messages: show arrows if more than one response, allow regeneration
                    <div className="absolute top-2 right-2 flex items-center space-x-1 text-gray-400 text-sm">
                      {/* Show left arrow only if not the first response */}
                      {msg.current_response_index !== 0 && (
                        <ArrowBackIcon className="!text-lg" onClick={() => handleNavigateResponse(msg.id, 'prev')} />
                      )}
                      <span>{`${(msg.current_response_index || 0) + 1}/${msg.ai_responses!.length}`}</span>
                      {/* Right arrow always shown, but its action depends on current index */}
                      <ArrowForwardIcon
                        className="!text-lg"
                        onClick={() => {
                          if ((msg.current_response_index || 0) === msg.ai_responses!.length - 1) {
                            handleRegenerate(msg.id); // Generate new response if at the last one
                          } else {
                            handleNavigateResponse(msg.id, 'next'); // Navigate to next existing response
                          }
                        }}
                      />
                    </div>
                  )
                )}
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
