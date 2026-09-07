'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC } from '@/types/encounter';
import type { ShopSaleLogEntry } from '@/types/shop';

import { resolveShopEntityIds } from './NPCShopTab.utils';

/** A DM typing a price (or editing the description) should not fire one
 *  republish per keystroke — trailing-edge debounce collapses a burst of
 *  edits into a single request once the DM pauses. */
const REPUBLISH_DEBOUNCE_MS = 600;

export interface UseShopPublishResult {
  /**
   * Sets the local `shop.open` flag immediately, then publishes (open) or
   * tears down (close) the player-visible shop via
   * `PUT /api/campaign/[code]/shops/[npcId]`. Never awaited by the caller —
   * the DM's toggle must flip before the network request resolves. Cancels
   * any pending debounced `republish()` — this send already carries the
   * latest state, and a stale republish firing after an explicit toggle
   * (especially a close) would be wrong.
   */
  setOpen: (open: boolean) => void;
  /**
   * Debounced republish of the shop's current state while it is already
   * open (VTT merchants Slice 3, Task 13b, controller ruling R22) — a price
   * edit, a `forSale`/quantity change, or a description edit should reach
   * players without the DM toggling the shop off and back on. Safe to call
   * unconditionally (e.g. after every inventory patch): it re-checks
   * `shop.open` at the moment the debounce fires and is a no-op if the shop
   * is closed by then (including "closed during the debounce window").
   * Re-seeding while open is safe by design — `SHOP_SEED_SCRIPT`
   * (`shopPurchases.ts`) always inherits the ledger's existing
   * `soldQuantity` and clamps `remainingQuantity` to
   * `max(0, freshlyAuthoredStock - soldQuantity)`, so a republish can only
   * ever correct stock/price/description, never resurrect or double-count a
   * sale.
   */
  republish: () => void;
  /** Set when the last publish/teardown/republish request failed. The local
   *  toggle (or edit) has already applied by then, so this is the DM's only
   *  signal that the shop is NOT actually live (or NOT actually up to date)
   *  server-side. Cleared at the start of the next attempt that actually
   *  sends. */
  publishError: string | null;
}

/**
 * Wires the Shop tab's "Open for business" toggle — and, as of Task 13b,
 * every shop-relevant edit made while the shop is already open — to
 * `PUT /api/campaign/[code]/shops/[npcId]` (VTT merchants Slice 3).
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
 *
 * `republish()` reads the NPC via a ref updated on every render
 * (`npcRef.current = npc`), not the `npc` argument closed over when it was
 * scheduled — by the time the debounce fires, several more edits (and
 * re-renders) may have happened, and only the LATEST state should ever be
 * sent.
 */
export function useShopPublish(npc: CampaignNPC): UseShopPublishResult {
  const dmId = useDmStore(state => state.dmId);
  const [publishError, setPublishError] = useState<string | null>(null);
  const npcRef = useRef(npc);
  npcRef.current = npc;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendPublish = useCallback(
    (nextNpc: CampaignNPC, open: boolean) => {
      const entityIds = resolveShopEntityIds(nextNpc.campaignCode, nextNpc.id);
      fetch(
        `/api/campaign/${encodeURIComponent(nextNpc.campaignCode)}/shops/${encodeURIComponent(nextNpc.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dmId, npc: nextNpc, entityIds }),
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
    [dmId]
  );

  const cancelPendingRepublish = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const setOpen = useCallback(
    (open: boolean) => {
      const nextShop = {
        ...npc.shop,
        open,
        updatedAt: new Date().toISOString(),
      };
      const nextNpc = { ...npc, shop: nextShop };
      // Local state first, unconditionally — publishing must never block
      // the toggle's local state update.
      useNPCStore
        .getState()
        .updateNPC(npc.campaignCode, npc.id, { shop: nextShop });
      setPublishError(null);
      cancelPendingRepublish();
      sendPublish(nextNpc, open);
    },
    [npc, sendPublish, cancelPendingRepublish]
  );

  const republish = useCallback(() => {
    cancelPendingRepublish();
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const current = npcRef.current;
      // The shop may have been closed (or never opened) by the time this
      // fires — never send an unsolicited publish.
      if (current.shop?.open !== true) return;
      setPublishError(null);
      sendPublish(current, true);
    }, REPUBLISH_DEBOUNCE_MS);
  }, [sendPublish, cancelPendingRepublish]);

  useEffect(() => cancelPendingRepublish, [cancelPendingRepublish]);

  return { setOpen, republish, publishError };
}

const EMPTY_SALES_LOG: ShopSaleLogEntry[] = [];

/**
 * Reactive read of one NPC's recent sales log (`npcStore`'s
 * `shopSalesLogByNpc`, written by `useDmShopSalesSync`'s `applySaleToNpc` —
 * VTT merchants Slice 3, Task 13b). The module-level `EMPTY_SALES_LOG`
 * fallback (never a fresh `?? []` literal inline) avoids the known Zustand
 * selector-stability infinite-loop footgun: a new array identity on every
 * call would make `useSyncExternalStore` see a "changed" value on every
 * render and re-render forever.
 */
export function useShopSalesLog(npcId: string): ShopSaleLogEntry[] {
  return useNPCStore(
    state => state.shopSalesLogByNpc[npcId] ?? EMPTY_SALES_LOG
  );
}
