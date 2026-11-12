'use client';

import type { ReactNode } from 'react';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import type { Currency } from '@/types/character';

const COINS: Array<{ type: keyof Currency; label: string }> = [
  { type: 'platinum', label: 'PP' },
  { type: 'gold', label: 'GP' },
  { type: 'electrum', label: 'EP' },
  { type: 'silver', label: 'SP' },
  { type: 'copper', label: 'CP' },
];

export const COIN_NAMES: Record<keyof Currency, string> = {
  platinum: 'PP (platinum pieces)',
  gold: 'GP (gold pieces)',
  electrum: 'EP (electrum pieces)',
  silver: 'SP (silver pieces)',
  copper: 'CP (copper pieces)',
};

interface NPCCurrencyStripProps {
  currency: Currency;
  readonly?: boolean;
  onChange?: (type: keyof Currency, amount: number) => void;
  /** Heading above the coin grid. Defaults to 'Currency'. */
  label?: string;
  /** Optional content rendered right-aligned beside `label` (e.g. the
   *  Shop tab's "+165 gp today" sales delta, artboard 1a open state). */
  labelExtra?: ReactNode;
}

/** A modal-sized currency editor: one compact row with direct balances. */
export function NPCCurrencyStrip({
  currency,
  readonly = false,
  onChange,
  label = 'Currency',
  labelExtra,
}: NPCCurrencyStripProps) {
  return (
    <section
      aria-label="NPC currency"
      className="min-w-0 flex-1 basis-[18rem] space-y-1.5"
    >
      <div className="type-small text-muted flex items-center justify-between gap-1.5">
        <span>{label}</span>
        {labelExtra}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {COINS.map(coin => (
          <div key={coin.type} className="flex min-w-0 flex-col gap-1">
            <span className="type-small text-muted">{coin.label}</span>
            {readonly || !onChange ? (
              <span className="type-ui text-heading truncate tabular-nums">
                {currency[coin.type].toLocaleString()}
              </span>
            ) : (
              <NumberInput
                size="sm"
                min={0}
                inputMode="numeric"
                aria-label={COIN_NAMES[coin.type]}
                value={currency[coin.type]}
                onChange={value => onChange(coin.type, Math.max(0, value ?? 0))}
                className="px-2 text-right tabular-nums"
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
