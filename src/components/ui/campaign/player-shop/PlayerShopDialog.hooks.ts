'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Currency } from '@/types/character';
import type { PublicShop } from '@/types/shop';
import { spendCopper } from '@/utils/currency';
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

const ZERO_PURSE: Currency = {
  copper: 0,
  silver: 0,
  electrum: 0,
  gold: 0,
  platinum: 0,
};

/**
 * Tracks purchases COMMITTED during this dialog session but not yet
 * reflected in the `purse` prop (VTT merchants Slice 3 final review,
 * Important finding — "a player can commit more purchases than they can pay
 * for").
 *
 * The shop dialog (`PlayerBattleMapCanvas`) and the character-sheet debit
 * hook (`page.tsx`) are never co-mounted, so a completed purchase's actual
 * coin debit only lands once the player reopens their character sheet —
 * every affordability check made against the raw `purse` prop during THIS
 * session therefore keeps seeing the pre-purchase balance, and a player
 * with 50 gp could buy three 40 gp items in a row (each individually
 * affordable against the untouched purse) before any of them are ever
 * charged. `spendCopper` is not touched, and the real debit still only
 * happens later via `useItemTransferAutoMerge` — this hook only corrects
 * what the DIALOG shows as affordable while it's open, by folding each
 * successful purchase's `costCopper` into a running total and re-deriving
 * an "effective" purse (`spendCopper(purse, committedCopper)`) for
 * everything the dialog renders. `null` (committed spend exceeds the known
 * purse — shouldn't happen once this hook is wired in, since it's the same
 * total every affordability check already uses, but defensive regardless)
 * falls back to an empty purse rather than a stale full one.
 *
 * Resets to 0 whenever the dialog closes (`open` flips false) — a fresh
 * session must never carry forward a previous visit's commitments, exactly
 * like `PlayerShopDialog`'s own `quantities`/`results` reset.
 */
export function useSessionSpend(
  purse: Currency,
  open: boolean
): { effectivePurse: Currency; commit: (costCopper: number) => void } {
  const [committedCopper, setCommittedCopper] = useState(0);

  useEffect(() => {
    if (!open) setCommittedCopper(0);
  }, [open]);

  const commit = useCallback((costCopper: number) => {
    if (!Number.isInteger(costCopper) || costCopper <= 0) return;
    setCommittedCopper(prev => prev + costCopper);
  }, []);

  const effectivePurse = spendCopper(purse, committedCopper) ?? ZERO_PURSE;

  return { effectivePurse, commit };
}

export interface PurchaseOutcome {
  ok: boolean;
  grantedQuantity?: number;
  costCopper?: number;
  remainingQuantity?: number;
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
        };

        if (!response.ok) {
          return { ok: false, message: describePurchaseError(data.error) };
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
          message,
        };
      } catch {
        return { ok: false, message: GENERIC_PURCHASE_ERROR_MESSAGE };
      } finally {
        setPurchasingEntryId(null);
      }
    },
    [campaignCode, npcId, playerId]
  );

  return { purchase, purchasingEntryId };
}
