import { useCallback } from 'react';
import type { SharedBattleMapState } from '@/types/sharedState';

/** DM-side: publish/clear the "battle map is live" flag for players. */
export function useDmBattleMapSync(campaignCode: string, dmId: string) {
  const pushActive = useCallback(
    async (battleMapId: string | null, name?: string) => {
      const data: SharedBattleMapState = {
        activeBattleMapId: battleMapId,
        name,
        updatedAt: new Date().toISOString(),
      };
      try {
        await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature: 'battlemap', data, dmId }),
        });
      } catch (err) {
        console.warn('Failed to push battle map activation:', err);
      }
    },
    [campaignCode, dmId]
  );

  return { pushActive };
}
