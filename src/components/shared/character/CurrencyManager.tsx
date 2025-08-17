'use client';

import React, { useState } from 'react';
import { Currency } from '@/types/character';
import { Coins } from 'lucide-react';
import { inputStyles } from '@/styles/inputs';

const CURRENCY_TYPES: { [key in keyof Currency]: { name: string; abbr: string; color: string } } = {
  platinum: { name: 'Platinum', abbr: 'pp', color: 'text-slate-600' },
  gold: { name: 'Gold', abbr: 'gp', color: 'text-yellow-600' },
  electrum: { name: 'Electrum', abbr: 'ep', color: 'text-green-600' },
  silver: { name: 'Silver', abbr: 'sp', color: 'text-gray-600' },
  copper: { name: 'Copper', abbr: 'cp', color: 'text-orange-600' },
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
  className = ''
}: CurrencyManagerProps) {
  const [currencyAmounts, setCurrencyAmounts] = useState<Currency>({
    copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0
  });

  // Calculate total wealth in copper pieces
  const totalWealthInCopper = Object.entries(currency).reduce((total, [type, amount]) => {
    return total + (amount * CURRENCY_VALUES[type as keyof Currency]);
  }, 0);

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
    ? `bg-white rounded-lg shadow border border-yellow-200 p-3 ${className}`
    : `bg-white rounded-lg shadow-lg border border-yellow-200 p-6 ${className}`;

  return (
    <div className={containerClasses}>
      <h2 className={`font-bold text-amber-800 flex items-center gap-2 ${compact ? 'text-base mb-3' : 'text-xl mb-6'}`}>
        <Coins className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        {compact ? 'Currency' : 'Currency & Wealth'}
      </h2>
      
      {/* Show only total wealth */}
      {showOnlyTotal ? (
        <div className="text-center p-4 bg-gradient-to-r from-yellow-100 to-amber-100 rounded-lg border border-yellow-300">
          <div className={`font-semibold text-amber-800 ${compact ? 'text-sm mb-1' : 'text-lg mb-1'}`}>
            Total Wealth
          </div>
          <div className={`font-bold text-amber-900 ${compact ? 'text-lg' : 'text-xl'}`}>
            {getWealthBreakdown(totalWealthInCopper)}
          </div>
          {!compact && (
            <div className="text-sm text-amber-700 mt-1">
              ({totalWealthInCopper.toLocaleString()} copper pieces)
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Current Currency Display */}
          {!hideIndividualCurrencies && (
            <div className={`grid gap-4 ${compact ? 'grid-cols-3 mb-3' : 'grid-cols-2 sm:grid-cols-5 mb-6'}`}>
              {Object.entries(CURRENCY_TYPES).map(([type, config]) => (
                <div key={type} className="text-center">
                  <div className={`bg-gradient-to-b from-yellow-50 to-amber-50 rounded-lg border border-yellow-300 shadow-sm ${compact ? 'p-2' : 'p-4'}`}>
                    <div className={`font-bold ${config.color} ${compact ? 'text-lg mb-1' : 'text-3xl mb-1'}`}>
                      {currency[type as keyof Currency] || 0}
                    </div>
                    <div className={`font-medium text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>{config.abbr}</div>
                    {!compact && (
                      <div className="text-xs text-gray-500 mt-1">{config.name}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total Wealth */}
          <div className={`text-center p-4 bg-gradient-to-r from-yellow-100 to-amber-100 rounded-lg border border-yellow-300 ${compact ? 'mb-3' : 'mb-6'}`}>
            <div className={`font-semibold text-amber-800 ${compact ? 'text-sm mb-1' : 'text-lg mb-1'}`}>
              Total Wealth
            </div>
            <div className={`font-bold text-amber-900 ${compact ? 'text-lg' : 'text-xl'}`}>
              {getWealthBreakdown(totalWealthInCopper)}
            </div>
            {!compact && (
              <div className="text-sm text-amber-700 mt-1">
                ({totalWealthInCopper.toLocaleString()} copper pieces)
              </div>
            )}
          </div>

          {/* Add/Subtract Currency */}
          {!readonly && !hideControls && (onAddCurrency || onSubtractCurrency) && (
            <div className={`bg-yellow-50 rounded-lg border border-yellow-200 ${compact ? 'p-3' : 'p-4'}`}>
              <h3 className={`font-semibold text-amber-800 ${compact ? 'text-sm mb-3' : 'text-lg mb-4'}`}>Manage Currency</h3>
              <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-5'}`}>
                {Object.entries(CURRENCY_TYPES).map(([type, config]) => (
                  <div key={type} className="space-y-2">
                    <label className={`block font-medium text-amber-800 ${compact ? 'text-xs mb-1' : 'text-sm mb-1'}`}>
                      {config.name}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={currencyAmounts[type as keyof Currency] || ''}
                        onChange={(e) => handleCurrencyChange(type as keyof Currency, e.target.value)}
                        className={`${inputStyles.green.replace('px-4 py-3', compact ? 'px-2 py-1 text-sm' : 'px-3 py-2').replace('text-gray-900', 'text-gray-900 bg-white')}`}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div className="flex gap-1">
                      {onAddCurrency && (
                        <button
                          onClick={() => addCurrencyAmount(type as keyof Currency)}
                          className={`flex-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors ${compact ? 'px-1 py-1 text-xs' : 'px-2 py-1 text-xs'}`}
                          title="Add"
                        >
                          + Add
                        </button>
                      )}
                      {onSubtractCurrency && (
                        <button
                          onClick={() => subtractCurrencyAmount(type as keyof Currency)}
                          className={`flex-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors ${compact ? 'px-1 py-1 text-xs' : 'px-2 py-1 text-xs'}`}
                          title="Subtract"
                        >
                          - Spend
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Currency Conversion Helper */}
          {!hideConversionInfo && !compact && (
            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="text-md font-semibold text-amber-800 mb-2">Currency Conversion</h4>
              <div className="text-sm text-amber-700 space-y-1">
                <div>1 platinum (pp) = 10 gold (gp) = 100 silver (sp) = 1,000 copper (cp)</div>
                <div>1 gold (gp) = 10 silver (sp) = 100 copper (cp)</div>
                <div>1 electrum (ep) = 5 silver (sp) = 50 copper (cp)</div>
                <div>1 silver (sp) = 10 copper (cp)</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
