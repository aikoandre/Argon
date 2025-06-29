// frontend/src/components/ChatInput/ChatInput.tsx
import React, { useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "motion/react";

// Material Icon component
const MaterialIcon = ({ icon, className = "" }: { icon: string; className?: string }) => (
  <span className={`material-icons-outlined text-2xl select-none leading-none ${className}`}>{icon}</span>
);

const SendIcon = ({ className }: { className?: string }) => (
  <MaterialIcon icon="send_outlined" className={className} />
);

const PauseIcon = ({ className }: { className?: string }) => (
  <MaterialIcon icon="pause_outlined" className={className} />
);

interface ChatInputProps {
  onSendMessage?: (message: string) => void;
  onCancelMessage?: () => void;
  disabled?: boolean;
  isSending?: boolean;
  isProcessingMemory?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onCancelMessage, 
  disabled = false, 
  isSending = false,
  isProcessingMemory = false 
}) => {
  const location = useLocation();
  const [newMessage, setNewMessage] = useState("");

  // Extract chatId directly from pathname since useParams doesn't work outside route context
  const chatId = location.pathname.startsWith('/chat/') ? location.pathname.split('/chat/')[1] : null;
  
  // Check if we're on a chat page to determine if sending is allowed
  const isChatPage = location.pathname.startsWith('/chat/') && chatId;
  const canSend = isChatPage && !disabled && !isSending && !isProcessingMemory;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !canSend) return;
    
    onSendMessage?.(newMessage.trim());
    setNewMessage("");
  };

  const handleCancel = () => {
    onCancelMessage?.();
  };

  // Always render and allow typing, but conditionally allow sending
  return (
    <div className="w-full">
      <div className="w-full">
        <form onSubmit={handleSubmit} className="relative">
          <motion.textarea
            rows={1}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              // Auto-resize logic
              const ta = e.target as HTMLTextAreaElement;
              ta.style.height = 'auto';
              ta.style.height = ta.scrollHeight + 'px';
            }}
            placeholder={
              isProcessingMemory 
                ? "Processing memory updates..." 
                : isChatPage 
                  ? "Type a message... (Use {{char}} and {{user}} as placeholders)" 
                  : "Select a chat to start messaging"
            }
            disabled={isSending || isProcessingMemory}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            className={`
              w-full p-2 pr-16 bg-app-bg border-4 border-app-border rounded-lg text-app-text 
              placeholder-gray-400 border-2 border-app-border focus:outline-none resize-none overflow-hidden
            `}
          />
          <motion.button
            type={isProcessingMemory ? "button" : "submit"}
            onClick={isProcessingMemory ? handleCancel : undefined}
            disabled={!isChatPage || (!(canSend && newMessage.trim()) && !isProcessingMemory)}
            className={`
              absolute right-1 top-1/2 transform -translate-y-6 text-white font-bold p-2 rounded-lg 
              w-10 h-10 flex items-center justify-center transition-colors duration-200
              ${(canSend && newMessage.trim()) || isProcessingMemory
                ? 'hover:bg-app-primary/20 opacity-100' 
                : 'opacity-50 cursor-not-allowed'
              }
            `}
          >
            {isSending ? (
              <motion.span 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="text-xl leading-none"
              >
                ⟳
              </motion.span>
            ) : isProcessingMemory ? (
              <PauseIcon className="w-5 h-5 leading-none" />
            ) : (
              <SendIcon className="w-5 h-5 leading-none" />
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;
