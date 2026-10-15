'use client';

import { useEffect, useRef } from 'react';

import {
  mergeShopEntityIds,
  putShop,
  resolveShopEntityIds,
} from '@/components/ui/campaign/NPCShopTab/NPCShopTab.utils';
import type { TableWorkspaceSnapshotV1 } from '@/lib/table/schema';
import { tableShopEntityIds } from '@/lib/table/shopLinks';
import { useNPCStore } from '@/store/npcStore';
import type { PublicShopIndexEntry } from '@/types/shop';

/** Roster edits come in bursts (add, place, move); check once they settle. */
const TABLE_SHOP_CHECK_DELAY_MS = 1_000;

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every(id => right.includes(id));

/**
 * Repair 09 (D2): keeps open shops in step with the Table. When a campaign
 * NPC with an open shop is added to, placed on or removed from a scene, its
 * published token list is updated, so a player tap on the new token opens
 * the shop without the DM toggling it.
 *
 * Only shops that are open locally AND published (in the public index) are
 * touched, and only when the published list differs from encounter plus
 * Table ids. The PUT is the same one the Shop tab sends; stock comes from
 * the NPC as the sales sync left it, exactly like a Shop tab republish.
 */
export function useTableShopRepublish(options: {
  snapshot: TableWorkspaceSnapshotV1 | null;
  revision: number;
  campaignCode: string;
  dmId: string | null;
}): void {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const { snapshot, campaignCode, dmId } = latest.current;
      if (!snapshot || !dmId) return;
      const open = (
        useNPCStore.getState().npcsByCampaign[campaignCode] ?? []
      ).filter(npc => npc.shop?.open === true);
      if (open.length === 0) return;
      void (async () => {
        let index: PublicShopIndexEntry[];
        try {
          const response = await fetch(
            `/api/campaign/${encodeURIComponent(campaignCode)}/shops`
          );
          index =
            ((await response.json()) as { shops?: PublicShopIndexEntry[] })
              .shops ?? [];
        } catch {
          return;
        }
        for (const npc of open) {
          if (cancelled) return;
          const published = index.find(entry => entry.npcId === npc.id);
          if (!published) continue;
          const entityIds = mergeShopEntityIds(
            resolveShopEntityIds(campaignCode, npc.id),
            tableShopEntityIds(snapshot, npc.id)
          );
          if (sameIds(published.entityIds, entityIds)) continue;
          await putShop({ dmId, npc, entityIds, open: true }).catch(
            (error: unknown) =>
              console.warn(
                '[RollKeeper] Shop: could not update the merchant tokens.',
                error
              )
          );
        }
      })();
    }, TABLE_SHOP_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [options.revision, options.campaignCode, options.dmId]);
}
