'use client';

import { useId, useState } from 'react';
import type { Currency } from '@/types/character';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Section } from '@/components/ui/layout/section';

const CURRENCY_TYPES: Array<{
  type: keyof Currency;
  name: string;
  abbr: string;
  copper: number;
}> = [
  { type: 'platinum', name: 'Platinum', abbr: 'pp', copper: 1000 },
  { type: 'gold', name: 'Gold', abbr: 'gp', copper: 100 },
  { type: 'electrum', name: 'Electrum', abbr: 'ep', copper: 50 },
  { type: 'silver', name: 'Silver', abbr: 'sp', copper: 10 },
  { type: 'copper', name: 'Copper', abbr: 'cp', copper: 1 },
];

interface CurrencyManagerProps {
  currency: Currency;
  onAddCurrency?: (type: keyof Currency, amount: number) => void;
  onSubtractCurrency?: (type: keyof Currency, amount: number) => void;
  readonly?: boolean;
  compact?: boolean;
  hideControls?: boolean;
  hideConversionInfo?: boolean;
  showOnlyTotal?: boolean;
  hideIndividualCurrencies?: boolean;
  className?: string;
}

function wealthBreakdown(totalCopper: number) {
  if (totalCopper === 0) return '0 gp';
  const result: string[] = [];
  let remaining = totalCopper;
  if (remaining >= 100) {
    result.push(`${Math.floor(remaining / 100)} gp`);
    remaining %= 100;
  }
  if (remaining >= 10) {
    result.push(`${Math.floor(remaining / 10)} sp`);
    remaining %= 10;
  }
  if (remaining > 0) result.push(`${remaining} cp`);
  return result.join(', ');
}

export function CurrencyManager({
  currency,
  onAddCurrency,
  onSubtractCurrency,
  readonly = false,
  compact = false,
  hideControls = false,
  hideConversionInfo = false,
  showOnlyTotal = false,
  hideIndividualCurrencies = false,
  className = '',
}: CurrencyManagerProps) {
  const id = useId();
  const [amounts, setAmounts] = useState<Currency>({
    copper: 0,
    silver: 0,
    electrum: 0,
    gold: 0,
    platinum: 0,
  });
  const totalCopper = CURRENCY_TYPES.reduce(
    (sum, coin) => sum + (currency[coin.type] || 0) * coin.copper,
    0
  );
  const canTransact =
    !readonly && !hideControls && !!(onAddCurrency || onSubtractCurrency);
  const transact = (
    type: keyof Currency,
    action: ((type: keyof Currency, amount: number) => void) | undefined
  ) => {
    const amount = amounts[type];
    if (amount > 0 && action) {
      action(type, amount);
      setAmounts(previous => ({ ...previous, [type]: 0 }));
    }
  };

  return (
    <Section heading="Currency" className={className}>
      <div className="space-y-5">
        <div>
          <p className="text-muted type-small">Total</p>
          <p className="text-heading type-subheading">
            {wealthBreakdown(totalCopper)}
          </p>
          <p className="text-muted type-small">
            {totalCopper.toLocaleString()} cp
          </p>
        </div>

        {!showOnlyTotal && (!hideIndividualCurrencies || canTransact) && (
          <div className="border-divider border-t">
            {canTransact && (
              <h3 className="text-heading type-label-heading pt-3">
                Add or spend coins
              </h3>
            )}
            {CURRENCY_TYPES.map(coin => {
              const inputId = `${id}-${coin.type}`;
              return (
                <div
                  key={coin.type}
                  className="border-divider flex min-w-0 flex-col gap-2 border-b py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 items-baseline justify-between gap-4 sm:w-44 sm:shrink-0">
                    <label
                      htmlFor={canTransact ? inputId : undefined}
                      className="text-heading font-medium"
                    >
                      {compact ? coin.abbr : coin.name}
                    </label>
                    {!hideIndividualCurrencies && (
                      <span className="text-heading font-semibold tabular-nums">
                        {currency[coin.type] || 0}{' '}
                        <span className="text-muted font-normal">
                          {coin.abbr}
                        </span>
                      </span>
                    )}
                  </div>
                  {canTransact && (
                    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-1">
                      <NumberInput
                        id={inputId}
                        allowEmpty
                        min={0}
                        placeholder="0"
                        aria-label={`${coin.name} amount`}
                        value={amounts[coin.type] || undefined}
                        onChange={value =>
                          setAmounts(previous => ({
                            ...previous,
                            [coin.type]: value ?? 0,
                          }))
                        }
                        className="min-w-0 text-center"
                        wrapperClassName="min-w-0 flex-[1_1_7rem]"
                      />
                      {onAddCurrency && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Add ${coin.type}`}
                          disabled={amounts[coin.type] <= 0}
                          onClick={() => transact(coin.type, onAddCurrency)}
                        >
                          Add
                        </Button>
                      )}
                      {onSubtractCurrency && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Spend ${coin.type}`}
                          disabled={amounts[coin.type] <= 0}
                          onClick={() =>
                            transact(coin.type, onSubtractCurrency)
                          }
                        >
                          Spend
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!showOnlyTotal && !hideConversionInfo && !compact && (
          <div>
            <h3 className="text-heading type-label-heading">Conversion</h3>
            <p className="text-muted mt-1 text-sm">
              10 cp = 1 sp · 5 sp = 1 ep · 10 sp = 1 gp · 10 gp = 1 pp
            </p>
          </div>
        )}
      </div>
    </Section>
  );
}
