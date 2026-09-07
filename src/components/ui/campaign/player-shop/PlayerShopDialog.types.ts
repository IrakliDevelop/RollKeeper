import type { Currency } from '@/types/character';
import type { PublicShopItem } from '@/types/shop';

/** Task 10 (VTT merchants Slice 3) — the player-facing shop dialog. This
 *  task does NOT wire the token tap that opens it (that's the next task); it
 *  only builds the dialog and its data flow, so every prop the eventual tap
 *  will need to supply is listed here.
 *
 *  `merchantDescription` is deliberately a plain prop, not something read
 *  off `PublicShop` — `PublicShop` (types/shop.ts) carries only
 *  `merchantName`, never a one-line flavour description, so artboard 1b's
 *  "Ironmonger of the Low Market" subtitle has to come from wherever the
 *  future token-tap wiring already has player-visible NPC flavour text
 *  (e.g. a map marker's public label) — outside this task's scope. The
 *  header simply omits the line when it's not supplied.
 */
export interface PlayerShopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignCode: string;
  npcId: string;
  playerId: string;
  merchantAvatarUrl?: string;
  /** One-line flavour text under the merchant's name (artboard 1b). Omitted
   *  entirely from the header when absent. */
  merchantDescription?: string;
  /** The buyer's current purse (`character.currency` in characterStore).
   *  Read-only here — a purchase's actual coin debit is applied later,
   *  client-side, when the granting transfer is merged
   *  (`useItemTransferAutoMerge`); this dialog only ever *previews* the
   *  result using the same `currency.ts` helpers that merge will use. */
  purse: Currency;
}

export type ShopCardState = 'affordable' | 'unaffordable' | 'sold-out';

export interface ShopItemCardProps {
  item: PublicShopItem;
  purse: Currency;
  /** Current stepper selection for this row, clamped by the parent to
   *  `[1, max(1, item.remainingQuantity)]`. */
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  purchasing: boolean;
  /** Set after a completed purchase attempt for this row; cleared on the
   *  next quantity change or buy attempt. */
  resultMessage?: string;
  resultTone?: 'success' | 'error';
  onBuy: () => void;
}
