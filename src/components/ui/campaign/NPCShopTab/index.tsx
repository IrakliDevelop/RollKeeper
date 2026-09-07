'use client';

import { useNPCStore } from '@/store/npcStore';
import { cn } from '@/utils/cn';
import type { Currency } from '@/types/character';
import type { NPCInventoryItem } from '@/types/encounter';
import { ShopStockRow } from './ShopStockRow';
import { ShopOpenSection } from './ShopOpenSection';
import { ShopSalesLog } from './ShopSalesLog';
import { useShopPublish, useShopSalesLog } from './NPCShopTab.hooks';
import {
  SHOP_STOCK_GRID_COLS,
  countItemsInStock,
  shopStockHelperText,
  soldQuantityByItemId,
  todaysSalesCopper,
} from './NPCShopTab.utils';
import type { NPCShopTabProps } from './NPCShopTab.types';

const EMPTY_CURRENCY: Currency = {
  platinum: 0,
  gold: 0,
  electrum: 0,
  silver: 0,
  copper: 0,
};

/**
 * DM-only merchant authoring surface. See the Task 5 brief and spec artboard
 * 1a for the exact copy and layout this implements — including the
 * open-state chrome (bordered/tinted toggle card, subtitle and Stock helper
 * copy that switch when open, the "Open" header badge, and the populated
 * sales log) added in Task 13b. Publishing/teardown against
 * `PUT /shops/[npcId]`, `entityIds` resolution, and the debounced
 * republish-while-open all live in `useShopPublish` (Task 13a/13b); this
 * component owns local NPC-store writes and layout only.
 */
export function NPCShopTab({ npc, readOnly = false }: NPCShopTabProps) {
  const inventory = npc.inventory ?? [];
  const shopOpen = npc.shop?.open ?? false;
  const { setOpen, publishError, republish } = useShopPublish(npc);
  const salesLog = useShopSalesLog(npc.id);
  const soldByItemId = soldQuantityByItemId(salesLog);

  const patchItem = (itemId: string, patch: Partial<NPCInventoryItem>) => {
    const updated = inventory.map(item =>
      item.id === itemId ? { ...item, ...patch } : item
    );
    useNPCStore
      .getState()
      .updateNPC(npc.campaignCode, npc.id, { inventory: updated });
    // Price/forSale/quantity are all shop-relevant — republish while the
    // shop is already open (Task 13b, controller ruling R22) rather than
    // requiring an off/on toggle to reach players. `republish()` no-ops if
    // the shop isn't open, so this guard is an optimization, not a
    // correctness requirement.
    if (shopOpen) republish();
  };

  const setDescription = (description: string) => {
    useNPCStore.getState().updateNPC(npc.campaignCode, npc.id, {
      shop: {
        open: false,
        ...npc.shop,
        description,
        updatedAt: new Date().toISOString(),
      },
    });
    if (shopOpen) republish();
  };

  const setCurrency = (type: keyof Currency, amount: number) => {
    const currency = { ...EMPTY_CURRENCY, ...npc.currency };
    useNPCStore.getState().updateNPC(npc.campaignCode, npc.id, {
      currency: { ...currency, [type]: amount },
    });
  };

  return (
    <div className="space-y-6">
      <ShopOpenSection
        npcName={npc.name}
        shopOpen={shopOpen}
        description={npc.shop?.description ?? ''}
        readOnly={readOnly}
        publishError={publishError}
        currency={{ ...EMPTY_CURRENCY, ...npc.currency }}
        itemsInStock={countItemsInStock(inventory)}
        todayCopper={todaysSalesCopper(salesLog)}
        onSetOpen={setOpen}
        onSetDescription={setDescription}
        onSetCurrency={setCurrency}
      />

      <section className="space-y-2">
        <div>
          <h3 className="text-heading text-sm font-semibold">Stock</h3>
          <p className="text-muted text-xs">
            {shopStockHelperText(shopOpen, npc.name)}
          </p>
        </div>

        {inventory.length === 0 ? (
          <p className="text-faint text-sm">
            No inventory yet — add items in the Inventory tab first.
          </p>
        ) : (
          <div className="space-y-2">
            <div
              className={cn(
                'text-muted grid gap-3 px-2 text-[10px] font-semibold uppercase',
                SHOP_STOCK_GRID_COLS
              )}
            >
              <span>Item</span>
              <span className="text-center">For sale</span>
              <span>Price</span>
              <span className="text-right">Stock</span>
            </div>
            {inventory.map(item => (
              <ShopStockRow
                key={item.id}
                item={item}
                shopOpen={shopOpen}
                readOnly={readOnly}
                soldCount={soldByItemId.get(item.id) ?? 0}
                onPatch={patch => patchItem(item.id, patch)}
              />
            ))}
          </div>
        )}
      </section>

      <ShopSalesLog campaignCode={npc.campaignCode} entries={salesLog} />
    </div>
  );
}
