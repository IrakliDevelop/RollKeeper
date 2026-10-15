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

/**
 * NN1: what was checked, per shop: its versions (`shop.updatedAt`, bumped
 * by every toggle, and the NPC's `updatedAt`, bumped by edits that a
 * Shop-tab republish sends) and the sorted ids.
 */
const checkKey = (
  versions: Array<string | undefined>,
  ids: readonly string[]
) =>
  [...versions.map(version => version ?? ''), ...[...ids].sort()].join(
    '\u0000'
  );

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
 * - LL7 / NN1: the ids computed for each open shop are remembered with the
 *   shop's version after a check; while both stay the same, no index request
 *   is made. Closing the shop forgets the check.
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
      const npcs = useNPCStore.getState().npcsByCampaign[campaignCode] ?? [];
      // NN1: a shop that is not open forgets its check, so opening it again
      // always checks the server.
      for (const npc of npcs)
        if (npc.shop?.open !== true) checked.current.delete(npc.id);
      const wanted = npcs
        .filter(npc => npc.shop?.open === true)
        .map(npc => {
          const entityIds = mergeShopEntityIds(
            resolveShopEntityIds(campaignCode, npc.id),
            tableShopEntityIds(snapshot, npc.id)
          );
          return {
            npc,
            entityIds,
            key: checkKey([npc.shop?.updatedAt, npc.updatedAt], entityIds),
          };
        })
        .filter(({ npc, key }) => checked.current.get(npc.id) !== key);
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
        for (const { npc, entityIds, key } of wanted) {
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
          checked.current.set(npc.id, key);
        }
      })();
    }, TABLE_SHOP_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [options.revision, options.campaignCode, options.dmId]);
}
