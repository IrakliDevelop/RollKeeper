'use client';

import { Section } from '@/components/ui/layout/section';
import { useNPCStore } from '@/store/npcStore';
import type { Currency } from '@/types/character';
import type { NPCInventoryItem } from '@/types/encounter';
import { ShopStockRow } from './ShopStockRow';
import { ShopOpenSection } from './ShopOpenSection';
import { ShopSalesLog } from './ShopSalesLog';
import { useShopPublish, useShopSalesLog } from './NPCShopTab.hooks';
import {
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
 * DM-only merchant authoring surface, laid out as three stacked parts: the
 * open-for-business switch with the purse and shop description
 * (`ShopOpenSection`), the Stock section (one row per inventory item,
 * `ShopStockRow`), and the Sales log section (`ShopSalesLog`). Publishing and
 * teardown against `PUT /shops/[npcId]`, `entityIds` resolution, the publish
 * error with its retry, and the debounced republish-while-open all live in
 * `useShopPublish`; this component owns local NPC-store writes and layout
 * only.
 */
export function NPCShopTab({ npc, readOnly = false }: NPCShopTabProps) {
  const inventory = npc.inventory ?? [];
  const shopOpen = npc.shop?.open ?? false;
  const { setOpen, publishError, republish, retryPublish } =
    useShopPublish(npc);
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
        onRetryPublish={retryPublish}
        onSetDescription={setDescription}
        onSetCurrency={setCurrency}
      />

      <Section level={3} heading="Stock" contentClassName="space-y-2">
        <p className="type-small text-muted">
          {shopStockHelperText(shopOpen, npc.name)}
        </p>

        {inventory.length === 0 ? (
          <p className="type-body text-muted">
            No inventory yet — add items in the Inventory tab first.
          </p>
        ) : (
          <ul className="divide-divider divide-y">
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
          </ul>
        )}
      </Section>

      <ShopSalesLog campaignCode={npc.campaignCode} entries={salesLog} />
    </div>
  );
}
