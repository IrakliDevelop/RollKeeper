import { useEffect } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';

/**
 * Hook to ensure components wait for Zustand store hydration before rendering
 * This prevents hydration mismatches between server and client
 */
export function useHydration() {
  const hasHydrated = useCharacterStore(state => state.hasHydrated);

  useEffect(() => {
    if (hasHydrated) return;

    const markHydrated = () =>
      useCharacterStore.setState({ hasHydrated: true });
    const unsubscribe = usePlayerStore.persist.onFinishHydration(markHydrated);
    if (usePlayerStore.persist.hasHydrated()) markHydrated();

    return unsubscribe;
  }, [hasHydrated]);

  return hasHydrated;
}
