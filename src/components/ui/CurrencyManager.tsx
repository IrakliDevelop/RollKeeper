'use client';

import React, { useState } from 'react';
import { Currency } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Coins } from 'lucide-react';
import { inputStyles, labelStyles } from '@/styles/inputs';

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

export default function CurrencyManager() {
  const { 
    character, 
    addCurrency,
    subtractCurrency
  } = useCharacterStore();
  
  const [currencyAmounts, setCurrencyAmounts] = useState<Currency>({
    copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0
  });

  // Calculate total wealth in copper pieces
  const totalWealthInCopper = Object.entries(character.currency).reduce((total, [type, amount]) => {
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
    if (amount > 0) {
      addCurrency(type, amount);
      setCurrencyAmounts(prev => ({ ...prev, [type]: 0 }));
    }
  };

  const subtractCurrencyAmount = (type: keyof Currency) => {
    const amount = currencyAmounts[type];
    if (amount > 0) {
      subtractCurrency(type, amount);
      setCurrencyAmounts(prev => ({ ...prev, [type]: 0 }));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-yellow-200 p-6">
      <h2 className="text-xl font-bold text-amber-800 mb-6 flex items-center gap-2">
        <Coins className="h-6 w-6" />
        Currency & Wealth
      </h2>
      
      {/* Current Currency Display */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {Object.entries(CURRENCY_TYPES).map(([type, config]) => (
          <div key={type} className="text-center">
            <div className="bg-gradient-to-b from-yellow-50 to-amber-50 rounded-lg p-4 border border-yellow-300 shadow-sm">
              <div className={`text-3xl font-bold ${config.color} mb-1`}>
                {character.currency[type as keyof Currency] || 0}
              </div>
              <div className="text-sm font-medium text-gray-600">{config.abbr}</div>
              <div className="text-xs text-gray-500 mt-1">{config.name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Total Wealth */}
      <div className="text-center mb-6 p-4 bg-gradient-to-r from-yellow-100 to-amber-100 rounded-lg border border-yellow-300">
        <div className="text-lg font-semibold text-amber-800 mb-1">
          Total Wealth
        </div>
        <div className="text-xl font-bold text-amber-900">
          {getWealthBreakdown(totalWealthInCopper)}
        </div>
        <div className="text-sm text-amber-700 mt-1">
          ({totalWealthInCopper.toLocaleString()} copper pieces)
        </div>
      </div>

      {/* Add/Subtract Currency */}
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
        <h3 className="text-lg font-semibold text-amber-800 mb-4">Manage Currency</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                     {Object.entries(CURRENCY_TYPES).map(([type, config]) => (
             <div key={type} className="space-y-2">
               <label className="block text-sm font-medium text-amber-800 mb-1">
                 {config.name}
               </label>
               <div className="flex items-center gap-1">
                 <input
                   type="number"
                   value={currencyAmounts[type as keyof Currency] || ''}
                   onChange={(e) => handleCurrencyChange(type as keyof Currency, e.target.value)}
                   className={inputStyles.green.replace('px-4 py-3', 'px-3 py-2').replace('text-gray-900', 'text-gray-900 bg-white')}
                   placeholder="0"
                   min="0"
                 />
               </div>
              <div className="flex gap-1">
                <button
                  onClick={() => addCurrencyAmount(type as keyof Currency)}
                  className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  title="Add"
                >
                  + Add
                </button>
                <button
                  onClick={() => subtractCurrencyAmount(type as keyof Currency)}
                  className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  title="Subtract"
                >
                  - Spend
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Currency Conversion Helper */}
      <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <h4 className="text-md font-semibold text-amber-800 mb-2">Currency Conversion</h4>
        <div className="text-sm text-amber-700 space-y-1">
          <div>1 platinum (pp) = 10 gold (gp) = 100 silver (sp) = 1,000 copper (cp)</div>
          <div>1 gold (gp) = 10 silver (sp) = 100 copper (cp)</div>
          <div>1 electrum (ep) = 5 silver (sp) = 50 copper (cp)</div>
          <div>1 silver (sp) = 10 copper (cp)</div>
        </div>
      </div>
    </div>
  );
} 