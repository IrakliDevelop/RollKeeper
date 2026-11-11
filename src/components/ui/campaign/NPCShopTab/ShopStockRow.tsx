'use client';

import { useId } from 'react';

import { Badge } from '@/components/ui/layout/badge';
import { Switch } from '@/components/ui/forms/switch';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import {
  resolvePriceCopper,
  priceCopperToDenominations,
} from '@/utils/itemPricing';
import { formatRarity } from '@/utils/formatRarity';
import { usePriceDraft } from './ShopStockRow.hooks';
import { defaultPriceCopper, getProvenanceLine } from './NPCShopTab.utils';
import type { ShopStockRowProps } from './NPCShopTab.types';

/** One Stock row: item identity + provenance, for-sale switch, price entry, stock. */
export function ShopStockRow({
  item,
  shopOpen,
  soldCount,
  readOnly = false,
  onPatch,
}: ShopStockRowProps) {
  const priceLabelId = useId();
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
    <li className="space-y-2 py-3 pointer-coarse:min-h-11">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-[1_1_12rem] flex-wrap items-center gap-1.5">
          <span className="type-ui text-heading break-words">{item.name}</span>
          {rarity && rarity !== 'none' && (
            <Badge variant="neutral" size="sm">
              {formatRarity(rarity)}
            </Badge>
          )}
          {priceRequired && (
            <Badge variant="warning" size="sm">
              Needs a price
            </Badge>
          )}
          {soldCount > 0 && (
            <Badge variant="neutral" size="sm">
              {soldCount} sold{item.quantity === 0 ? ' — none left' : ''}
            </Badge>
          )}
        </div>
        <div className="shrink-0">
          <Switch
            checked={!!item.forSale}
            disabled={readOnly || (priceRequired && !item.forSale)}
            onCheckedChange={checked => onPatch({ forSale: checked })}
            label="For sale"
            aria-label={`List ${item.name} for sale`}
          />
        </div>
      </div>

      <p className="type-small text-muted">
        {priceRequired && shopOpen
          ? 'Not listed until it has a price'
          : getProvenanceLine(item)}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-labelledby={priceLabelId}>
          <span id={priceLabelId} className="type-small text-muted">
            Price
          </span>
          <div className="flex items-end gap-1">
            {(['gp', 'sp', 'cp'] as const).map(denom => (
              <span key={denom} className="flex items-end gap-0.5">
                <NumberInput
                  aria-label={`${item.name} price (${denom})`}
                  value={draft[denom]}
                  onChange={v => setDenomination(denom, v)}
                  placeholder={
                    placeholder ? String(placeholder[denom]) : undefined
                  }
                  min={0}
                  allowEmpty
                  disabled={readOnly}
                  className="w-16 text-right tabular-nums"
                />
                <span className="type-small text-muted">{denom}</span>
              </span>
            ))}
          </div>
        </div>

        <NumberInput
          label="Stock"
          aria-label={`${item.name} stock quantity`}
          value={item.quantity}
          onChange={v => onPatch({ quantity: v ?? 0 })}
          min={0}
          disabled={readOnly}
          wrapperClassName="w-auto"
          className="w-16 text-right tabular-nums"
        />
      </div>
    </li>
  );
}
