import type { Currency } from '@/types/character';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';

export interface NPCShopTabProps {
  npc: CampaignNPC;
  /** Viewer cannot edit — every control renders disabled. */
  readOnly?: boolean;
}

export interface ShopOpenSectionProps {
  npcName: string;
  shopOpen: boolean;
  /** `npc.shop?.description ?? ''` — the player-facing subtitle. */
  description: string;
  readOnly: boolean;
  /** Set when the last publish/teardown/republish attempt failed (see
   *  `useShopPublish`). */
  publishError: string | null;
  currency: Currency;
  /** Count of for-sale, priceable, in-stock rows — drives the open-state
   *  subtitle's "N items still in stock" (artboard 1a). */
  itemsInStock: number;
  /** Sum of today's recorded sales in copper — the purse label's "+X gp
   *  today" delta (artboard 1a). 0 renders no delta at all. */
  todayCopper: number;
  onSetOpen: (open: boolean) => void;
  onSetDescription: (description: string) => void;
  onSetCurrency: (type: keyof Currency, amount: number) => void;
}

/** Relocated to `@/utils/itemPricing` in Task 10 (VTT merchants Slice 3) so
 *  the player shop dialog can use it too — re-exported here so existing
 *  imports of `PriceDenominations` from this module keep working. */
export type { PriceDenominations } from '@/utils/itemPricing';

export interface ShopStockRowProps {
  item: NPCInventoryItem;
  /** Whether `npc.shop.open` is true — changes the unpriceable-row copy. */
  shopOpen: boolean;
  /** Units of this row sold across the retained sales log (see
   *  `soldQuantityByItemId`). 0 renders no "N sold" badge at all. */
  soldCount: number;
  readOnly?: boolean;
  onPatch: (patch: Partial<NPCInventoryItem>) => void;
}
