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
export const TABLE_V1_SHARE_DISABLED_REASON =
  'Join-banner sharing is managed by Table scenes while Table v1 is enabled';

export function useShareWithPlayers(
  campaignCode: string,
  dmId: string,
  location: { id: string; name: string },
  enabled: boolean
): {
  sharedWithPlayers: boolean;
  handleToggleShareWithPlayers: () => void;
  /** PR04 P9: set when this toggle cannot change the join banner. */
  shareDisabledReason: string | null;
} {
  // PR04 P9: under Table v1 the server owns the join-banner pointer; this
  // legacy toggle never flips optimistically to "Live for players".
  const tableV1 = process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED === 'true';
  const active = enabled && !tableV1;
  const { pushActive } = useDmBattleMapSync(campaignCode, dmId);
  const [sharedWithPlayers, setSharedWithPlayers] = useState(false);
  const activeBattleMapId = useActiveBattleMapId(active ? campaignCode : null);

  useEffect(() => {
    if (!active) return;
    setSharedWithPlayers(activeBattleMapId === location.id);
  }, [active, activeBattleMapId, location.id]);

  const handleToggleShareWithPlayers = useCallback(() => {
    if (tableV1) return;
    setSharedWithPlayers(prev => {
      const next = !prev;
      void pushActive(
        next ? location.id : null,
        next ? location.name : undefined
      );
      return next;
    });
  }, [tableV1, pushActive, location.id, location.name]);

  return {
    sharedWithPlayers: tableV1 ? false : sharedWithPlayers,
    handleToggleShareWithPlayers,
    shareDisabledReason: tableV1 ? TABLE_V1_SHARE_DISABLED_REASON : null,
  };
}
