import { useCallback } from 'react';
import type { SharedBattleMapState } from '@/types/sharedState';

export type PushActiveResult =
  | { ok: true }
  /** `status` 0 = network failure. */
  | { ok: false; status: number }
  /** Table v1: the join banner follows Table presentation; nothing sent. */
  | { ok: false; reason: 'table-v1' };

/** DM-side: publish/clear the "battle map is live" flag for players. */
export function useDmBattleMapSync(campaignCode: string, dmId: string) {
  const pushActive = useCallback(
    async (
      battleMapId: string | null,
      name?: string
    ): Promise<PushActiveResult> => {
      // PR04 P9: under Table v1 the server rejects this legacy writer (426);
      // presentation is changed only through the Table control session.
      if (process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED === 'true')
        return { ok: false, reason: 'table-v1' };
      const data: SharedBattleMapState = {
        activeBattleMapId: battleMapId,
        name,
        updatedAt: new Date().toISOString(),
      };
      try {
        const response = await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rollkeeper-csrf': '1',
          },
          body: JSON.stringify({ feature: 'battlemap', data, dmId }),
        });
        if (!response.ok) {
          console.warn(
            `Battle map activation was rejected (${response.status})`
          );
          return { ok: false, status: response.status };
        }
        return { ok: true };
      } catch (err) {
        console.warn('Failed to push battle map activation:', err);
        return { ok: false, status: 0 };
      }
    },
    [campaignCode, dmId]
  );

  return { pushActive };
}
