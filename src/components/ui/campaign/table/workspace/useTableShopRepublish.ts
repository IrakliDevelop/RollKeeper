'use client';

import { useEffect, useRef } from 'react';

import {
  mergeShopEntityIds,
  patchShopEntityIds,
  resolveShopEntityIds,
} from '@/components/ui/campaign/NPCShopTab/NPCShopTab.utils';
import type { TableWorkspaceSnapshotV1 } from '@/lib/table/schema';
import { tableShopEntityIds } from '@/lib/table/shopLinks';
import { useNPCStore } from '@/store/npcStore';
import type { PublicShopIndexEntry } from '@/types/shop';

/** Roster edits come in bursts (add, place, move); check once they settle. */
export const TABLE_SHOP_CHECK_DELAY_MS = 1_000;

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every(id => right.includes(id));

const idsKey = (ids: readonly string[]) => [...ids].sort().join('\u0000');

/**
 * Repair 09 (D2): keeps open shops in step with the Table. When a campaign
 * NPC with an open shop is added to, placed on or removed from a scene, its
 * published token list is updated, so a player tap on the new token opens
 * the shop without the DM toggling it.
 *
 * - Only shops that are open locally AND published (in the public index)
 *   are touched, and only when the published list differs from encounter
 *   plus Table ids.
 * - LL1: the update is the ids-only `PATCH`, never the full publish, so it
 *   cannot reseed stock while a sale is waiting to be drained.
 * - LL7: the ids computed for each open shop are remembered after a check;
 *   while they stay the same, no index request is made.
 */
export function useTableShopRepublish(options: {
  snapshot: TableWorkspaceSnapshotV1 | null;
  revision: number;
  campaignCode: string;
  dmId: string | null;
}): void {
  const latest = useRef(options);
  latest.current = options;
  /** npcId → ids (sorted key) the server was last seen or set to carry. */
  const checked = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const { snapshot, campaignCode, dmId } = latest.current;
      if (!snapshot || !dmId) return;
      const wanted = (useNPCStore.getState().npcsByCampaign[campaignCode] ?? [])
        .filter(npc => npc.shop?.open === true)
        .map(npc => ({
          npc,
          entityIds: mergeShopEntityIds(
            resolveShopEntityIds(campaignCode, npc.id),
            tableShopEntityIds(snapshot, npc.id)
          ),
        }))
        .filter(
          ({ npc, entityIds }) =>
            checked.current.get(npc.id) !== idsKey(entityIds)
        );
      if (wanted.length === 0) return;
      void (async () => {
        let index: PublicShopIndexEntry[];
        try {
          const response = await fetch(
            `/api/campaign/${encodeURIComponent(campaignCode)}/shops`
          );
          if (!response.ok) throw new Error(`status ${response.status}`);
          index =
            ((await response.json()) as { shops?: PublicShopIndexEntry[] })
              .shops ?? [];
        } catch (error) {
          console.warn('[RollKeeper] Shop: could not read the shops.', error);
          return;
        }
        for (const { npc, entityIds } of wanted) {
          if (cancelled) return;
          const published = index.find(entry => entry.npcId === npc.id);
          if (!published) continue;
          if (!sameIds(published.entityIds, entityIds)) {
            try {
              await patchShopEntityIds({
                dmId,
                campaignCode,
                npcId: npc.id,
                entityIds,
              });
            } catch (error) {
              console.warn(
                '[RollKeeper] Shop: could not update the merchant tokens.',
                error
              );
              continue;
            }
          }
          checked.current.set(npc.id, idsKey(entityIds));
        }
      })();
    }, TABLE_SHOP_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [options.revision, options.campaignCode, options.dmId]);
}
