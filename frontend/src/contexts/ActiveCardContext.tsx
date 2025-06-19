// frontend/src/contexts/ActiveCardContext.tsx
import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface ActiveCard {
  type: 'character' | 'scenario' | 'persona' | null;
  id?: string;
  name?: string;
  image?: string;
  description?: string;
}

interface ActiveCardContextType {
  activeCard: ActiveCard;
  setActiveCard: (card: ActiveCard) => void;
  clearActiveCard: () => void;
}

const ActiveCardContext = createContext<ActiveCardContextType | undefined>(undefined);

export const useActiveCard = () => {
  const context = useContext(ActiveCardContext);
  if (context === undefined) {
    throw new Error('useActiveCard must be used within an ActiveCardProvider');
  }
  return context;
};

interface ActiveCardProviderProps {
  children: ReactNode;
}

export const ActiveCardProvider: React.FC<ActiveCardProviderProps> = ({ children }) => {
  const [activeCard, setActiveCardState] = useState<ActiveCard>({
    type: null,
    id: undefined,
    name: undefined,
    image: undefined,
    description: undefined
  });

  const setActiveCard = (card: ActiveCard) => {
    setActiveCardState(card);
  };

  const clearActiveCard = () => {
    setActiveCardState({
      type: null,
      id: undefined,
      name: undefined,
      image: undefined,
      description: undefined
    });
  };

  return (
    <ActiveCardContext.Provider value={{ activeCard, setActiveCard, clearActiveCard }}>
      {children}
    </ActiveCardContext.Provider>
  );
};
