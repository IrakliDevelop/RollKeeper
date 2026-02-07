'use client';

import React from 'react';
import {
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/forms';
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
    case 4:
      return <Dice1 size={20} />;
    case 6:
      return <Dice2 size={20} />;
    case 8:
      return <Dice3 size={20} />;
    case 10:
      return <Dice4 size={20} />;
    case 12:
      return <Dice5 size={20} />;
    default:
      return <Dice6 size={20} />;
  }
};

// Get color scheme based on die type - using semantic tokens
const getDieColor = (dieType: string) => {
  const dieNumber = parseInt(dieType.replace('d', ''));
  switch (dieNumber) {
    case 4:
      return 'text-accent-orange-text bg-accent-orange-bg border-accent-orange-border';
    case 6:
      return 'text-accent-purple-text bg-accent-purple-bg border-accent-purple-border';
    case 8:
      return 'text-accent-blue-text bg-accent-blue-bg border-accent-blue-border';
    case 10:
      return 'text-accent-green-text bg-accent-green-bg border-accent-green-border';
    case 12:
      return 'text-accent-red-text bg-accent-red-bg border-accent-red-border';
    default:
      return 'text-muted bg-surface-inset border-divider';
  }
};

// Get dice button colors (filled vs empty)
const getDiceButtonColors = (dieType: string, isAvailable: boolean) => {
  const dieNumber = parseInt(dieType.replace('d', ''));

  if (isAvailable) {
    // Filled dice - colored background with white text
    switch (dieNumber) {
      case 4:
        return 'border-orange-500 bg-orange-500 text-white shadow-md hover:shadow-lg';
      case 6:
        return 'border-purple-500 bg-purple-500 text-white shadow-md hover:shadow-lg';
      case 8:
        return 'border-blue-500 bg-blue-500 text-white shadow-md hover:shadow-lg';
      case 10:
        return 'border-green-500 bg-green-500 text-white shadow-md hover:shadow-lg';
      case 12:
        return 'border-red-500 bg-red-500 text-white shadow-md hover:shadow-lg';
      default:
        return 'border-border-secondary bg-border-secondary text-inverse shadow-md hover:shadow-lg';
    }
  } else {
    // Empty dice - just colored border with transparent background
    switch (dieNumber) {
      case 4:
        return 'border-orange-500 bg-transparent text-orange-500 hover:bg-accent-orange-bg';
      case 6:
        return 'border-purple-500 bg-transparent text-purple-500 hover:bg-accent-purple-bg';
      case 8:
        return 'border-blue-500 bg-transparent text-blue-500 hover:bg-accent-blue-bg';
      case 10:
        return 'border-green-500 bg-transparent text-green-500 hover:bg-accent-green-bg';
      case 12:
        return 'border-red-500 bg-transparent text-red-500 hover:bg-accent-red-bg';
      default:
        return 'border-border-secondary bg-transparent text-muted hover:bg-surface-hover';
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
      <div className="border-divider bg-surface-raised rounded-lg border p-6 shadow-sm">
        <h3 className="text-heading mb-4 text-lg font-semibold">Hit Dice</h3>
        <p className="text-muted text-sm">
          No hit dice available. Add class levels to gain hit dice.
        </p>
      </div>
    );
  }

  return (
    <div className="border-divider from-surface-raised to-surface-secondary rounded-xl border bg-gradient-to-br p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-red-500 to-red-600 p-2 shadow-md">
            <Dice6 size={20} className="text-white" />
          </div>
          <h3 className="text-heading text-xl font-bold">Hit Dice</h3>
        </div>
        <Button
          onClick={onResetAllHitDice}
          variant="secondary"
          size="sm"
          leftIcon={<Moon className="h-4 w-4" />}
          className="bg-accent-blue-bg-strong text-accent-blue-text-muted hover:bg-accent-blue-bg"
          title="Long Rest (restore all hit dice - D&D 2024 rules)"
        >
          Long Rest
        </Button>
      </div>

      <div className="space-y-4">
        {dieTypes.map(dieType => {
          const pool = hitDicePools[dieType];
          const available = pool.max - pool.used;
          const colorClasses = getDieColor(dieType);

          return (
            <div
              key={dieType}
              className={`rounded-xl border-2 p-5 shadow-md transition-all hover:shadow-lg ${colorClasses}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-surface-raised rounded-lg p-2 shadow-sm">
                    {getDieIcon(dieType)}
                  </div>
                  <div>
                    <span className="text-lg font-bold">
                      {dieType.toUpperCase()}
                    </span>
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
                      className={`group relative h-8 w-8 rounded-lg border-2 text-xs font-bold transition-all duration-200 hover:scale-110 active:scale-95 ${getDiceButtonColors(dieType, isAvailable)}`}
                      title={
                        isAvailable
                          ? `Click to set ${dieNumber - 1} available (use ${pool.max - (dieNumber - 1)} dice)`
                          : `Click to set ${dieNumber} available (restore ${dieNumber - available} dice)`
                      }
                    >
                      {/* Show number only for available dice, empty for spent */}
                      {isAvailable ? dieNumber : ''}

                      {/* Hover indicator showing target state */}
                      <div
                        className={`absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold transition-all duration-200 ${
                          isAvailable
                            ? 'scale-75 bg-red-500 text-white opacity-0 group-hover:scale-100 group-hover:opacity-100'
                            : 'scale-75 bg-green-500 text-white opacity-0 group-hover:scale-100 group-hover:opacity-100'
                        }`}
                      >
                        {isAvailable ? dieNumber - 1 : dieNumber}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Controls */}
              <div className="border-opacity-20 flex items-center justify-between border-t border-current pt-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => onUseHitDie(dieType, 1)}
                    disabled={available === 0}
                    variant="outline"
                    size="xs"
                    className="bg-surface-raised hover:bg-surface-hover"
                  >
                    Use 1
                  </Button>
                  {available > 1 && (
                    <Button
                      onClick={() =>
                        onUseHitDie(dieType, Math.min(available, 5))
                      }
                      variant="outline"
                      size="xs"
                      className="bg-surface-raised hover:bg-surface-hover"
                    >
                      Use {Math.min(available, 5)}
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  {pool.used > 0 && (
                    <>
                      <Button
                        onClick={() => onRestoreHitDice(dieType, 1)}
                        variant="outline"
                        size="xs"
                        className="bg-surface-raised hover:bg-surface-hover"
                      >
                        Restore 1
                      </Button>
                      <Button
                        onClick={() => onRestoreHitDice(dieType, pool.used)}
                        variant="outline"
                        size="xs"
                        leftIcon={<RefreshCw className="h-3 w-3" />}
                        className="bg-surface-raised hover:bg-surface-hover"
                      >
                        All
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-accent-blue-border mt-6 rounded-xl border bg-gradient-to-r from-[var(--gradient-blue-from)] to-[var(--gradient-indigo-to)] p-4">
        <div className="flex items-start gap-3">
          <div className="bg-accent-blue-bg-strong mt-0.5 rounded-lg p-2">
            <svg
              className="text-accent-blue-text-muted h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-accent-blue-text mb-2 font-medium">
              How to Use Hit Dice
            </h4>
            <div className="text-accent-blue-text space-y-1 text-sm">
              <p>
                <strong>Click any die:</strong> Use/restore all dice from that
                position to the end
              </p>
              <p>
                <strong>Short Rest:</strong> Spend hit dice to regain HP (roll
                die + CON modifier)
              </p>
              <p>
                <strong>Long Rest:</strong> Regain all your max hit dice
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
