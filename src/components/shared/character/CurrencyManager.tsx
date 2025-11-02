'use client';

import React, { useState } from 'react';
import { Currency } from '@/types/character';
import { Coins, Plus, Minus, Info } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Input } from '@/components/ui/forms/input';

const CURRENCY_TYPES: {
  [key in keyof Currency]: { name: string; abbr: string; color: string; badgeVariant: 'secondary' | 'warning' | 'success' | 'neutral' | 'danger' };
} = {
  platinum: { name: 'Platinum', abbr: 'pp', color: 'text-slate-700', badgeVariant: 'neutral' },
  gold: { name: 'Gold', abbr: 'gp', color: 'text-yellow-700', badgeVariant: 'warning' },
  electrum: { name: 'Electrum', abbr: 'ep', color: 'text-green-700', badgeVariant: 'success' },
  silver: { name: 'Silver', abbr: 'sp', color: 'text-gray-700', badgeVariant: 'secondary' },
  copper: { name: 'Copper', abbr: 'cp', color: 'text-orange-700', badgeVariant: 'danger' },
};

// Currency conversion rates (all relative to copper)
const CURRENCY_VALUES = {
  platinum: 1000,
  gold: 100,
  electrum: 50,
  silver: 10,
  copper: 1,
};

interface CurrencyManagerProps {
  currency: Currency;
  onAddCurrency?: (type: keyof Currency, amount: number) => void;
  onSubtractCurrency?: (type: keyof Currency, amount: number) => void;

  // Display options
  readonly?: boolean;
  compact?: boolean;
  hideControls?: boolean;
  hideConversionInfo?: boolean;
  showOnlyTotal?: boolean;
  hideIndividualCurrencies?: boolean;

  className?: string;
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
  const [currencyAmounts, setCurrencyAmounts] = useState<Currency>({
    copper: 0,
    silver: 0,
    electrum: 0,
    gold: 0,
    platinum: 0,
  });

  // Calculate total wealth in copper pieces
  const totalWealthInCopper = Object.entries(currency).reduce(
    (total, [type, amount]) => {
      return total + amount * CURRENCY_VALUES[type as keyof Currency];
    },
    0
  );

  // Convert total wealth to the most appropriate denominations
  const getWealthBreakdown = (totalCopper: number) => {
    if (totalCopper === 0) return 'No wealth';

    const breakdown = [];
    let remaining = totalCopper;

    // Convert to highest denominations first
    if (remaining >= CURRENCY_VALUES.platinum) {
      const pp = Math.floor(remaining / CURRENCY_VALUES.platinum);
      breakdown.push(`${pp} pp`);
      remaining %= CURRENCY_VALUES.platinum;
    }

    if (remaining >= CURRENCY_VALUES.gold) {
      const gp = Math.floor(remaining / CURRENCY_VALUES.gold);
      breakdown.push(`${gp} gp`);
      remaining %= CURRENCY_VALUES.gold;
    }

    if (remaining >= CURRENCY_VALUES.electrum) {
      const ep = Math.floor(remaining / CURRENCY_VALUES.electrum);
      breakdown.push(`${ep} ep`);
      remaining %= CURRENCY_VALUES.electrum;
    }

    if (remaining >= CURRENCY_VALUES.silver) {
      const sp = Math.floor(remaining / CURRENCY_VALUES.silver);
      breakdown.push(`${sp} sp`);
      remaining %= CURRENCY_VALUES.silver;
    }

    if (remaining > 0) {
      breakdown.push(`${remaining} cp`);
    }

    // Show up to 3 most significant denominations
    return breakdown.slice(0, 3).join(', ');
  };

  const handleCurrencyChange = (type: keyof Currency, value: string) => {
    const amount = parseInt(value) || 0;
    setCurrencyAmounts(prev => ({ ...prev, [type]: amount }));
  };

  const addCurrencyAmount = (type: keyof Currency) => {
    const amount = currencyAmounts[type];
    if (amount > 0 && onAddCurrency) {
      onAddCurrency(type, amount);
      setCurrencyAmounts(prev => ({ ...prev, [type]: 0 }));
    }
  };

  const subtractCurrencyAmount = (type: keyof Currency) => {
    const amount = currencyAmounts[type];
    if (amount > 0 && onSubtractCurrency) {
      onSubtractCurrency(type, amount);
      setCurrencyAmounts(prev => ({ ...prev, [type]: 0 }));
    }
  };

  const containerClasses = compact
    ? `bg-white rounded-lg shadow-sm border-2 border-yellow-200 p-4 ${className}`
    : `bg-white rounded-lg shadow-sm border-2 border-yellow-200 p-6 ${className}`;

