'use client';

import { Coins } from 'lucide-react';
import { NumberField } from '@/components/ui/forms/NumberInput';
import type { Currency } from '@/types/character';

const COINS: Array<{
  type: keyof Currency;
  label: string;
  classes: string;
}> = [
  {
    type: 'platinum',
    label: 'PP',
    classes: 'text-slate-600 dark:text-slate-300',
  },
  { type: 'gold', label: 'GP', classes: 'text-amber-600 dark:text-amber-300' },
  {
    type: 'electrum',
    label: 'EP',
    classes: 'text-emerald-600 dark:text-emerald-300',
  },
  { type: 'silver', label: 'SP', classes: 'text-blue-600 dark:text-blue-300' },
  {
    type: 'copper',
    label: 'CP',
    classes: 'text-orange-600 dark:text-orange-300',
  },
];

interface NPCCurrencyStripProps {
  currency: Currency;
  readonly?: boolean;
  onChange?: (type: keyof Currency, amount: number) => void;
}

/** A modal-sized currency editor: one compact row with direct balances. */
export function NPCCurrencyStrip({
  currency,
  readonly = false,
  onChange,
}: NPCCurrencyStripProps) {
  return (
    <section aria-label="NPC currency" className="space-y-1.5">
      <div className="text-muted flex items-center gap-1.5 text-xs font-semibold">
        <Coins className="h-3.5 w-3.5" />
        Currency
      </div>
      <div className="border-divider bg-surface-secondary grid grid-cols-5 gap-px overflow-hidden rounded-lg border">
        {COINS.map(coin => (
          <div
            key={coin.type}
            className="bg-surface flex min-w-0 items-center justify-center gap-1 px-1.5 py-1.5"
          >
            <span className={`text-[10px] font-bold ${coin.classes}`}>
              {coin.label}
            </span>
            {readonly || !onChange ? (
              <span className="text-heading min-w-0 truncate text-sm font-semibold tabular-nums">
                {currency[coin.type].toLocaleString()}
              </span>
            ) : (
              <NumberField
                aria-label={`${coin.label} balance`}
                value={currency[coin.type]}
                onChange={value => onChange(coin.type, Math.max(0, value ?? 0))}
                min={0}
                className="h-7 min-w-0 border-0 bg-transparent px-1 text-right text-sm font-semibold tabular-nums shadow-none"
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
