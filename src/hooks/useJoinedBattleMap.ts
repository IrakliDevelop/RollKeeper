import { useCallback, useState } from 'react';

const STORAGE_KEY = 'rollkeeper-joined-battlemap';

/** Records that the player has joined the given live battle map (also called
 * by the VTT page on mount so deep links count as joining). */
export function markBattleMapJoined(battleMapId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, battleMapId);
  } catch {
    // storage unavailable — banner simply stays visible
  }
}

/**
 * Whether the player has already joined the currently-live battle map.
 * The full-width "Join map" banner is only shown until then; afterwards the
 * map stays reachable via the initiative panel / a compact pill.
 * A DIFFERENT live map id makes the banner reappear.
 */
export function useJoinedBattleMap(battleMapId: string | null | undefined): {
  joined: boolean;
  markJoined: () => void;
} {
  const [joinedId, setJoinedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const markJoined = useCallback(() => {
    if (!battleMapId) return;
    markBattleMapJoined(battleMapId);
    setJoinedId(battleMapId);
  }, [battleMapId]);

  return { joined: !!battleMapId && joinedId === battleMapId, markJoined };
}
