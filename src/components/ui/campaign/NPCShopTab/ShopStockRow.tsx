'use client';

import { Badge } from '@/components/ui/layout/badge';
import { Switch } from '@/components/ui/forms/switch';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { resolvePriceCopper } from '@/utils/itemPricing';
import { cn } from '@/utils/cn';
import { usePriceDraft } from './ShopStockRow.hooks';
import {
  defaultPriceCopper,
  getProvenanceLine,
  priceCopperToDenominations,
  SHOP_STOCK_GRID_COLS,
} from './NPCShopTab.utils';
import type { ShopStockRowProps } from './NPCShopTab.types';

const RARITY_BADGE_VARIANT: Record<
  string,
  'neutral' | 'info' | 'success' | 'warning' | 'danger'
> = {
  common: 'neutral',
  uncommon: 'success',
  rare: 'info',
  'very rare': 'warning',
  legendary: 'danger',
  artifact: 'danger',
};

/** One Stock row: item identity + provenance, for-sale switch, price entry, stock. */
export function ShopStockRow({
  item,
  shopOpen,
  readOnly = false,
  onPatch,
}: ShopStockRowProps) {
  const priceRequired = resolvePriceCopper(item) === null;
  const rarity = item.magicItem?.rarity ?? item.rarity;
  const defaultPrice = defaultPriceCopper(item);
  // `null` means no derivable price — leave the placeholder blank rather
  // than showing 0, since 0 copper is itself a legitimate DM-authored price.
  const placeholder =
    defaultPrice !== null ? priceCopperToDenominations(defaultPrice) : null;
  const { draft, setDenomination } = usePriceDraft(
    item.priceCopper,
    priceCopper => onPatch({ priceCopper })
  );

  return (
    <div
      className={cn(
        'grid items-center gap-3 rounded-lg border p-2',
        SHOP_STOCK_GRID_COLS,
        priceRequired
          ? 'border-accent-amber-border bg-accent-amber-bg'
          : 'border-divider bg-surface-raised'
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-heading truncate text-sm font-medium">
            {item.name}
          </span>
          {rarity && rarity !== 'none' && (
            <Badge
              variant={RARITY_BADGE_VARIANT[rarity] ?? 'neutral'}
              size="sm"
            >
              {rarity}
            </Badge>
          )}
          {priceRequired && (
            <Badge variant="warning" size="sm">
              price required
            </Badge>
          )}
        </div>
        <p className="text-muted text-xs">
          {priceRequired && shopOpen
            ? 'not published — players never see it'
            : getProvenanceLine(item)}
        </p>
      </div>

      <Switch
        checked={!!item.forSale}
        disabled={readOnly || (priceRequired && !item.forSale)}
        onCheckedChange={checked => onPatch({ forSale: checked })}
        aria-label={`List ${item.name} for sale`}
        size="sm"
        className="justify-self-center"
      />

      <div className="flex items-center gap-1">
        {(['gp', 'sp', 'cp'] as const).map(denom => (
          <span key={denom} className="flex items-center gap-0.5">
            <NumberInput
              aria-label={`${item.name} price (${denom})`}
              value={draft[denom]}
              onChange={v => setDenomination(denom, v)}
              placeholder={placeholder ? String(placeholder[denom]) : undefined}
              min={0}
              allowEmpty
              disabled={readOnly}
              className={cn(
                'w-14 text-right tabular-nums',
                priceRequired && 'border-accent-amber-border'
              )}
            />
            <span className="text-faint text-[10px]">{denom}</span>
          </span>
        ))}
      </div>

      <NumberInput
        aria-label={`${item.name} stock quantity`}
        value={item.quantity}
        onChange={v => onPatch({ quantity: v ?? 0 })}
        min={0}
        disabled={readOnly}
        className="w-16 text-right tabular-nums"
      />
    </div>
  );
}
