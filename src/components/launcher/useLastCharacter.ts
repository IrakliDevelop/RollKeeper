'use client';

import { useMemo } from 'react';
import { useHydration } from '@/hooks/useHydration';
import { usePlayerStore, type PlayerCharacter } from '@/store/playerStore';

/** The character played most recently on this device, once the roster has loaded. */
export function useLastCharacter(): PlayerCharacter | null {
  const hydrated = useHydration();
  const characters = usePlayerStore(state => state.characters);
  return useMemo(() => {
    if (!hydrated || !characters) return null;
    const active = characters.filter(c => !c.isArchived);
    if (active.length === 0) return null;
    return active.reduce((latest, c) =>
      new Date(c.lastPlayed).getTime() > new Date(latest.lastPlayed).getTime()
        ? c
        : latest
    );
  }, [hydrated, characters]);
}
