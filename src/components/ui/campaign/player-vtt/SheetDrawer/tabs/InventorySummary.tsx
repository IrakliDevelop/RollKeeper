'use client';

import { useEffect, useRef } from 'react';

import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Section } from '@/components/ui/layout/section';
import { useCharacterStore } from '@/store/characterStore';
import { cn } from '@/utils/cn';

import type { Currency } from '@/types/character';

import type { InventorySummaryView } from '../SheetDrawer.types';

export interface InventorySummaryProps {
  locked: boolean;
  summary: InventorySummaryView;
}

const COIN_NAMES: Record<keyof Currency, string> = {
  platinum: 'Platinum pieces',
  gold: 'Gold pieces',
  electrum: 'Electrum pieces',
  silver: 'Silver pieces',
  copper: 'Copper pieces',
};

function formatWeight(weight: number): number {
  return Math.round(weight * 10) / 10;
}

interface CoinInputProps {
  coinKey: keyof Currency;
  value: number;
}

/**
 * Editable coin field. Deltas are computed against the value this input last
 * emitted (not live store state), so per-keystroke onChange stays correct in a
 * follower tab whose store only updates after the leader round-trips.
 */
function CoinInput({ coinKey, value }: CoinInputProps) {
  const addCurrency = useCharacterStore(s => s.addCurrency);
  const subtractCurrency = useCharacterStore(s => s.subtractCurrency);
  const lastEmittedRef = useRef(value);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) lastEmittedRef.current = value;
  }, [value]);

  const handleChange = (next: number | undefined) => {
    if (next === undefined) return;
    // Min/max on NumberInput are only enforced on blur, so a mid-typed
    // negative value (e.g. "-5") would otherwise reach here as-is and
    // produce an oversized delta against the last-emitted value. Clamp to a
    // non-negative integer before computing the delta.
    const clamped = Math.max(0, Math.trunc(next));
    const diff = clamped - lastEmittedRef.current;
    lastEmittedRef.current = clamped;
    if (diff > 0) addCurrency(coinKey, diff);
    else if (diff < 0) subtractCurrency(coinKey, -diff);
  };

  return (
    <NumberInput
      id={`sheet-inventory-currency-${coinKey}`}
      aria-label={COIN_NAMES[coinKey]}
      value={value}
      onChange={handleChange}
      onFocus={() => {
        editingRef.current = true;
      }}
      onBlur={() => {
        editingRef.current = false;
      }}
      min={0}
      size="sm"
      wrapperClassName="w-16"
    />
  );
}

/** Currency chips, carried-weight bar, and attunement count for the Inventory tab. */
export function InventorySummary({ locked, summary }: InventorySummaryProps) {
  const rawPercent =
    summary.capacity > 0 ? (summary.weight / summary.capacity) * 100 : 0;

  const encumbered = rawPercent > 100;

  return (
    <Section heading="Carried" level={4}>
      <div className="flex flex-wrap items-center gap-3">
        {summary.currency.map(coin => (
          <div key={coin.key} className="flex items-center gap-1">
            {locked ? (
              <span className="type-ui text-body tabular-nums">
                {coin.value}
              </span>
            ) : (
              <CoinInput coinKey={coin.key} value={coin.value} />
            )}
            <span className="type-small text-muted">{coin.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="type-small text-muted flex justify-between">
          <span>Carried weight</span>
          <span className={cn(encumbered && 'text-ember-text')}>
            {formatWeight(summary.weight)} / {summary.capacity} lb
          </span>
        </div>
        <div className="bg-divider mt-1 h-1 w-full">
          <div
            className={cn(
              'h-full',
              encumbered ? 'bg-ember-fill' : 'bg-heading'
            )}
            style={{ width: `${Math.min(100, summary.weightPercent)}%` }}
          />
        </div>
        {encumbered && (
          <p className="type-small text-ember-text mt-1">Encumbered</p>
        )}
      </div>

      <div className="type-small text-muted mt-2">
        Attunement {summary.attuned} / {summary.attunementMax}
      </div>
    </Section>
  );
}
