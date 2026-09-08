'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PublicShop } from '@/types/shop';
import {
  describePurchaseError,
  GENERIC_PURCHASE_ERROR_MESSAGE,
} from './PlayerShopDialog.utils';

interface UseShopDataResult {
  shop: PublicShop | null;
  loading: boolean;
  error: string | null;
  /** Exposed so a completed purchase can patch the affected row's
   *  `remainingQuantity` locally (from the purchase receipt) without an
   *  extra round trip. */
  setShop: React.Dispatch<React.SetStateAction<PublicShop | null>>;
}

/**
 * Fetches (and, on `npcId`/`campaignCode` change, re-fetches) a merchant's
 * public shop via `GET /api/campaign/[code]/shops/[npcId]` while `open` is
 * true. A `{ shop: null }` response (closed, unpublished, or the ledger's
 * TTL expired) is a normal, non-error result.
 *
 * `initialShop`: the token-tap flow (Task 11) already confirms the tapped
 * entity against a freshly-fetched `PublicShop` — via
 * `useMerchantShopActivation` — before it ever opens this dialog. Passing
 * that SAME record here seeds `shop` immediately and skips the fetch this
 * hook would otherwise issue for the identical URL, so opening the dialog
 * does not double-fetch the same resource (once to confirm the tap, once
 * again on mount) — the request waterfall a coordinator review flagged.
 * `undefined` (the default) preserves the original fetch-on-open behavior
 * for any caller that doesn't already have a fresh shop in hand.
 */
export function useShopData(
  campaignCode: string,
  npcId: string,
  open: boolean,
  initialShop?: PublicShop | null
): UseShopDataResult {
  const [shop, setShop] = useState<PublicShop | null>(initialShop ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialShop !== undefined) {
      setShop(initialShop);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/campaign/${campaignCode}/shops/${npcId}`)
      .then(res => res.json())
      .then((data: { shop?: PublicShop | null }) => {
        if (cancelled) return;
        setShop(data.shop ?? null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this shop.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignCode, npcId, open, initialShop]);

  return { shop, loading, error, setShop };
}

export interface PurchaseOutcome {
  ok: boolean;
  grantedQuantity?: number;
  costCopper?: number;
  remainingQuantity?: number;
  /** One id per transfer the purchase enqueued (empty on failure, or when
   *  talking to an older deployment that doesn't send the field yet) — see
   *  `useCommittedShopSpend`, which reconciles against these ids. */
  transferIds: string[];
  message: string;
}

interface PendingAttempt {
  entryId: string;
  quantity: number;
  requestId: string;
}

/**
 * Drives `POST /api/campaign/[code]/shops/[npcId]/purchases`.
 *
 * `requestId` stability (binding contract, see the route's doc comment): a
 * retry of the SAME intent — same `entryId` and `quantity`, attempted again
 * after this hook's own previous call failed — must reuse the exact same
 * `requestId`, or a lost reply (the server committed but the response never
 * arrived) becomes a genuine double purchase instead of an idempotent
 * replay. `lastAttemptRef` mints a fresh id only when the entry or quantity
 * actually changes (a new intent) or after a success (the receipt is
 * consumed; the next Buy click on this row starts a new intent) — never on a
 * bare re-render.
 */
export function usePurchase(
  campaignCode: string,
  npcId: string,
  playerId: string
) {
  const [purchasingEntryId, setPurchasingEntryId] = useState<string | null>(
    null
  );
  const lastAttemptRef = useRef<PendingAttempt | null>(null);

  const purchase = useCallback(
    async (entryId: string, quantity: number): Promise<PurchaseOutcome> => {
      const previous = lastAttemptRef.current;
      const requestId =
        previous &&
        previous.entryId === entryId &&
        previous.quantity === quantity
          ? previous.requestId
          : crypto.randomUUID();
      lastAttemptRef.current = { entryId, quantity, requestId };

      setPurchasingEntryId(entryId);
      try {
        const response = await fetch(
          `/api/campaign/${campaignCode}/shops/${npcId}/purchases`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-rollkeeper-csrf': '1',
            },
            body: JSON.stringify({ playerId, entryId, quantity, requestId }),
          }
        );
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          grantedQuantity?: number;
          costCopper?: number;
          remainingQuantity?: number;
          // Optional: a response from an older deployment legitimately won't
          // carry this field yet.
          transferIds?: string[];
        };

        if (!response.ok) {
          return {
            ok: false,
            transferIds: [],
            message: describePurchaseError(data.error),
          };
        }

        // Success consumes this intent — the next Buy click on this row (even
        // at the same quantity) is a new purchase and must mint a fresh id.
        lastAttemptRef.current = null;
        const granted = data.grantedQuantity ?? quantity;
        const message =
          granted < quantity
            ? `Bought ${granted} of ${quantity} — that's all the stock allowed. The item will appear on your character shortly.`
            : 'Bought. The item will appear on your character shortly.';
        return {
          ok: true,
          grantedQuantity: granted,
          costCopper: data.costCopper,
          remainingQuantity: data.remainingQuantity,
          transferIds: data.transferIds ?? [],
          message,
        };
      } catch {
        return {
          ok: false,
          transferIds: [],
          message: GENERIC_PURCHASE_ERROR_MESSAGE,
        };
      } finally {
        setPurchasingEntryId(null);
      }
    },
    [campaignCode, npcId, playerId]
  );

  return { purchase, purchasingEntryId };
}
