'use client';

import { Minus, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { cn } from '@/utils/cn';
import {
  canAfford,
  formatCurrencyFromCopper,
  purseToCopper,
} from '@/utils/currency';
import { formatShortfall } from './PlayerShopDialog.utils';
import type { ShopItemCardProps } from './PlayerShopDialog.types';

/**
 * One row of the player shop dialog (artboard 1b) — affordable / unaffordable
 * / sold-out. `quantity`/`onQuantityChange` are lifted to the parent dialog
 * (it needs the current selection to drive the footer's purchase preview).
 *
 * Affordability and the shortfall pill are both derived from `canAfford`/
 * `purseToCopper` — the same `currency.ts` helpers `spendCopper` (the actual
 * debit, applied later when the granting transfer merges) is checked
 * against — never a re-implementation of that math.
 */
export function ShopItemCard({
  item,
  purse,
  quantity,
  onQuantityChange,
  purchasing,
  resultMessage,
  resultTone,
  onBuy,
}: ShopItemCardProps) {
  const soldOut = item.remainingQuantity <= 0;
  const maxQuantity = Math.max(1, item.remainingQuantity);
  const totalCostCopper = item.priceCopper * quantity;
  const affordable = !soldOut && canAfford(purse, totalCostCopper);
  const shortfallCopper = affordable
    ? 0
    : totalCostCopper - purseToCopper(purse);

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'type-subheading',
              soldOut ? 'text-muted' : 'text-heading'
            )}
          >
            {item.name}
          </span>
          {soldOut && <Badge variant="neutral">Sold out</Badge>}
        </span>
        <span className="type-small text-body">
          {formatCurrencyFromCopper(item.priceCopper)} each ·{' '}
          {soldOut ? 'none left' : `${item.remainingQuantity} left`}
        </span>
        {!soldOut && !affordable && (
          <Badge variant="warning" className="w-fit">
            {formatShortfall(shortfallCopper)}
          </Badge>
        )}
        {resultMessage && (
          <span
            role={resultTone === 'error' ? 'alert' : 'status'}
            className={cn(
              'type-small',
              resultTone === 'error' ? 'text-blood-text' : 'text-verdigris-text'
            )}
          >
            {resultMessage}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={`Fewer ${item.name}`}
          className="w-9 shrink-0 px-0"
          disabled={soldOut || quantity <= 1}
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
        >
          <Minus size={16} aria-hidden />
        </Button>
        <span className="type-ui text-heading min-w-8 text-center tabular-nums">
          {soldOut ? 0 : quantity}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={`More ${item.name}`}
          className="w-9 shrink-0 px-0"
          disabled={soldOut || quantity >= maxQuantity}
          onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
        >
          <Plus size={16} aria-hidden />
        </Button>
      </div>

      {soldOut ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled
          className="shrink-0 sm:min-w-36"
        >
          Sold out
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!affordable || purchasing}
          onClick={onBuy}
          className="shrink-0 sm:min-w-36"
        >
          {purchasing
            ? 'Buying…'
            : `Buy · ${formatCurrencyFromCopper(totalCostCopper)}`}
        </Button>
      )}
    </li>
  );
}
