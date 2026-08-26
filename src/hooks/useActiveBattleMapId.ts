import { useCallback, useEffect, useRef, useState } from 'react';

import type { SharedCampaignState } from '@/types/sharedState';

const POLL_INTERVAL_MS = 60_000;

/**
 * Discovers which battle map is currently active (shared live with
 * players) for a campaign, by slow-polling the shared-state endpoint from
 * the DM side.
 *
 * This is deliberately NOT the same as `useSharedCampaignState` /
 * `useBattleMapPokes`'s data-freshness guarantee — this hook only exists to
 * learn *which room to poke-listen on* (`battleMapId`). The actual
 * low-latency data (player HP, initiative, etc.) arrives via the poke
 * listener itself once the room is known; a battle map is normally
 * activated well before combat starts, so a 60s discovery latency here is
 * acceptable. Silent on failure — keeps the last known id and lets the next
 * tick retry.
 *
 * `GET /api/campaign/[code]/shared` has no DM-authority check for reads
 * (it's keyed only by campaign code); `role=dm` is sent for semantic
 * correctness, matching the DM identity that owns this page, even though
 * the route does not require a `dmId` for GET.
 */
export function useActiveBattleMapId(
  campaignCode: string | null
): string | null {
  const [activeBattleMapId, setActiveBattleMapId] = useState<string | null>(
    null
  );
  const mountedRef = useRef(true);

  const fetchActiveId = useCallback(async () => {
    if (!campaignCode) return;
    try {
      const res = await fetch(`/api/campaign/${campaignCode}/shared?role=dm`);
      if (!res.ok) return;
      const data: SharedCampaignState = await res.json();
      if (!mountedRef.current) return;
      setActiveBattleMapId(data.battleMap?.activeBattleMapId ?? null);
    } catch {
      // Silent failure — keep last known id; polling/visibility will retry.
    }
  }, [campaignCode]);

  useEffect(() => {
    mountedRef.current = true;

    if (!campaignCode) {
      setActiveBattleMapId(null);
      return;
    }

    fetchActiveId();
    const intervalId = setInterval(fetchActiveId, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) fetchActiveId();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [campaignCode, fetchActiveId]);

  return activeBattleMapId;
}
