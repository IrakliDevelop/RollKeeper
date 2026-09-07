'use client';

import { useEffect, useRef, useState } from 'react';
import {
  denominationsToPriceCopper,
  priceCopperToDenominations,
  type PriceDenominations,
} from '@/utils/itemPricing';

interface UsePriceDraftResult {
  /** Current gp/sp/cp field values; a denomination is `undefined` when its
   * field is empty (either never set, or cleared by the DM). */
  draft: Partial<PriceDenominations>;
  setDenomination: (
    denom: keyof PriceDenominations,
    value: number | undefined
  ) => void;
}

/**
 * Row-local draft of the three price entry fields, decoupled from
 * `item.priceCopper`. Fixes Task 5 review Important #1: `NumberInput`'s
 * `allowEmpty` emits `undefined` when a field is cleared; combining that
 * straight into `priceCopper` with `?? 0` coerced it back into a number,
 * which echoed through the prop and snapped the field back to "0" mid-delete
 * (and made an override impossible to remove, since `priceCopper` could
 * never resolve back to `undefined`).
 *
 * `lastPatchedPriceCopper` tracks what this hook itself last wrote, so an
 * external change to `item.priceCopper` (not one of our own patches) still
 * resyncs the draft.
 */
export function usePriceDraft(
  priceCopper: number | undefined,
  onPriceCopperChange: (priceCopper: number | undefined) => void
): UsePriceDraftResult {
  const [draft, setDraft] = useState<Partial<PriceDenominations>>(
    priceCopper !== undefined ? priceCopperToDenominations(priceCopper) : {}
  );
  const lastPatchedPriceCopper = useRef(priceCopper);

  useEffect(() => {
    if (priceCopper !== lastPatchedPriceCopper.current) {
      lastPatchedPriceCopper.current = priceCopper;
      setDraft(
        priceCopper !== undefined ? priceCopperToDenominations(priceCopper) : {}
      );
    }
  }, [priceCopper]);

  const setDenomination = (
    denom: keyof PriceDenominations,
    value: number | undefined
  ) => {
    const next = { ...draft, [denom]: value };
    setDraft(next);
    // All three cleared -> no override at all, so `resolvePriceCopper()`
    // falls through to `item.value`/rarity. A field explicitly left at a
    // typed `0` still counts (0 cp is a legitimate DM-authored price), so
    // this is a presence check, not a truthiness check.
    const allEmpty =
      next.gp === undefined && next.sp === undefined && next.cp === undefined;
    const nextPriceCopper = allEmpty
      ? undefined
      : denominationsToPriceCopper(next);
    lastPatchedPriceCopper.current = nextPriceCopper;
    onPriceCopperChange(nextPriceCopper);
  };

  return { draft, setDenomination };
}
