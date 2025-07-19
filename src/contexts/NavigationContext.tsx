'use client';

import { createContext, useContext } from 'react';

// Navigation context for tab switching
interface NavigationContextType {
  switchToTab: (tabId: string) => void;
}

export const NavigationContext = createContext<NavigationContextType | null>(null);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationContext');
  }
  return context;
}; 