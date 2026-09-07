'use client';

import { Minus, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { Card } from '@/components/ui/layout/card';
import { cn } from '@/utils/cn';
import {
  canAfford,
  formatCurrencyFromCopper,
  purseToCopper,
} from '@/utils/currency';
import { formatShortfall } from './PlayerShopDialog.utils';
import type { ShopItemCardProps } from './PlayerShopDialog.types';

/** Matches artboard 1b's 48x48 stepper buttons. */
const STEPPER_BUTTON_CLASS = 'h-12 w-12 shrink-0 rounded-lg p-0';
const BUY_BUTTON_CLASS = 'h-12 shrink-0 sm:w-44';

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
    <Card
      className={cn(
        'flex flex-col gap-3 border-2 p-3.5 sm:flex-row sm:items-center',
        affordable
          ? 'border-accent-emerald-border bg-accent-emerald-bg'
          : 'border-divider bg-surface-secondary'
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-lg font-bold',
              soldOut ? 'text-muted' : 'text-heading'
            )}
          >
            {item.name}
          </span>
          {soldOut && <Badge variant="neutral">Sold out</Badge>}
        </span>
        <span className="text-body text-sm">
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
            className={cn(
              'text-sm font-medium',
              resultTone === 'error'
                ? 'text-accent-red-text'
                : 'text-accent-emerald-text'
            )}
          >
            {resultMessage}
          </span>
        )}
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center justify-center gap-2',
          soldOut && 'opacity-45'
        )}
      >
        <Button
          type="button"
          variant="outline"
          aria-label={`Fewer ${item.name}`}
          className={STEPPER_BUTTON_CLASS}
          disabled={soldOut || quantity <= 1}
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
        >
          <Minus size={20} />
        </Button>
        <span className="text-heading min-w-8 text-center text-lg font-bold tabular-nums">
          {soldOut ? 0 : quantity}
        </span>
        <Button
          type="button"
          variant="outline"
          aria-label={`More ${item.name}`}
          className={STEPPER_BUTTON_CLASS}
          disabled={soldOut || quantity >= maxQuantity}
          onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
        >
          <Plus size={20} />
        </Button>
      </div>

      {soldOut ? (
        <Button
          type="button"
          variant="outline"
          disabled
          className={BUY_BUTTON_CLASS}
        >
          Sold out
        </Button>
      ) : (
        <Button
          type="button"
          variant="primary"
          disabled={!affordable || purchasing}
          onClick={onBuy}
          className={BUY_BUTTON_CLASS}
        >
          {purchasing
            ? 'Buying…'
            : `Buy · ${formatCurrencyFromCopper(totalCostCopper)}`}
        </Button>
      )}
    </Card>
  );
}
