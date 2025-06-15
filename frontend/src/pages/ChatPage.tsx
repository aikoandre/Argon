// frontend/src/pages/ChatPage.tsx
import { useState, useEffect, useRef, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";
import { useChatInput } from "../contexts/ChatInputContext";
import { useLayout } from "../contexts/LayoutContext";
import { LeftPanelImage } from "../components/Layout";
import { CharacterEditPanel, ScenarioEditPanel } from "../components/Editing";
import {
  getChatSessionMessages,
  getChatSessionDetails,
  getUserSettings,
  getUserPersonaById,
  updateUserSettings, // Added for clearing active persona on 404
  getCharacterCardById, // Import for character card details
  getScenarioCardById, // Import for scenario card details
  addMessageToSession, // Import addMessageToSession for sending messages
  updateCharacterCard, // Import for updating character cards
  updateScenarioCard, // Import for updating scenario cards
  getAllMasterWorlds, // Import for fetching master worlds for scenario editing
} from "../services/api";
import { type ChatSessionData } from "../services/api"; // ChatSessionData is from api.ts
import { type ChatMessageData } from "../types/chat"; // Only import ChatMessageData, remove unused types
import { replacePlaceholdersForDisplay, getCharacterName } from "../utils/placeholderUtils";
import { characterToFormData, scenarioToFormData } from "../utils/formDataHelpers";

// Default avatar images - using data URLs to avoid file serving issues for defaults
const DEFAULT_USER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
const DEFAULT_BOT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cpath d='M8 9.05v-.1'%3E%3C/path%3E%3Cpath d='M16 9.05v-.1'%3E%3C/path%3E%3Cpath d='M12 13a4 4 0 0 1-4 4'%3E%3C/path%3E%3Cpath d='M12 13a4 4 0 0 0 4 4'%3E%3C/path%3E%3C/svg%3E";

// Modern Material Icons components using TailwindCSS
const MaterialIcon = ({ icon, className = "", onClick, disabled = false }: {
  icon: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <span 
    className={`
      material-icons-outlined text-2xl select-none
      ${onClick ? 'cursor-pointer' : ''}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      ${className}
    `}
    onClick={disabled ? undefined : onClick}
  >
    {icon}
  </span>
);

// Icon components using the new MaterialIcon
const ArrowBackIcon = ({ className, onClick, disabled }: { 
  className?: string; 
  onClick: () => void; 
  disabled?: boolean 
}) => (
  <MaterialIcon 
    icon="arrow_back_ios" 
    className={className} 
    onClick={onClick} 
    disabled={disabled} 
  />
);

const ArrowForwardIcon = ({ className, onClick, disabled }: { 
  className?: string; 
  onClick: () => void; 
  disabled?: boolean 
}) => (
  <MaterialIcon 
    icon="arrow_forward_ios" 
    className={className} 
    onClick={onClick} 
    disabled={disabled} 
  />
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

const ChatPage = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { setSendMessageHandler, setIsSending, setDisabled } = useChatInput();
  const { setLeftPanelVisible, setRightPanelVisible, setLeftPanelContent, setRightPanelContent } = useLayout();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sessionDetails, setSessionDetails] = useState<ChatSessionData | null>(
    null
  );
  const [newMessage, setNewMessage] = useState("");
  const [allBeginningMessages, setAllBeginningMessages] = useState<string[]>([]);
  const [currentBeginningMessageIndex, setCurrentBeginningMessageIndex] = useState<number>(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSendingLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [activePersonaName, setActivePersonaName] = useState<string>("User");
  const [activePersonaImageUrl, setActivePersonaImageUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  // State for cached card data and editing
  const [cachedCharacter, setCachedCharacter] = useState<any>(null);
  const [cachedScenario, setCachedScenario] = useState<any>(null);
  const [masterWorlds, setMasterWorlds] = useState<any[]>([]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]); // Remove streamedAiMessage from dependency

  // Load master worlds for scenario editing
  useEffect(() => {
    const fetchMasterWorlds = async () => {
      try {
        const worlds = await getAllMasterWorlds();
        setMasterWorlds(worlds);
      } catch (error) {
        console.error('Failed to load master worlds:', error);
      }
    };
    fetchMasterWorlds();
  }, []);

  // Handler for updating character card fields
  const handleCharacterFieldChange = async (field: string, value: any) => {
    if (!cachedCharacter) return;
    
    const updatedCharacter = { ...cachedCharacter, [field]: value };
    setCachedCharacter(updatedCharacter);
    
    try {
      const formData = characterToFormData(updatedCharacter);
      await updateCharacterCard(updatedCharacter.id, formData);
      
      // Update cache
      (window as any).__characterCardNameCache = (window as any).__characterCardNameCache || {};
      (window as any).__characterCardNameCache[updatedCharacter.id] = updatedCharacter.name;
      (window as any).__characterCardImageCache = (window as any).__characterCardImageCache || {};
      (window as any).__characterCardImageCache[updatedCharacter.id] = updatedCharacter.image_url || null;
      
      // Update left panel image if changed
      if (field === 'image_url' || field === 'name') {
        updateLeftPanelForCharacter(updatedCharacter);
      }
    } catch (error) {
      console.error('Failed to update character:', error);
      // Revert the optimistic update on error
      setCachedCharacter(cachedCharacter);
    }
  };

  // Handler for updating scenario card fields
  const handleScenarioFieldChange = async (field: string, value: any) => {
    if (!cachedScenario) return;
    
    const updatedScenario = { ...cachedScenario, [field]: value };
    setCachedScenario(updatedScenario);
    
    try {
      const formData = scenarioToFormData(updatedScenario);
      await updateScenarioCard(updatedScenario.id, formData);
      
      // Update cache
      (window as any).__scenarioCardNameCache = (window as any).__scenarioCardNameCache || {};
      (window as any).__scenarioCardNameCache[updatedScenario.id] = updatedScenario.name;
      (window as any).__scenarioCardImageCache = (window as any).__scenarioCardImageCache || {};
      (window as any).__scenarioCardImageCache[updatedScenario.id] = updatedScenario.image_url || null;
      
      // Update left panel image if changed
      if (field === 'image_url' || field === 'name') {
        updateLeftPanelForScenario(updatedScenario);
      }
    } catch (error) {
      console.error('Failed to update scenario:', error);
      // Revert the optimistic update on error
      setCachedScenario(cachedScenario);
    }
  };

  // Helper functions to update left panel
  const updateLeftPanelForCharacter = (character: any) => {
    if (character.image_url) {
      const cacheBuster = character.updated_at 
        ? `?cb=${encodeURIComponent(character.updated_at)}`
        : `?cb=${character.id}`;
      setLeftPanelContent(
        <LeftPanelImage
          src={`${character.image_url}${cacheBuster}`}
          alt={character.name}
        />
      );
    } else {
      setLeftPanelContent(null);
    }
  };

  const updateLeftPanelForScenario = (scenario: any) => {
    if (scenario.image_url) {
      const cacheBuster = scenario.updated_at 
        ? `?cb=${encodeURIComponent(scenario.updated_at)}`
        : `?cb=${scenario.id}`;
      setLeftPanelContent(
        <LeftPanelImage
          src={`${scenario.image_url}${cacheBuster}`}
          alt={scenario.name}
        />
      );
    } else {
      setLeftPanelContent(null);
    }
  };

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

        // Set up panels and cache card data
        let cachedCharacter = null;
        let cachedScenario = null;
        
        if (details) {
          if (details.card_type === 'character' && details.card_id) {
            cachedCharacter = await getCharacterCardById(details.card_id);
            setCachedCharacter(cachedCharacter);
            (window as any).__characterCardNameCache = (window as any).__characterCardNameCache || {};
            (window as any).__characterCardNameCache[details.card_id] = cachedCharacter.name;
            (window as any).__characterCardImageCache = (window as any).__characterCardImageCache || {};
            (window as any).__characterCardImageCache[details.card_id] = cachedCharacter.image_url || null;
          } else if (details.card_type === 'scenario' && details.card_id) {
            cachedScenario = await getScenarioCardById(details.card_id);
            setCachedScenario(cachedScenario);
            (window as any).__scenarioCardNameCache = (window as any).__scenarioCardNameCache || {};
            (window as any).__scenarioCardNameCache[details.card_id] = cachedScenario.name;
            (window as any).__scenarioCardImageCache = (window as any).__scenarioCardImageCache || {};
            (window as any).__scenarioCardImageCache[details.card_id] = cachedScenario.image_url || null;
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

        // Set up panels with card information and populate beginning messages
        if (details) {
          let fetchedBeginningMessages: string[] = [];
          
          if (details.card_type === "character" && details.card_id && cachedCharacter) {
            // Set up beginning messages
            if (cachedCharacter.beginning_messages && cachedCharacter.beginning_messages.length > 0) {
              fetchedBeginningMessages = cachedCharacter.beginning_messages;
            }
            
            // Left panel: show character image if available
            updateLeftPanelForCharacter(cachedCharacter);

            // Right panel: show character edit panel (editable in chat)
            console.log('ChatPage: Setting character edit panel in right panel', cachedCharacter.name);
            setRightPanelContent(
              <CharacterEditPanel 
                character={cachedCharacter}
                onChange={handleCharacterFieldChange} // Enable editing
                onDelete={() => {}} // Disabled in chat (delete available in character page)
                onImport={() => {}} // Disabled in chat 
                onExport={() => {}} // Disabled in chat
                onExpressions={() => {}} // Disabled in chat
                onImageChange={() => {}} // Disabled in chat (can be enhanced later)
                disabled={false} // Make it editable
              />
            );
          } else if (details.card_type === "scenario" && details.card_id && cachedScenario) {
            // Set up beginning messages
            if (cachedScenario.beginning_message && cachedScenario.beginning_message.length > 0) {
              fetchedBeginningMessages = cachedScenario.beginning_message;
            }
            
            // Left panel: show scenario image if available
            updateLeftPanelForScenario(cachedScenario);

            // Right panel: show scenario edit panel (editable in chat)
            setRightPanelContent(
              <ScenarioEditPanel 
                scenario={cachedScenario}
                masterWorlds={masterWorlds} // Pass master worlds for editing
                onChange={handleScenarioFieldChange} // Enable editing
                onDelete={() => {}} // Disabled in chat (delete available in scenario page)
                onImport={() => {}} // Disabled in chat
                onExport={() => {}} // Disabled in chat
                onExpressions={() => {}} // Disabled in chat
                onImageChange={() => {}} // Disabled in chat (can be enhanced later)
                disabled={false} // Make it editable
              />
            );
          }
          
          // Set panels visible only after content is set
          console.log('ChatPage: Final step - setting panels visible in data fetch');
          setLeftPanelVisible(true);
          setRightPanelVisible(true);
          
          setAllBeginningMessages(fetchedBeginningMessages);
          // If the first message is a beginning message, set its index
          if (msgs.length > 0 && msgs[0].is_beginning_message && msgs[0].message_metadata?.current_response_index !== undefined) {
            setCurrentBeginningMessageIndex(msgs[0].message_metadata.current_response_index);
          } else {
            setCurrentBeginningMessageIndex(0); // Default to first if not found or not a beginning message
          }
        } else {
          // Only clear panels if there's truly no session details
          console.log('ChatPage: No session details available, keeping panels but clearing content if no cached data');
          if (!cachedCharacter && !cachedScenario) {
            setLeftPanelContent(null);
            setRightPanelContent(null);
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

  // Load master worlds for scenario editing
  useEffect(() => {
    const fetchMasterWorlds = async () => {
      try {
        const worlds = await getAllMasterWorlds();
        setMasterWorlds(worlds);
      } catch (error) {
        console.error('Failed to load master worlds:', error);
      }
    };
    fetchMasterWorlds();
  }, []);

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

  // Set up chat input integration
  useEffect(() => {
    console.log('ChatPage: Setting up chat input integration', {
      chatId,
      isLoadingMessages,
      disabled: isLoadingMessages || !chatId
    });
    
    // Set the message handler for the global chat input
    setSendMessageHandler((message: string) => {
      console.log('ChatPage: Received message from chat input:', message);
      handleSendMessage({ preventDefault: () => {} } as FormEvent, undefined, message);
    });

    // Enable/disable chat input based on chat state
    setDisabled(isLoadingMessages || !chatId);

    // Cleanup on unmount
    return () => {
      setSendMessageHandler(() => {});
    };
  }, [chatId, isLoadingMessages]); // Removed setSendMessageHandler and setDisabled from deps

  // Show panels for chat pages - but only set visible after content is ready
  useEffect(() => {
    // Only set panels visible if we have cached data or if they're already visible
    if (cachedCharacter || cachedScenario || sessionDetails) {
      console.log('ChatPage: Setting panels visible after content is ready');
      setLeftPanelVisible(true);
      setRightPanelVisible(true);
    }
  }, [cachedCharacter, cachedScenario, sessionDetails, setLeftPanelVisible, setRightPanelVisible]);

  // Update panels when cached character or scenario changes
  useEffect(() => {
    if (cachedCharacter) {
      console.log('ChatPage: Updating panels for cached character:', cachedCharacter.name);
      updateLeftPanelForCharacter(cachedCharacter);
      setRightPanelContent(
        <CharacterEditPanel 
          character={cachedCharacter}
          onChange={handleCharacterFieldChange}
          onDelete={() => {}}
          onImport={() => {}}
          onExport={() => {}}
          onExpressions={() => {}}
          onImageChange={() => {}}
          disabled={false}
        />
      );
      // Set panels visible only after content is set
      setTimeout(() => {
        setLeftPanelVisible(true);
        setRightPanelVisible(true);
      }, 0);
    } else if (cachedScenario) {
      console.log('ChatPage: Updating panels for cached scenario:', cachedScenario.name);
      updateLeftPanelForScenario(cachedScenario);
      setRightPanelContent(
        <ScenarioEditPanel 
          scenario={cachedScenario}
          masterWorlds={masterWorlds}
          onChange={handleScenarioFieldChange}
          onDelete={() => {}}
          onImport={() => {}}
          onExport={() => {}}
          onExpressions={() => {}}
          onImageChange={() => {}}
          disabled={false}
        />
      );
      // Set panels visible only after content is set
      setTimeout(() => {
        setLeftPanelVisible(true);
        setRightPanelVisible(true);
      }, 0);
    }
  }, [cachedCharacter, cachedScenario, masterWorlds]);

  // Cleanup effect to preserve panels when unmounting
  useEffect(() => {
    return () => {
      // Don't clear panel content on unmount - let it persist
      console.log('ChatPage: Unmounting but preserving panel content');
    };
  }, []);

  // Sync local sending state with global state
  useEffect(() => {
    setIsSending(isSending);
  }, [isSending, setIsSending]);

  const handleSendMessage = async (e: FormEvent, regenerateMessageId?: string, messageContent?: string) => {
    e.preventDefault();
    let userMessageContent = messageContent || newMessage.trim();
    if (!userMessageContent && !regenerateMessageId) return;

    setIsSendingLocal(true);
    setError(null);

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
          setIsSendingLocal(false);
          return;
        }
      } else {
        setError("AI message to regenerate not found.");
        setIsSendingLocal(false);
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
      setIsSendingLocal(false);
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

  // Modern loading state component
  if (isLoadingMessages) {
    return (
      <div className="flex items-center justify-center h-full bg-app-bg">
        <div className="text-center text-app-text-secondary p-10">
          <div className="w-8 h-8 border-2 border-app-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Modern error state component
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-app-bg">
        <div className="text-center p-10 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="error_outline" className="text-red-600 text-3xl" />
          </div>
          <h2 className="text-xl font-semibold text-app-text mb-2">Error</h2>
          <p className="text-red-400 bg-app-surface p-4 rounded-xl shadow-lg">
            {error}
          </p>
        </div>
      </div>
    );
  }

  // Modern not found state component
  if (!sessionDetails) {
    return (
      <div className="flex items-center justify-center h-full bg-app-bg">
        <div className="text-center p-10 max-w-md">
          <div className="w-16 h-16 bg-app-surface rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="chat_bubble_outline" className="text-app-text-secondary text-3xl" />
          </div>
          <h2 className="text-xl font-semibold text-app-text mb-2">Chat Not Found</h2>
          <p className="text-app-text-secondary bg-app-surface p-4 rounded-xl shadow-lg">
            The chat session you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat messages section - scrollable area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-gray-400 hover:scrollbar-thumb-gray-300">
        <div className="w-full">
              <AnimatePresence>
                {messages.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-center items-center h-full"
                  >
                    <div className="text-center">
                      <MaterialIcon icon="chat_bubble_outline" className="text-6xl text-app-text-secondary mb-4" />
                      <p className="text-xl text-app-text-secondary font-medium">No messages yet</p>
                      <p className="text-app-border text-sm mt-2">Start a conversation!</p>
                    </div>
                  </motion.div>
                )}
                
                {/* Messages */}
                {[...messages]
                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                  .map((msg, index) => {
                    // For AI messages, always use card name/image if persona fields are missing
                    let aiName = msg.active_persona_name;
                    let aiImageUrl = msg.active_persona_image_url;
                    if (msg.sender_type === "AI") {
                      if (!aiName && sessionDetails?.card_type === 'character' && sessionDetails.card_id) {
                        aiName = (window as any).__characterCardNameCache?.[sessionDetails.card_id];
                      } else if (!aiName && sessionDetails?.card_type === 'scenario' && sessionDetails.card_id) {
                        aiName = (window as any).__scenarioCardNameCache?.[sessionDetails.card_id];
                      }
                      if (!aiImageUrl && sessionDetails?.card_type === 'character' && sessionDetails.card_id) {
                        aiImageUrl = (window as any).__characterCardImageCache?.[sessionDetails.card_id] ?? null;
                      } else if (!aiImageUrl && sessionDetails?.card_type === 'scenario' && sessionDetails.card_id) {
                        aiImageUrl = (window as any).__scenarioCardImageCache?.[sessionDetails.card_id] ?? null;
                      }
                    }
                    const processedAiAvatarSrc = getImageUrl(aiImageUrl ?? null) || DEFAULT_BOT_AVATAR;
                    
                    return (
                      <motion.div 
                        key={msg.id} 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="group w-full"
                      >
                        <div className={`
                          rounded-2xl p-4 mx-2 mt-2 relative transition-all duration-200
                          ${msg.sender_type === "USER" 
                            ? "bg-app-bg text-app-text shadow-md hover:shadow-lg" 
                            : "bg-app-bg text-app-text shadow-md hover:shadow-lg"
                          }
                        `}>
                          <div className="flex">
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
                                {(() => {
                                  // Apply placeholder replacement for display
                                  const charName = getCharacterName(sessionDetails);
                                  const userName = msg.sender_type === "USER" 
                                    ? (msg.active_persona_name || msg.message_metadata?.active_persona_name || activePersonaName)
                                    : activePersonaName;
                                  const displayContent = replacePlaceholdersForDisplay(msg.content, charName, userName);
                                  
                                  return displayContent.split(/(```[\s\S]*?```|\n)/g).map((part, idx, arr) => {
                                  // Remove leading line breaks for the first paragraph
                                  if (idx === 0) part = part.replace(/^\n+/, '');
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
                                      .replace(/"([^"]+)"/g, '<span class="text-app-primary">$1</span>')
                                      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
                                    // Remove top margin for the first inline text
                                    return <span key={idx} style={idx === 0 ? { marginTop: 0 } : {}} dangerouslySetInnerHTML={{ __html: formatted }} />;
                                  }
                                });
                                })()}
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
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
