import { useEffect } from 'react';
import { useCharacterStore } from '@/store/characterStore';

/**
 * Hook to ensure components wait for Zustand store hydration before rendering
 * This prevents hydration mismatches between server and client
 */
export function useHydration() {
  const hasHydrated = useCharacterStore((state) => state.hasHydrated);

  useEffect(() => {
    // Set hasHydrated to true after initial render to prevent hydration mismatches
    // The onRehydrateStorage callback will have already run if there was stored data
    if (!hasHydrated) {
      const timer = setTimeout(() => {
        useCharacterStore.setState({ hasHydrated: true });
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [hasHydrated]);

  return hasHydrated;
} 