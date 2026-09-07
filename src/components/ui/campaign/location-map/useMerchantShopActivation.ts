'use client';

import { useCallback, useRef, useState } from 'react';

import { COMBATANT_TOKEN_KIND } from './tokenIdentity';

import type { CanvasElement, ElementActivationEvent } from '@fieldnotes/core';
import type { PublicShop } from '@/types/shop';

/**
 * Player-side token → merchant shop wiring (VTT merchants Slice 3, Task 11).
 *
 * A merchant's placed token is recognized purely by an optional `shopNpcId`
 * top-level key riding alongside the existing combatant-token keys
 * (`entityId`/`tokenKind` — see `combatantToken.ts`'s `CombatantTokenKeys`).
 * `shopNpcId` is the merchant's `CampaignNPC.id`, distinct from `entityId`
 * (the encounter entity id) — the two are unrelated identifiers by design
 * (`EncounterEntity.npcSourceId` documents why). Like `entityId`/`tokenKind`,
 * an extra top-level key on a `CanvasElement` survives the FieldNotes store,
 * export, and sync round-trips with no schema change needed.
 *
 * KNOWN GAP, called out rather than silently assumed: no task in this plan
 * (nor the DM-side "Open for business" publish wiring assigned to Task 13)
 * stamps `shopNpcId` onto a placed combatant token. Until a future change
 * does — a DM-side decision (which token represents which NPC) outside a
 * player-tap task's scope — no real token will ever carry this field, so
 * `isShopToken` below will not match anything placed by today's DM tooling.
 * This module is fully built and tested against that eventual stamp so nothing
 * else needs to change once it exists.
 */

interface ShopTokenKeys {
  entityId: string;
  shopNpcId: string;
}

function shopTokenKeys(el: Readonly<CanvasElement>): ShopTokenKeys | null {
  const rec = el as Partial<{
    tokenKind: unknown;
    entityId: unknown;
    shopNpcId: unknown;
  }>;
  if (rec.tokenKind !== COMBATANT_TOKEN_KIND) return null;
  if (typeof rec.entityId !== 'string' || rec.entityId === '') return null;
  if (typeof rec.shopNpcId !== 'string' || rec.shopNpcId === '') return null;
  return { entityId: rec.entityId, shopNpcId: rec.shopNpcId };
}

/** True for a combatant token additionally stamped with `shopNpcId`. Exported
 *  so the host's `useMarkerRegistration` call can recognize shop tokens via
 *  its `isExtraActivatable` slot instead of a second, competing
 *  `setActivation` registration. */
export function isShopToken(el: Readonly<CanvasElement>): boolean {
  return shopTokenKeys(el) !== null;
}

export interface OpenMerchantShop {
  npcId: string;
  merchantName: string;
  merchantDescription?: string;
}

export interface UseMerchantShopActivationResult {
  /** The confirmed-open shop to render `PlayerShopDialog` for, or `null`. */
  openShop: OpenMerchantShop | null;
  /** Pass as `onActivateExtra` to `useMarkerRegistration`. */
  handleActivate: (event: ElementActivationEvent) => void;
  /** Pass as (or wrap into) the dialog's `onOpenChange(false)`. */
  closeShop: () => void;
}

/**
 * Confirms a tapped merchant token against the LIVE projection before
 * opening the dialog — exactly one fetch per tap, never a proactive scan or
 * a poll. A stale/mismatched `shopNpcId` stamp, or a shop the DM has since
 * closed, must never open a dialog for the wrong merchant or one with
 * nothing to sell: the fetched shop's own `entityIds` (never the tapped
 * element's say-so) is what gates opening.
 */
export function useMerchantShopActivation(
  campaignCode: string
): UseMerchantShopActivationResult {
  const [openShop, setOpenShop] = useState<OpenMerchantShop | null>(null);
  // Bumped on every tap so a superseded (slower) response from an earlier
  // tap can never clobber a newer one's result.
  const requestIdRef = useRef(0);

  const handleActivate = useCallback(
    (event: ElementActivationEvent) => {
      const keys = shopTokenKeys(event.element);
      if (!keys) return;

      const requestId = ++requestIdRef.current;
      fetch(`/api/campaign/${campaignCode}/shops/${keys.shopNpcId}`)
        .then(res => res.json())
        .then((data: { shop?: PublicShop | null }) => {
          if (requestIdRef.current !== requestId) return;
          const shop = data.shop ?? null;
          if (!shop || !shop.entityIds.includes(keys.entityId)) return;
          setOpenShop({
            npcId: shop.npcId,
            merchantName: shop.merchantName,
            merchantDescription: shop.merchantDescription,
          });
        })
        .catch(() => {
          // Best-effort confirmation: a failed fetch just means no dialog
          // opens this tap — mirrors refreshMarkers' own best-effort catch.
        });
    },
    [campaignCode]
  );

  const closeShop = useCallback(() => setOpenShop(null), []);

  return { openShop, handleActivate, closeShop };
}
