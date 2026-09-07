import type { Currency } from '@/types/character';
import type { PublicShopItem } from '@/types/shop';
import { ShopItemCard } from './ShopItemCard';

/** Renders one `ShopItemCard` per shop row, clamping each row's displayed
 *  quantity to `[1, max(1, remainingQuantity)]` — stock can shrink under a
 *  stale selection (another player bought some) between renders. */
export function ShopItemList({
  items,
  purse,
  quantities,
  purchasingEntryId,
  results,
  onQuantityChange,
  onBuy,
}: {
  items: PublicShopItem[];
  purse: Currency;
  quantities: Record<string, number>;
  purchasingEntryId: string | null;
  results: Record<string, { message: string; tone: 'success' | 'error' }>;
  onQuantityChange: (entryId: string, quantity: number) => void;
  onBuy: (item: PublicShopItem) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map(item => {
        const maxQuantity = Math.max(1, item.remainingQuantity);
        const quantity = Math.min(quantities[item.id] ?? 1, maxQuantity);
        return (
          <ShopItemCard
            key={item.id}
            item={item}
            purse={purse}
            quantity={quantity}
            onQuantityChange={q => onQuantityChange(item.id, q)}
            purchasing={purchasingEntryId === item.id}
            resultMessage={results[item.id]?.message}
            resultTone={results[item.id]?.tone}
            onBuy={() => onBuy(item)}
          />
        );
      })}
    </div>
  );
}
