import type { Currency } from '@/types/character';
import type { PublicShop, PublicShopItem } from '@/types/shop';

/** Task 10 (VTT merchants Slice 3) — the player-facing shop dialog; Task 11
 *  wires the token tap that opens it and the `initialShop` seam below
 *  (controller ruling R16/R17).
 *
 *  The header's one-line flavour text (artboard 1b, e.g. "Ironmonger of the
 *  Low Market") is read from the fetched/seeded `PublicShop.merchantDescription`
 *  ALONGSIDE `merchantName` — both from the SAME record — never from a
 *  separately-supplied prop; two fields of one record read from two
 *  independently-fetched sources could disagree if the DM republishes
 *  between them. `merchantDescription` on `PublicShop` is itself sourced
 *  from `CampaignNPC.shop.description` (a dedicated, DM-authored,
 *  known-player-facing field), never `CampaignNPC.description` (the DM's
 *  private free-text note) — see `shopProjection.ts`'s doc comment.
 */
export interface PlayerShopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignCode: string;
  npcId: string;
  playerId: string;
  merchantAvatarUrl?: string;
  /**
   * A shop the caller already fetched and confirmed (Task 11's token-tap
   * flow always has one) — seeds `useShopData`'s state immediately and
   * skips its own redundant fetch of the identical `GET .../shops/[npcId]`
   * URL. `undefined` (the default) falls back to fetching on open, for any
   * caller that doesn't already have a fresh shop in hand.
   */
  initialShop?: PublicShop;
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
