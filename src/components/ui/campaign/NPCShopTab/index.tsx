'use client';

import { Card } from '@/components/ui/layout/card';
import { Switch } from '@/components/ui/forms/switch';
import { NPCCurrencyStrip } from '../NPCCurrencyStrip';
import { useNPCStore } from '@/store/npcStore';
import type { Currency } from '@/types/character';
import type { NPCInventoryItem } from '@/types/encounter';
import { ShopStockRow } from './ShopStockRow';
import type { NPCShopTabProps } from './NPCShopTab.types';

const EMPTY_CURRENCY: Currency = {
  platinum: 0,
  gold: 0,
  electrum: 0,
  silver: 0,
  copper: 0,
};

/**
 * DM-only merchant authoring surface (Slice 2 — publishes nothing
 * player-reachable). See the Task 5 brief and spec artboard 1a for the exact
 * copy and layout this implements.
 */
export function NPCShopTab({ npc, readOnly = false }: NPCShopTabProps) {
  const inventory = npc.inventory ?? [];
  const shopOpen = npc.shop?.open ?? false;

  const patchItem = (itemId: string, patch: Partial<NPCInventoryItem>) => {
    const updated = inventory.map(item =>
      item.id === itemId ? { ...item, ...patch } : item
    );
    useNPCStore
      .getState()
      .updateNPC(npc.campaignCode, npc.id, { inventory: updated });
  };

  const setOpen = (open: boolean) => {
    useNPCStore.getState().updateNPC(npc.campaignCode, npc.id, {
      shop: { open, updatedAt: new Date().toISOString() },
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Switch
          checked={shopOpen}
          disabled={readOnly}
          onCheckedChange={setOpen}
          aria-label="Open for business"
          label="Open for business"
          description="Players can't see this stock yet. Turn it on to publish."
        />
        <NPCCurrencyStrip
          currency={{ ...EMPTY_CURRENCY, ...npc.currency }}
          readonly={readOnly}
          onChange={readOnly ? undefined : setCurrency}
          label="Merchant's purse"
        />
      </div>

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
            <div className="text-muted grid grid-cols-[1fr_auto_auto_auto] gap-3 px-2 text-[10px] font-semibold uppercase">
              <span>Item</span>
              <span>For sale</span>
              <span>Price</span>
              <span>Stock</span>
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
