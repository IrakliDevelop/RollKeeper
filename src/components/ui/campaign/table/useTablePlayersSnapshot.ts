'use client';

import { useCallback, useEffect, useState } from 'react';

import type { CampaignPlayer } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/buildEntity';
import type { TableCampaignPlayer } from '@/lib/table/roster';
import type { CampaignPlayerData } from '@/types/campaign';

export type TablePlayersSnapshot =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      /** Identity entries for exact verification (playerId = legacyPlayerId). */
      players: TableCampaignPlayer[];
      /** Display rows for the reused PlayerTab (id = playerId). */
      campaignPlayers: CampaignPlayer[];
    };

/**
 * Reads the server-authorized campaign players snapshot (DM-only route).
 * Identity comes only from here; names are display data, never a key.
 * Read-only: no encounter or campaign store is touched.
 */
export function useTablePlayersSnapshot(campaignCode: string): {
  snapshot: TablePlayersSnapshot;
  refresh: () => void;
} {
  const [snapshot, setSnapshot] = useState<TablePlayersSnapshot>({
    status: 'loading',
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/campaign/${encodeURIComponent(campaignCode)}/players`,
          { signal: controller.signal, cache: 'no-store' }
        );
        if (!response.ok) throw new Error('players unavailable');
        const data = (await response.json()) as {
          players?: CampaignPlayerData[];
        };
        const rows = (data.players ?? []).filter(
          row =>
            typeof row?.playerId === 'string' &&
            row.playerId.length > 0 &&
            typeof row.characterId === 'string'
        );
        if (controller.signal.aborted) return;
        setSnapshot({
          status: 'ready',
          players: rows.map(row => ({
            playerId: row.playerId,
            characterId: row.characterId,
            name: row.characterName || row.playerName || row.playerId,
          })),
          campaignPlayers: rows.map(row => ({
            id: row.playerId,
            name: row.characterName || row.playerName || row.playerId,
            class: row.characterData?.class?.name ?? '',
            level: row.characterData?.level ?? 1,
            armorClass: row.characterData?.armorClass ?? 10,
            currentHp: row.characterData?.hitPoints?.current ?? 0,
            maxHp: row.characterData?.hitPoints?.max ?? 0,
            dexterity: row.characterData?.abilities?.dexterity ?? 10,
            avatarUrl: row.characterData?.avatar,
          })),
        });
      } catch {
        if (!controller.signal.aborted) setSnapshot({ status: 'unavailable' });
      }
    })();
    return () => controller.abort();
  }, [campaignCode, attempt]);

  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  return { snapshot, refresh };
}
