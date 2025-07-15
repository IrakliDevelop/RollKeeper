'use client';

import React from 'react';
import { SpellSlots, PactMagic } from '@/types/character';
import { RotateCcw } from 'lucide-react';

interface SpellSlotTrackerProps {
  spellSlots: SpellSlots;
  pactMagic?: PactMagic;
  onSpellSlotChange: (level: keyof SpellSlots, used: number) => void;
  onPactMagicChange?: (used: number) => void;
  onResetSpellSlots: () => void;
  onResetPactMagic?: () => void;
  className?: string;
}

export default function SpellSlotTracker({
  spellSlots,
  pactMagic,
  onSpellSlotChange,
  onPactMagicChange,
  onResetSpellSlots,
  onResetPactMagic,
  className = ''
}: SpellSlotTrackerProps) {
  // Check if character has any spell slots
  const hasSpellSlots = Object.values(spellSlots).some(slot => slot.max > 0);
  const hasPactMagic = pactMagic && pactMagic.slots.max > 0;

  if (!hasSpellSlots && !hasPactMagic) {
    return null; // Don't render if no spell slots
  }

  const renderSlotCheckboxes = (max: number, used: number, onChange: (used: number) => void) => {
    return (
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: max }, (_, index) => (
          <button
            key={index}
            onClick={() => {
              const newUsed = index < used ? used - 1 : index + 1;
              onChange(Math.max(0, Math.min(newUsed, max)));
            }}
            className={`w-4 h-4 border-2 rounded transition-colors ${
              index < used
                ? 'bg-red-500 border-red-500' // Used slot
                : 'bg-white border-gray-400 hover:border-gray-600' // Available slot
            }`}
            title={`Spell slot ${index + 1} - ${index < used ? 'Used' : 'Available'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-purple-800">Spell Slots</h3>
        <div className="flex items-center space-x-2">
          {hasSpellSlots && (
            <button
              onClick={onResetSpellSlots}
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center space-x-1"
              title="Reset all spell slots"
            >
              <RotateCcw size={14} />
              <span>Reset Slots</span>
            </button>
          )}
          {hasPactMagic && onResetPactMagic && (
            <button
              onClick={onResetPactMagic}
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center space-x-1"
              title="Reset pact magic slots"
            >
              <RotateCcw size={14} />
              <span>Reset Pact</span>
            </button>
          )}
        </div>
      </div>

      {/* Regular Spell Slots */}
      {hasSpellSlots && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Spell Slots</h4>
          {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const)
            .filter(level => spellSlots[level].max > 0)
            .map((level) => {
              const slot = spellSlots[level];
              return (
              <div key={level} className="flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-[60px]">
                  <span className="text-sm font-medium text-gray-700">
                    Level {level}:
                  </span>
                  <span className="text-xs text-gray-500">
                    {slot.max - slot.used}/{slot.max}
                  </span>
                </div>
                {renderSlotCheckboxes(slot.max, slot.used, (used) => onSpellSlotChange(level, used))}
              </div>
              );
            })}
          </div>
      )}

      {/* Warlock Pact Magic */}
      {hasPactMagic && pactMagic && onPactMagicChange && (
        <div className="space-y-3 border-t border-gray-200 pt-3">
          <h4 className="text-sm font-medium text-purple-700">Pact Magic</h4>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-purple-700">
                Level {pactMagic.level} Slots:
              </span>
              <span className="text-xs text-gray-500">
                {pactMagic.slots.max - pactMagic.slots.used}/{pactMagic.slots.max}
              </span>
            </div>
            {renderSlotCheckboxes(
              pactMagic.slots.max, 
              pactMagic.slots.used, 
              onPactMagicChange
            )}
          </div>
          <p className="text-xs text-purple-600 italic">
            Pact magic slots recharge on a short rest
          </p>
        </div>
      )}

      {/* Usage Guide */}
      <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
        <p>• Click empty slots to mark as used • Click used slots to mark as available</p>
      </div>
    </div>
  );
} 