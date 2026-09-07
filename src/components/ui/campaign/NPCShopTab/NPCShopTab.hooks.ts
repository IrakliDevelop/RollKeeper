'use client';

import { useCallback, useState } from 'react';

import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC } from '@/types/encounter';

import { resolveShopEntityIds } from './NPCShopTab.utils';

export interface UseShopPublishResult {
  /**
   * Sets the local `shop.open` flag immediately, then publishes (open) or
   * tears down (close) the player-visible shop via
   * `PUT /api/campaign/[code]/shops/[npcId]`. Never awaited by the caller —
   * the DM's toggle must flip before the network request resolves.
   */
  setOpen: (open: boolean) => void;
  /**
   * Set when the last publish/teardown request failed. The local toggle has
   * already flipped by then, so this is the DM's only signal that the shop
   * is NOT actually live (or NOT actually torn down) server-side. Cleared at
   * the start of the next attempt.
   */
  publishError: string | null;
}

/**
 * Wires the Shop tab's "Open for business" toggle to
 * `PUT /api/campaign/[code]/shops/[npcId]` (VTT merchants Slice 3, Task
 * 13a) — the route and its tests have existed since Task 5, but nothing
 * ever called it, so a DM flipping the toggle only ever updated
 * `npcStore` and no shop ever reached a player.
 *
 * `entityIds` are resolved DM-side from `encounterStore` via
 * `resolveShopEntityIds` — never sent by a player, never stored on
 * `CampaignNPC` itself. See that function's doc comment and the route's own
 * for why this resolution has to happen here.
 *
 * The merged `{ ...npc.shop, open, updatedAt }` shape (never a bare
 * `{ open, updatedAt }` replacement) is deliberate: `CampaignNPC.shop` now
 * also carries `description`, and replacing the whole object on every
 * toggle would erase it the next time the DM turned the shop back on.
 */
export function useShopPublish(npc: CampaignNPC): UseShopPublishResult {
  const dmId = useDmStore(state => state.dmId);
  const [publishError, setPublishError] = useState<string | null>(null);

  const setOpen = useCallback(
    (open: boolean) => {
      const nextShop = {
        ...npc.shop,
        open,
        updatedAt: new Date().toISOString(),
      };
      // Local state first, unconditionally — publishing must never block
      // the toggle's local state update.
      useNPCStore
        .getState()
        .updateNPC(npc.campaignCode, npc.id, { shop: nextShop });
      setPublishError(null);

      const entityIds = resolveShopEntityIds(npc.campaignCode, npc.id);
      fetch(
        `/api/campaign/${encodeURIComponent(npc.campaignCode)}/shops/${encodeURIComponent(npc.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dmId,
            npc: { ...npc, shop: nextShop },
            entityIds,
          }),
        }
      )
        .then(async response => {
          if (response.ok) return;
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            body?.error ??
              `Failed to ${open ? 'publish' : 'close'} the shop (${response.status}).`
          );
        })
        .catch((error: unknown) => {
          setPublishError(
            error instanceof Error
              ? error.message
              : `Failed to ${open ? 'publish' : 'close'} the shop.`
          );
        });
    },
    [npc, dmId]
  );

  return { setOpen, publishError };
}
