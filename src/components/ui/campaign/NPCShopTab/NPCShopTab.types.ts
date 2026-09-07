import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';

export interface NPCShopTabProps {
  npc: CampaignNPC;
  /** Viewer cannot edit — every control renders disabled. */
  readOnly?: boolean;
}

/** A price split into the three entry denominations the Shop tab edits directly. */
export interface PriceDenominations {
  gp: number;
  sp: number;
  cp: number;
}

export interface ShopStockRowProps {
  item: NPCInventoryItem;
  /** Whether `npc.shop.open` is true — changes the unpriceable-row copy. */
  shopOpen: boolean;
  readOnly?: boolean;
  onPatch: (patch: Partial<NPCInventoryItem>) => void;
}