  return (
    <div className={containerClasses}>
      <div className="mb-6 flex items-center justify-between border-b-2 border-yellow-200 pb-4">
        <h2
          className={`flex items-center gap-2 font-bold text-amber-800 ${compact ? 'text-base' : 'text-xl'}`}
        >
          <Coins className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
          {compact ? 'Currency' : 'Currency & Wealth'}
        </h2>
        <Badge variant="warning" size="md">
          {totalWealthInCopper.toLocaleString()} cp
        </Badge>
      </div>

      {/* Show only total wealth */}
      {showOnlyTotal ? (
        <div className="rounded-lg border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 p-6 text-center">
          <div
            className={`font-bold text-amber-800 ${compact ? 'mb-2 text-sm' : 'mb-2 text-lg'}`}
          >
            Total Wealth
          </div>
          <div
            className={`font-bold text-amber-900 ${compact ? 'text-xl' : 'text-2xl'}`}
          >
            {getWealthBreakdown(totalWealthInCopper)}
          </div>
          {!compact && (
            <Badge variant="warning" size="md" className="mt-3">
              {totalWealthInCopper.toLocaleString()} copper pieces
            </Badge>
          )}
        </div>
      ) : (
        <>
          {/* Current Currency Display */}
          {!hideIndividualCurrencies && (
            <div
              className={`grid gap-4 ${compact ? 'mb-4 grid-cols-3' : 'mb-6 grid-cols-2 sm:grid-cols-5'}`}
            >
              {Object.entries(CURRENCY_TYPES).map(([type, config]) => (
                <div key={type} className="text-center">
                  <div
                    className={`rounded-lg border-2 border-yellow-200 bg-gradient-to-b from-yellow-50 to-amber-50 transition-all hover:shadow-md hover:border-yellow-300 ${compact ? 'p-3' : 'p-4'}`}
                  >
                    <div
                      className={`font-bold ${config.color} ${compact ? 'mb-1 text-2xl' : 'mb-2 text-4xl'}`}
                    >
                      {currency[type as keyof Currency] || 0}
                    </div>
                    <Badge variant={config.badgeVariant} size="sm">
                      {config.abbr}
                    </Badge>
                    {!compact && (
                      <div className="mt-2 text-xs font-medium text-gray-600">
                        {config.name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total Wealth */}
          <div
            className={`rounded-lg border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 p-6 text-center ${compact ? 'mb-4' : 'mb-6'}`}
          >
            <div
              className={`font-bold text-amber-800 ${compact ? 'mb-2 text-sm' : 'mb-2 text-lg'}`}
            >
              Total Wealth
            </div>
            <div
              className={`font-bold text-amber-900 ${compact ? 'text-xl' : 'text-2xl'}`}
            >
              {getWealthBreakdown(totalWealthInCopper)}
            </div>
            {!compact && (
              <Badge variant="warning" size="md" className="mt-3">
                {totalWealthInCopper.toLocaleString()} copper pieces
              </Badge>
            )}
          </div>

          {/* Add/Subtract Currency */}
          {!readonly &&
            !hideControls &&
            (onAddCurrency || onSubtractCurrency) && (
              <div
                className={`rounded-lg border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 ${compact ? 'p-4' : 'p-6'}`}
              >
                <h3
                  className={`font-bold text-amber-800 ${compact ? 'mb-4 text-sm uppercase tracking-wide' : 'mb-4 text-base uppercase tracking-wide border-b-2 border-yellow-200 pb-2'}`}
                >
                  Manage Currency
                </h3>
                <div
                  className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-5'}`}
                >
                  {Object.entries(CURRENCY_TYPES).map(([type, config]) => (
                    <div key={type} className="space-y-2">
                      <label
                        className={`block font-bold text-amber-800 ${compact ? 'text-xs' : 'text-sm'}`}
                      >
                        {config.name}
                      </label>
                      <Input
                        type="number"
                        value={currencyAmounts[type as keyof Currency] || ''}
                        onChange={e =>
                          handleCurrencyChange(
                            type as keyof Currency,
                            e.target.value
                          )
                        }
                        placeholder="0"
                        min={0}
                        className="text-center"
                      />
                      <div className="flex gap-1">
                        {onAddCurrency && (
                          <Button
                            onClick={() =>
                              addCurrencyAmount(type as keyof Currency)
                            }
                            variant="success"
                            size="xs"
                            fullWidth
                            leftIcon={<Plus size={12} />}
                            disabled={currencyAmounts[type as keyof Currency] <= 0}
                          >
                            Add
                          </Button>
                        )}
                        {onSubtractCurrency && (
                          <Button
                            onClick={() =>
                              subtractCurrencyAmount(type as keyof Currency)
                            }
                            variant="danger"
                            size="xs"
                            fullWidth
                            leftIcon={<Minus size={12} />}
                            disabled={currencyAmounts[type as keyof Currency] <= 0}
                          >
                            Spend
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Currency Conversion Helper */}
          {!hideConversionInfo && !compact && (
            <div className="mt-6 rounded-lg border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-5">
              <h4 className="mb-3 flex items-center gap-2 text-base font-bold text-amber-800 uppercase tracking-wide border-b-2 border-amber-200 pb-2">
                <Info className="h-4 w-4" />
                Currency Conversion
              </h4>
              <div className="space-y-2 text-sm text-amber-800">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" size="sm">1 pp</Badge>
                  <span>=</span>
                  <Badge variant="warning" size="sm">10 gp</Badge>
                  <span>=</span>
                  <Badge variant="secondary" size="sm">100 sp</Badge>
                  <span>=</span>
                  <Badge variant="danger" size="sm">1,000 cp</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning" size="sm">1 gp</Badge>
                  <span>=</span>
                  <Badge variant="secondary" size="sm">10 sp</Badge>
                  <span>=</span>
                  <Badge variant="danger" size="sm">100 cp</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success" size="sm">1 ep</Badge>
                  <span>=</span>
                  <Badge variant="secondary" size="sm">5 sp</Badge>
                  <span>=</span>
                  <Badge variant="danger" size="sm">50 cp</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" size="sm">1 sp</Badge>
                  <span>=</span>
                  <Badge variant="danger" size="sm">10 cp</Badge>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
