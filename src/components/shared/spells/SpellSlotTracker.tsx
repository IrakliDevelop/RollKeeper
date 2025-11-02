'use client';

import React from 'react';
import { SpellSlots, PactMagic } from '@/types/character';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { RotateCcw, Zap } from 'lucide-react';

interface SpellSlotTrackerProps {
  spellSlots: SpellSlots;
  pactMagic?: PactMagic;
  onSpellSlotChange?: (level: keyof SpellSlots, used: number) => void;
  onPactMagicChange?: (used: number) => void;
  onResetSpellSlots?: () => void;
  onResetPactMagic?: () => void;

  // Display options
  readonly?: boolean;
  compact?: boolean;
  hideControls?: boolean;
  hideResetButtons?: boolean;
  showOnlyUsed?: boolean;
  maxLevelToShow?: number;

  className?: string;
}

export function SpellSlotTracker({
  spellSlots,
  pactMagic,
  onSpellSlotChange,
  onPactMagicChange,
  onResetSpellSlots,
  onResetPactMagic,
  readonly = false,
  compact = false,
  hideControls = false,
  hideResetButtons = false,
  showOnlyUsed = false,
  maxLevelToShow = 9,
  className = '',
}: SpellSlotTrackerProps) {
  // Check if character has any spell slots
  const hasSpellSlots = Object.values(spellSlots).some(slot => slot.max > 0);
  const hasPactMagic = pactMagic && pactMagic.slots.max > 0;

  if (!hasSpellSlots && !hasPactMagic) {
    return null; // Don't render if no spell slots
  }

  const renderSlotCheckboxes = (
    max: number,
    used: number,
    onChange?: (used: number) => void
  ) => {
    const size = compact ? 'w-3 h-3' : 'w-4 h-4';
    const gap = compact ? 'gap-0.5' : 'gap-1';

    return (
      <div className={`flex flex-wrap ${gap}`}>
        {Array.from({ length: max }, (_, index) => (
          <button
            key={index}
            onClick={() => {
              if (readonly || !onChange) return;
              const newUsed = index < used ? used - 1 : index + 1;
              onChange(Math.max(0, Math.min(newUsed, max)));
            }}
            disabled={readonly || !onChange}
            className={`${size} rounded border-2 transition-colors ${
              index < used
                ? 'border-red-500 bg-red-500' // Used slot
                : readonly
                  ? 'border-gray-300 bg-white'
                  : 'border-gray-400 bg-white hover:border-gray-600' // Available slot
            } ${readonly ? '' : 'cursor-pointer'}`}
            title={`Spell slot ${index + 1} - ${index < used ? 'Used' : 'Available'}`}
          />
        ))}
      </div>
    );
  };

  const containerClasses = compact
    ? `rounded-lg border-2 border-purple-200 bg-white p-3 space-y-3 shadow-sm ${className}`
    : `rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-4 space-y-4 shadow-sm ${className}`;

  // Filter spell levels to show
  const levelsToShow = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const)
    .filter(level => level <= maxLevelToShow)
    .filter(level => {
      const slot = spellSlots[level];
      if (showOnlyUsed) {
        return slot.max > 0 && slot.used > 0;
      }
      return slot.max > 0;
    });

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <h3
          className={`flex items-center gap-2 font-semibold text-purple-800 ${compact ? 'text-base' : 'text-lg'}`}
        >
          <Zap size={compact ? 16 : 20} />
          Spell Slots
        </h3>
        {!readonly && !hideResetButtons && !hideControls && (
          <div className="flex items-center space-x-2">
            {hasSpellSlots && onResetSpellSlots && (
              <Button
                onClick={onResetSpellSlots}
                variant="ghost"
                size="xs"
                leftIcon={<RotateCcw className="h-3 w-3" />}
                className="text-purple-600 hover:text-purple-800"
                title="Reset all spell slots"
              >
                Reset Slots
              </Button>
            )}
            {hasPactMagic && onResetPactMagic && (
              <Button
                onClick={onResetPactMagic}
                variant="ghost"
                size="xs"
                leftIcon={<RotateCcw className="h-3 w-3" />}
                className="text-purple-600 hover:text-purple-800"
                title="Reset pact magic slots"
              >
                Reset Pact
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Regular Spell Slots */}
      {hasSpellSlots && levelsToShow.length > 0 && (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
          {!compact && (
            <h4 className="text-sm font-semibold text-purple-700">Spell Slots</h4>
          )}
          {levelsToShow.map(level => {
            const slot = spellSlots[level];
            const remaining = slot.max - slot.used;
            return (
              <div key={level} className="flex items-center justify-between rounded-lg border-2 border-purple-200 bg-white p-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" size="sm">
                    {compact ? `L${level}` : `Level ${level}`}
                  </Badge>
                  <Badge
                    variant={remaining > 0 ? 'success' : 'neutral'}
                    size="sm"
                  >
                    {remaining}/{slot.max}
                  </Badge>
                </div>
                {renderSlotCheckboxes(
                  slot.max,
                  slot.used,
                  onSpellSlotChange
                    ? used => onSpellSlotChange(level, used)
                    : undefined
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Warlock Pact Magic */}
      {hasPactMagic && pactMagic && (
        <div
          className={`space-y-3 border-t-2 border-purple-200 pt-3 ${compact ? 'space-y-2 pt-2' : ''}`}
        >
          <h4
            className={`font-semibold text-purple-700 ${compact ? 'text-xs' : 'text-sm'}`}
          >
            Pact Magic
          </h4>
          <div className="flex items-center justify-between rounded-lg border-2 border-purple-300 bg-white p-2">
            <div className="flex items-center gap-2">
              <Badge variant="info" size="sm">
                {compact ? `L${pactMagic.level}` : `Level ${pactMagic.level}`}
              </Badge>
              <Badge
                variant={pactMagic.slots.max - pactMagic.slots.used > 0 ? 'success' : 'neutral'}
                size="sm"
              >
                {pactMagic.slots.max - pactMagic.slots.used}/{pactMagic.slots.max}
              </Badge>
            </div>
            {renderSlotCheckboxes(
              pactMagic.slots.max,
              pactMagic.slots.used,
              onPactMagicChange
            )}
          </div>
          {!compact && (
            <p className="text-xs text-purple-600 italic">
              ⚡ Pact magic slots recharge on a short rest
            </p>
          )}
        </div>
      )}

      {/* Usage Guide */}
      {!readonly && !hideControls && !compact && (
        <div className="border-t-2 border-purple-100 pt-2 text-xs text-gray-500">
          <p>
            💡 Click empty slots to mark as used • Click used slots to mark as available
          </p>
        </div>
      )}
    </div>
  );
}
