'use client';

import { Badge } from '@/components/ui/layout/badge';
import { Switch } from '@/components/ui/forms/switch';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { resolvePriceCopper } from '@/utils/itemPricing';
import { cn } from '@/utils/cn';
import {
  defaultPriceCopper,
  denominationsToPriceCopper,
  getProvenanceLine,
  priceCopperToDenominations,
} from './NPCShopTab.utils';
import type { PriceDenominations, ShopStockRowProps } from './NPCShopTab.types';

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
  const placeholder = priceCopperToDenominations(defaultPriceCopper(item) ?? 0);
  const overrideParts =
    item.priceCopper !== undefined
      ? priceCopperToDenominations(item.priceCopper)
      : null;

  const handlePriceChange = (
    denom: keyof PriceDenominations,
    value: number | undefined
  ) => {
    const base = overrideParts ?? { gp: 0, sp: 0, cp: 0 };
    onPatch({
      priceCopper: denominationsToPriceCopper({ ...base, [denom]: value ?? 0 }),
    });
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-lg border p-2',
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
        disabled={readOnly || priceRequired}
        onCheckedChange={checked => onPatch({ forSale: checked })}
        aria-label={`List ${item.name} for sale`}
        size="sm"
      />

      <div className="flex items-center gap-1">
        {(['gp', 'sp', 'cp'] as const).map(denom => (
          <span key={denom} className="flex items-center gap-0.5">
            <NumberInput
              aria-label={`${item.name} price (${denom})`}
              value={overrideParts?.[denom]}
              onChange={v => handlePriceChange(denom, v)}
              placeholder={String(placeholder[denom])}
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
