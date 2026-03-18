'use client';

import React from 'react';
import { Music, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { BardicInspiration, CharacterState } from '@/types/character';
import { calculateModifier } from '@/utils/calculations';

interface BardicInspirationTrackerProps {
  bardicInspiration: BardicInspiration;
  character: CharacterState;
  onUseInspiration: () => void;
  onRestoreInspiration: () => void;
  onResetInspiration: () => void;
  className?: string;
}

function getBardLevel(character: CharacterState): number {
  if (character.classes && character.classes.length > 0) {
    const bardClass = character.classes.find(
      c => c.className.toLowerCase() === 'bard'
    );
    if (bardClass) return bardClass.level;
  }
  if (character.class?.name?.toLowerCase() === 'bard') {
    return character.level || 1;
  }
  return 0;
}

function getBardicDie(bardLevel: number): string {
  if (bardLevel >= 15) return 'd12';
  if (bardLevel >= 10) return 'd10';
  if (bardLevel >= 5) return 'd8';
  return 'd6';
}

function getMaxUses(character: CharacterState): number {
  const chaMod = calculateModifier(character.abilities.charisma);
  return Math.max(1, chaMod);
}

export default function BardicInspirationTracker({
  bardicInspiration,
  character,
  onUseInspiration,
  onRestoreInspiration,
  onResetInspiration,
  className = '',
}: BardicInspirationTrackerProps) {
  const bardLevel = getBardLevel(character);
  const bardicDie = getBardicDie(bardLevel);
  const maxUses = getMaxUses(character);
  const usesExpended = bardicInspiration.usesExpended;
  const usesRemaining = Math.max(0, maxUses - usesExpended);

  return (
    <div className={className}>
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 p-1.5">
            <Music size={14} className="text-white" />
          </div>
          <span className="text-heading text-sm font-bold">
            Bardic Inspiration
          </span>
          <Badge className="border-accent-indigo-border bg-accent-indigo-bg-strong text-accent-indigo-text px-2 py-0.5 text-xs font-bold">
            {bardicDie}
          </Badge>
        </div>
        <Button
          onClick={onResetInspiration}
          variant="ghost"
          size="xs"
          className="text-muted hover:text-heading"
          title="Reset (Long Rest)"
        >
          <RotateCcw size={14} />
        </Button>
      </div>

      {/* Count + Dice */}
      <div className="mb-2 flex items-center gap-3">
        <div className="text-heading text-xl font-bold">
          {usesRemaining}
          <span className="text-muted ml-0.5 text-sm">/ {maxUses}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: maxUses }, (_, index) => {
            const isAvailable = index < usesRemaining;
            return (
              <button
                key={index}
                onClick={isAvailable ? onUseInspiration : onRestoreInspiration}
                className={`flex h-7 w-7 items-center justify-center rounded-md border-2 transition-all ${
                  isAvailable
                    ? 'border-accent-indigo-border-strong bg-accent-indigo-bg-strong text-accent-indigo-text shadow-sm hover:shadow-md'
                    : 'bg-surface-secondary border-divider text-muted hover:border-accent-indigo-border hover:text-accent-indigo-text cursor-pointer'
                }`}
                title={isAvailable ? 'Click to expend' : 'Click to restore'}
              >
                <Music size={12} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Helper text */}
      <div className="text-muted text-xs">
        Bonus Action · 60ft · Target adds{' '}
        <strong className="text-body">{bardicDie}</strong> to a failed D20 Test
      </div>
    </div>
  );
}
