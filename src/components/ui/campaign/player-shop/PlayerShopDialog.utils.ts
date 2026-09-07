import type { Currency } from '@/types/character';
import type { PublicShop } from '@/types/shop';
import { formatCurrencyFromCopper, spendCopper } from '@/utils/currency';

/**
 * Denomination display order/labels for a RAW `Currency` object — deliberately
 * distinct from `formatCurrencyFromCopper`, which re-derives gp/sp/cp from a
 * total and therefore canonicalises (e.g. a purse holding `{gold: 34, silver:
 * 6, copper: 12}` — a non-canonical 12 cp — would print as "34 gp, 7 sp, 2
 * cp"). Artboard 1b's "Your purse" / "After buying" lines show the purse's
 * actual coin counts, not a canonical recomputation (see the Task 10 brief's
 * "non-canonical purse" note), so this formats the `Currency` fields
 * directly instead of round-tripping through copper.
 */
const RAW_DENOMINATIONS: { key: keyof Currency; label: string }[] = [
  { key: 'platinum', label: 'pp' },
  { key: 'gold', label: 'gp' },
  { key: 'electrum', label: 'ep' },
  { key: 'silver', label: 'sp' },
  { key: 'copper', label: 'cp' },
];

/** Formats a purse (or the result of `spendCopper`) as its actual coin
 *  counts, e.g. `34 gp · 6 sp · 12 cp` — never canonicalised. Zero
 *  denominations are omitted; an entirely empty purse falls back to `0 cp`. */
export function formatPurseLine(currency: Currency): string {
  const parts = RAW_DENOMINATIONS.filter(({ key }) => currency[key] > 0).map(
    ({ key, label }) => `${currency[key]} ${label}`
  );
  return parts.length > 0 ? parts.join(' · ') : '0 cp';
}

/**
 * The shortfall pill's exact copy (artboard 1b): `You're 30 gp 2 sp 8 cp
 * short`. `shortfallCopper` must be computed by the caller as
 * `totalCostCopper - purseToCopper(purse)` — the same `currency.ts` total
 * the debit itself is checked against (`canAfford`) — so this pill can never
 * disagree with what a purchase attempt would actually require. The gp/sp/cp
 * split reuses `formatCurrencyFromCopper`'s decomposition (comma-joined,
 * e.g. "30 gp, 2 sp, 8 cp") and only changes the joiner to a plain space to
 * match the mockup's copy, rather than re-deriving the same gold/silver/
 * copper math a second time.
 */
export function formatShortfall(shortfallCopper: number): string {
  return `You're ${formatCurrencyFromCopper(shortfallCopper).replace(/,\s*/g, ' ')} short`;
}

/** Server error taxonomy -> player-facing copy (Task 10 brief, mapped from
 *  the purchases route's error shapes). A 403 receipt-ownership mismatch —
 *  unreachable for a legitimate client, see the route's doc comment — and
 *  any other unrecognised error string fall through to the generic message
 *  rather than going unhandled. */
const PURCHASE_ERROR_MESSAGES: Record<string, string> = {
  'shop-closed': "This merchant isn't trading right now.",
  'entry-not-found': 'That item is no longer on offer.',
  'insufficient-stock': 'Someone bought the last one.',
};

export const GENERIC_PURCHASE_ERROR_MESSAGE =
  'Could not complete that purchase.';

export function describePurchaseError(error: string | undefined): string {
  return (
    (error && PURCHASE_ERROR_MESSAGES[error]) || GENERIC_PURCHASE_ERROR_MESSAGE
  );
}

export interface ShopPurchasePreview {
  label: string;
  costCopper: number;
  /** `spendCopper(purse, costCopper)` — `null` when the previewed item is
   *  sold out or the purse can't cover it, in which case the dialog hides
   *  the "After buying" line entirely rather than showing a broken preview. */
  after: Currency | null;
}

/**
 * Resolves the footer's "After buying N Name — cost" preview (artboard 1b)
 * for whichever item is currently focused — the last row whose stepper the
 * player touched, defaulting to the shop's first row so the footer never
 * opens blank. Always run through `spendCopper`, the exact helper the real
 * debit uses, so this preview can never show a balance the actual purchase
 * wouldn't also produce.
 */
export function resolveShopPreview(
  shop: PublicShop | null,
  focusedEntryId: string | null,
  quantities: Record<string, number>,
  purse: Currency
): ShopPurchasePreview | null {
  if (!shop || shop.items.length === 0) return null;
  const item =
    shop.items.find(i => i.id === (focusedEntryId ?? shop.items[0]!.id)) ??
    null;
  if (!item || item.remainingQuantity <= 0) return null;

  const quantity = quantities[item.id] ?? 1;
  const costCopper = item.priceCopper * quantity;
  return {
    label: `${quantity} ${item.name}`,
    costCopper,
    after: spendCopper(purse, costCopper),
  };
}
