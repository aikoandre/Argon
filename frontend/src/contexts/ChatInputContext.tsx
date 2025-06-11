// frontend/src/contexts/ChatInputContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

interface ChatInputContextType {
  isSending: boolean;
  setIsSending: (sending: boolean) => void;
  disabled: boolean;
  setDisabled: (disabled: boolean) => void;
  sendMessage: (message: string) => void;
  setSendMessageHandler: (handler: (message: string) => void) => void;
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
  const [disabled, setDisabled] = useState(false);
  const [messageHandler, setMessageHandler] = useState<((message: string) => void) | null>(null);

  const sendMessage = useCallback((message: string) => {
    if (messageHandler && !disabled && !isSending) {
      messageHandler(message);
    }
  }, [messageHandler, disabled, isSending]);

  const setSendMessageHandler = useCallback((handler: (message: string) => void) => {
    setMessageHandler(() => handler);
  }, []);

  const value = {
    isSending,
    setIsSending,
    disabled,
    setDisabled,
    sendMessage,
    setSendMessageHandler,
  };

  return (
    <ChatInputContext.Provider value={value}>
      {children}
    </ChatInputContext.Provider>
  );
};
