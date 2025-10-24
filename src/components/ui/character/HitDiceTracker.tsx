'use client';

import React from 'react';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Moon, RefreshCw } from 'lucide-react';
import { HitDicePools } from '@/types/character';

interface HitDiceTrackerProps {
  hitDicePools: HitDicePools;
  onUseHitDie: (dieType: string, count?: number) => void;
  onRestoreHitDice: (dieType: string, count?: number) => void;
  onResetAllHitDice: () => void;
}

// Map die types to appropriate icons
const getDieIcon = (dieType: string) => {
  const dieNumber = parseInt(dieType.replace('d', ''));
  switch (dieNumber) {
    case 4: return <Dice1 size={20} />;
    case 6: return <Dice2 size={20} />;
    case 8: return <Dice3 size={20} />;
    case 10: return <Dice4 size={20} />;
    case 12: return <Dice5 size={20} />;
    default: return <Dice6 size={20} />;
  }
};

// Get color scheme based on die type
const getDieColor = (dieType: string) => {
  const dieNumber = parseInt(dieType.replace('d', ''));
  switch (dieNumber) {
    case 4: return 'text-orange-600 bg-orange-50 border-orange-200';
    case 6: return 'text-purple-600 bg-purple-50 border-purple-200';
    case 8: return 'text-blue-600 bg-blue-50 border-blue-200';
    case 10: return 'text-green-600 bg-green-50 border-green-200';
    case 12: return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

// Get dice button colors (filled vs empty)
const getDiceButtonColors = (dieType: string, isAvailable: boolean) => {
  const dieNumber = parseInt(dieType.replace('d', ''));
  
  if (isAvailable) {
    // Filled dice - colored background with white text
    switch (dieNumber) {
      case 4: return 'border-orange-500 bg-orange-500 text-white shadow-md hover:shadow-lg';
      case 6: return 'border-purple-500 bg-purple-500 text-white shadow-md hover:shadow-lg';
      case 8: return 'border-blue-500 bg-blue-500 text-white shadow-md hover:shadow-lg';
      case 10: return 'border-green-500 bg-green-500 text-white shadow-md hover:shadow-lg';
      case 12: return 'border-red-500 bg-red-500 text-white shadow-md hover:shadow-lg';
      default: return 'border-gray-500 bg-gray-500 text-white shadow-md hover:shadow-lg';
    }
  } else {
    // Empty dice - just colored border
    switch (dieNumber) {
      case 4: return 'border-orange-500 bg-transparent text-orange-500 hover:bg-orange-50';
      case 6: return 'border-purple-500 bg-transparent text-purple-500 hover:bg-purple-50';
      case 8: return 'border-blue-500 bg-transparent text-blue-500 hover:bg-blue-50';
      case 10: return 'border-green-500 bg-transparent text-green-500 hover:bg-green-50';
      case 12: return 'border-red-500 bg-transparent text-red-500 hover:bg-red-50';
      default: return 'border-gray-500 bg-transparent text-gray-500 hover:bg-gray-50';
    }
  }
};

export default function HitDiceTracker({
  hitDicePools,
  onUseHitDie,
  onRestoreHitDice,
  onResetAllHitDice,
}: HitDiceTrackerProps) {
  const dieTypes = Object.keys(hitDicePools).sort((a, b) => {
    const aNum = parseInt(a.replace('d', ''));
    const bNum = parseInt(b.replace('d', ''));
    return aNum - bNum;
  });

  if (dieTypes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Hit Dice</h3>
        <p className="text-sm text-gray-500">No hit dice available. Add class levels to gain hit dice.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-red-500 to-red-600 p-2 shadow-md">
            <Dice6 size={20} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Hit Dice</h3>
        </div>
        <button
          onClick={onResetAllHitDice}
          className="flex items-center gap-2 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 transition-all hover:bg-blue-200 hover:shadow-md active:scale-95"
          title="Long Rest (restore all hit dice - D&D 2024 rules)"
        >
          <Moon size={16} />
          Long Rest
        </button>
      </div>

      <div className="space-y-4">
        {dieTypes.map(dieType => {
          const pool = hitDicePools[dieType];
          const available = pool.max - pool.used;
          const colorClasses = getDieColor(dieType);

          return (
            <div key={dieType} className={`rounded-xl border-2 p-5 shadow-md transition-all hover:shadow-lg ${colorClasses}`}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white bg-opacity-80 p-2 shadow-sm">
                    {getDieIcon(dieType)}
                  </div>
                  <div>
                    <span className="text-lg font-bold">{dieType.toUpperCase()}</span>
                    <div className="text-xs opacity-75">Hit Dice</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {available} / {pool.max}
                  </div>
                  <div className="text-xs opacity-75">available</div>
                </div>
              </div>

              {/* Visual representation of dice */}
              <div className="mb-4 flex flex-wrap gap-2">
                {Array.from({ length: pool.max }, (_, index) => {
                  const isAvailable = index < available;
                  const dieNumber = index + 1;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (isAvailable) {
                          // If clicking on an available die, set available count to this position - 1
                          // (so clicking die #6 leaves 5 available, spending die #6 and #7)
                          const newUsed = pool.max - (dieNumber - 1);
                          const diceToUse = newUsed - pool.used;
                          if (diceToUse > 0) {
                            onUseHitDie(dieType, diceToUse);
                          }
                        } else {
                          // If clicking on a spent die, restore up to this position
                          const newUsed = pool.max - dieNumber;
                          const diceToRestore = pool.used - newUsed;
                          if (diceToRestore > 0) {
                            onRestoreHitDice(dieType, diceToRestore);
                          }
                        }
                      }}
                      className={`group relative h-8 w-8 rounded-lg border-2 font-bold text-xs transition-all duration-200 hover:scale-110 active:scale-95 ${getDiceButtonColors(dieType, isAvailable)}`}
                      title={
                        isAvailable 
                          ? `Click to set ${dieNumber - 1} available (use ${pool.max - (dieNumber - 1)} dice)`
                          : `Click to set ${dieNumber} available (restore ${dieNumber - available} dice)`
                      }
                    >
                      {/* Show number only for available dice, empty for spent */}
                      {isAvailable ? dieNumber : ''}
                      
                      {/* Hover indicator showing target state */}
                      <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full text-[8px] font-bold flex items-center justify-center transition-all duration-200 ${
                        isAvailable
                          ? 'bg-red-500 text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100'
                          : 'bg-green-500 text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100'
                      }`}>
                        {isAvailable ? (dieNumber - 1) : dieNumber}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between border-t border-current border-opacity-20 pt-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => onUseHitDie(dieType, 1)}
                    disabled={available === 0}
                    className="rounded-lg bg-white bg-opacity-90 px-3 py-2 text-xs font-medium shadow-sm transition-all hover:bg-opacity-100 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Use 1
                  </button>
                  {available > 1 && (
                    <button
                      onClick={() => onUseHitDie(dieType, Math.min(available, 5))}
                      className="rounded-lg bg-white bg-opacity-90 px-3 py-2 text-xs font-medium shadow-sm transition-all hover:bg-opacity-100 hover:shadow-md active:scale-95"
                    >
                      Use {Math.min(available, 5)}
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  {pool.used > 0 && (
                    <>
                      <button
                        onClick={() => onRestoreHitDice(dieType, 1)}
                        className="rounded-lg bg-white bg-opacity-90 px-3 py-2 text-xs font-medium shadow-sm transition-all hover:bg-opacity-100 hover:shadow-md active:scale-95"
                      >
                        Restore 1
                      </button>
                      <button
                        onClick={() => onRestoreHitDice(dieType, pool.used)}
                        className="flex items-center gap-1 rounded-lg bg-white bg-opacity-90 px-3 py-2 text-xs font-medium shadow-sm transition-all hover:bg-opacity-100 hover:shadow-md active:scale-95"
                      >
                        <RefreshCw size={12} />
                        All
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-100 p-2 mt-0.5">
            <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-2">How to Use Hit Dice</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Click any die:</strong> Use/restore all dice from that position to the end</p>
              <p><strong>Short Rest:</strong> Spend hit dice to regain HP (roll die + CON modifier)</p>
              <p><strong>Long Rest:</strong> Regain all your max hit dice (D&D 2024 rules)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
