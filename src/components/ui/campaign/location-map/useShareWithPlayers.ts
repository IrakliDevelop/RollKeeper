'use client';

import { useCallback, useEffect, useState } from 'react';

import { useActiveBattleMapId } from '@/hooks/useActiveBattleMapId';
import { useDmBattleMapSync } from '@/hooks/useDmBattleMapSync';

/**
 * "Share with players" toggle state, hydrated from server truth. The
 * activeBattleMapId is a single per-campaign value whose only writer used
 * to be this toggle — and the toggle booted as `useState(false)` with no
 * hydration, so a map shared in an earlier session stayed silently live
 * while the editor showed "not shared" (with two same-named maps, players
 * joined the stale one and the matching banner name masked it). Hydration:
 * ON iff the server's active id IS this map. The click stays optimistic;
 * useActiveBattleMapId's poll (60s + visibilitychange) reconciles later
 * drift, e.g. start-combat auto-share from the encounter tab. A poll
 * response in flight across a toggle can flip the state back for one
 * cycle; the next poll self-corrects.
 */
export function useShareWithPlayers(
  campaignCode: string,
  dmId: string,
  location: { id: string; name: string },
  enabled: boolean
): {
  sharedWithPlayers: boolean;
  handleToggleShareWithPlayers: () => void;
} {
  const { pushActive } = useDmBattleMapSync(campaignCode, dmId);
  const [sharedWithPlayers, setSharedWithPlayers] = useState(false);
  const activeBattleMapId = useActiveBattleMapId(enabled ? campaignCode : null);

  useEffect(() => {
    if (!enabled) return;
    setSharedWithPlayers(activeBattleMapId === location.id);
  }, [enabled, activeBattleMapId, location.id]);

  const handleToggleShareWithPlayers = useCallback(() => {
    setSharedWithPlayers(prev => {
      const next = !prev;
      void pushActive(
        next ? location.id : null,
        next ? location.name : undefined
      );
      return next;
    });
  }, [pushActive, location.id, location.name]);

  return { sharedWithPlayers, handleToggleShareWithPlayers };
}
