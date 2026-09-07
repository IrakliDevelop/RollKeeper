'use client';

import { Card } from '@/components/ui/layout/card';
import { useNPCStore } from '@/store/npcStore';
import { cn } from '@/utils/cn';
import type { Currency } from '@/types/character';
import type { NPCInventoryItem } from '@/types/encounter';
import { ShopStockRow } from './ShopStockRow';
import { ShopOpenSection } from './ShopOpenSection';
import { useShopPublish } from './NPCShopTab.hooks';
import { SHOP_STOCK_GRID_COLS } from './NPCShopTab.utils';
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
 * 1a for the exact copy and layout this implements (artboard 1a's open-state
 * chrome — the bordered card, the subtitle/stock-helper copy that changes
 * when open — is Task 13b, not here). Publishing/teardown against
 * `PUT /shops/[npcId]` and `entityIds` resolution live in `useShopPublish`
 * (Task 13a); this component owns local NPC-store writes and layout only.
 */
export function NPCShopTab({ npc, readOnly = false }: NPCShopTabProps) {
  const inventory = npc.inventory ?? [];
  const shopOpen = npc.shop?.open ?? false;
  const { setOpen, publishError } = useShopPublish(npc);

  const patchItem = (itemId: string, patch: Partial<NPCInventoryItem>) => {
    const updated = inventory.map(item =>
      item.id === itemId ? { ...item, ...patch } : item
    );
    useNPCStore
      .getState()
      .updateNPC(npc.campaignCode, npc.id, { inventory: updated });
  };

  // Local authoring only — publishing a description change while the shop
  // is already open still requires the DM to toggle it (same as any other
  // Shop tab edit); see the Task 13a report for why that's in scope here.
  const setDescription = (description: string) => {
    useNPCStore.getState().updateNPC(npc.campaignCode, npc.id, {
      shop: {
        open: false,
        ...npc.shop,
        description,
        updatedAt: new Date().toISOString(),
      },
    });
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
        onSetOpen={setOpen}
        onSetDescription={setDescription}
        onSetCurrency={setCurrency}
      />

      <section className="space-y-2">
        <div>
          <h3 className="text-heading text-sm font-semibold">Stock</h3>
          <p className="text-muted text-xs">
            Price falls back to the item&apos;s value, then its rarity.
            Placeholder is what players would pay.
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
                onPatch={patch => patchItem(item.id, patch)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-heading text-sm font-semibold">Sales log</h3>
        <Card padding="md" className="text-muted text-sm">
          No sales yet. Sales appear here once the shop is open, even if your
          tab was closed at the time.
        </Card>
      </section>
    </div>
  );
}
