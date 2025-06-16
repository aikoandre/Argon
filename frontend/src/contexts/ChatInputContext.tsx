// frontend/src/contexts/ChatInputContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

interface ChatInputContextType {
  isSending: boolean;
  setIsSending: (sending: boolean) => void;
  isProcessingMemory: boolean;
  setIsProcessingMemory: (processing: boolean) => void;
  disabled: boolean;
  setDisabled: (disabled: boolean) => void;
  sendMessage: (message: string) => void;
  setSendMessageHandler: (handler: (message: string) => void) => void;
  cancelMessage: () => void;
  setCancelMessageHandler: (handler: () => void) => void;
}

const ChatInputContext = createContext<ChatInputContextType | null>(null);

export const useChatInput = () => {
  const context = useContext(ChatInputContext);
  if (!context) {
    throw new Error('useChatInput must be used within a ChatInputProvider');
  }
  return context;
};

interface ChatInputProviderProps {
  children: React.ReactNode;
}

export const ChatInputProvider: React.FC<ChatInputProviderProps> = ({ children }) => {
  const [isSending, setIsSending] = useState(false);
  const [isProcessingMemory, setIsProcessingMemory] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [messageHandler, setMessageHandler] = useState<((message: string) => void) | null>(null);
  const [cancelHandler, setCancelHandler] = useState<(() => void) | null>(null);

  const sendMessage = useCallback((message: string) => {
    if (messageHandler && !disabled && !isSending && !isProcessingMemory) {
      messageHandler(message);
    }
  }, [messageHandler, disabled, isSending, isProcessingMemory]);

  const setSendMessageHandler = useCallback((handler: (message: string) => void) => {
    setMessageHandler(() => handler);
  }, []);

  const cancelMessage = useCallback(() => {
    if (cancelHandler && (isSending || isProcessingMemory)) {
      cancelHandler();
    }
  }, [cancelHandler, isSending, isProcessingMemory]);

  const setCancelMessageHandler = useCallback((handler: () => void) => {
    setCancelHandler(() => handler);
  }, []);

  const value = {
    isSending,
    setIsSending,
    isProcessingMemory,
    setIsProcessingMemory,
    disabled,
    setDisabled,
    sendMessage,
    setSendMessageHandler,
    cancelMessage,
    setCancelMessageHandler,
  };

  return (
    <ChatInputContext.Provider value={value}>
      {children}
    </ChatInputContext.Provider>
  );
};
