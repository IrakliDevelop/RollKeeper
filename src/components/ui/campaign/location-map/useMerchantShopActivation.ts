'use client';

import { useCallback, useRef, useState } from 'react';

import { movableTokenIdentity } from './tokenIdentity';

import type { CanvasElement, ElementActivationEvent } from '@fieldnotes/core';
import type { PublicShop, PublicShopIndexEntry } from '@/types/shop';

/**
 * Player-side token → merchant shop wiring (VTT merchants Slice 3, Task 11;
 * redesigned per controller ruling R16).
 *
 * A merchant's token is visually and structurally indistinguishable from any
 * other combatant token — this is deliberate: a stamped `shopNpcId` field
 * was the FIRST approach here, but the controller rejected it (R16) for
 * three reasons that all still hold: it needs a DM-side authoring step
 * nothing in this plan owns, it goes stale the moment a DM moves or
 * replaces a token without re-stamping, and it leaves two facts (the stamp
 * AND the server's `entityIds`) that must independently agree, where either
 * one being wrong produces the same silent, feedback-free no-op tap.
 *
 * Instead, ANY combatant token tap is checked against a player-readable
 * index of currently-open shops (`GET /api/campaign/[code]/shops`, one fact:
 * the server's own record of what's open). A match by `entityId` yields a
 * candidate `npcId`, which is then confirmed by fetching that shop's own
 * live projection (`GET /api/campaign/[code]/shops/[npcId]`) — the index is
 * a LOOKUP, never an authority; only the fetched shop's own `entityIds`
 * gates opening the dialog. Two fetches per tap, both real and necessary
 * (list, then the specific record), never a proactive scan across N shops.
 * `handleActivate` returns the underlying promise chain (assignable to a
 * `void`-returning event handler; production callers ignore it) purely so
 * tests can await full settlement instead of racing on it.
 */

/** True for any combatant token (the shape a merchant's token takes — same
 *  as any other NPC/monster token). Pass as `isExtraActivatable` to
 *  `useMarkerRegistration` so a tap on one is even considered for
 *  activation; WHICH combatant tokens have an open shop is resolved at tap
 *  time against the shop index, never by anything on the element itself. */
export function isCombatantToken(el: Readonly<CanvasElement>): boolean {
  return movableTokenIdentity(el)?.kind === 'combatant';
}

export interface OpenMerchantShop {
  npcId: string;
  /** The confirmed, live `PublicShop` — handed to `PlayerShopDialog` as
   *  `initialShop` so it never re-fetches the identical URL this hook just
   *  fetched (the request-waterfall fix from the coordinator review). */
  shop: PublicShop;
}

export interface UseMerchantShopActivationResult {
  /** The confirmed-open shop to render `PlayerShopDialog` for, or `null`. */
  openShop: OpenMerchantShop | null;
  /** Pass as `onActivateExtra` to `useMarkerRegistration`. Returns the
   *  underlying promise chain for tests to await; production callers may
   *  ignore the return value (the type it's assigned to is void-returning). */
  handleActivate: (event: ElementActivationEvent) => Promise<void> | void;
  /** Pass as (or wrap into) the dialog's `onOpenChange(false)`. */
  closeShop: () => void;
}

/**
 * Resolves a tapped combatant token to its open shop, if any, via the
 * player-readable shop index — never a stamp on the token, never a
 * proactive scan of every NPC. See this module's doc comment for the full
 * two-fetch design and why an index (not a token field) was chosen.
 */
export function useMerchantShopActivation(
  campaignCode: string
): UseMerchantShopActivationResult {
  const [openShop, setOpenShop] = useState<OpenMerchantShop | null>(null);
  // Bumped on every tap so a superseded (slower) response chain from an
  // earlier tap can never clobber a newer one's result, at EITHER hop.
  const requestIdRef = useRef(0);

  const handleActivate = useCallback(
    (event: ElementActivationEvent): Promise<void> | void => {
      const identity = movableTokenIdentity(event.element);
      if (!identity || identity.kind !== 'combatant') return;
      const entityId = identity.key;

      const requestId = ++requestIdRef.current;

      return (async () => {
        try {
          const indexRes = await fetch(`/api/campaign/${campaignCode}/shops`);
          const indexData = (await indexRes.json()) as {
            shops?: PublicShopIndexEntry[];
          };
          if (requestIdRef.current !== requestId) return;

          const match = (indexData.shops ?? []).find(entry =>
            entry.entityIds.includes(entityId)
          );
          if (!match) return;

          const shopRes = await fetch(
            `/api/campaign/${campaignCode}/shops/${match.npcId}`
          );
          const shopData = (await shopRes.json()) as {
            shop?: PublicShop | null;
          };
          if (requestIdRef.current !== requestId) return;

          const shop = shopData.shop ?? null;
          // The index is a lookup, not an authority: only the FRESHLY
          // fetched shop's own entityIds gates opening — a stale index
          // entry (the shop closed, or was republished without this
          // entity) must never open a dialog on its say-so alone.
          if (!shop || !shop.entityIds.includes(entityId)) return;

          setOpenShop({ npcId: shop.npcId, shop });
        } catch {
          // Best-effort: a failed lookup/confirmation just means no dialog
          // opens for this tap — mirrors refreshMarkers' own best-effort
          // catch elsewhere on this canvas.
        }
      })();
    },
    [campaignCode]
  );

  const closeShop = useCallback(() => setOpenShop(null), []);

  return { openShop, handleActivate, closeShop };
}
