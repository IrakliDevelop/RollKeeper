import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';

export interface NPCShopTabProps {
  npc: CampaignNPC;
  /** Viewer cannot edit — every control renders disabled. */
  readOnly?: boolean;
}

/** Relocated to `@/utils/itemPricing` in Task 10 (VTT merchants Slice 3) so
 *  the player shop dialog can use it too — re-exported here so existing
 *  imports of `PriceDenominations` from this module keep working. */
export type { PriceDenominations } from '@/utils/itemPricing';

export interface ShopStockRowProps {
  item: NPCInventoryItem;
  /** Whether `npc.shop.open` is true — changes the unpriceable-row copy. */
  shopOpen: boolean;
  readOnly?: boolean;
  onPatch: (patch: Partial<NPCInventoryItem>) => void;
}
