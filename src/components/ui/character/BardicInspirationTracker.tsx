'use client';

import React from 'react';
import { Music, Plus, Minus, RotateCcw, Info } from 'lucide-react';
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

/**
 * Get the Bard class level from a character's class list.
 * Returns 0 if the character doesn't have a Bard class.
 */
function getBardLevel(character: CharacterState): number {
  // Check multiclass array first
  if (character.classes && character.classes.length > 0) {
    const bardClass = character.classes.find(
      c => c.className.toLowerCase() === 'bard'
    );
    if (bardClass) return bardClass.level;
  }
  // Fallback to legacy single-class
  if (character.class?.name?.toLowerCase() === 'bard') {
    return character.level || 1;
  }
  return 0;
}

/**
 * Get the Bardic Inspiration die type based on Bard level.
 * d6 at 1, d8 at 5, d10 at 10, d12 at 15.
 */
function getBardicDie(bardLevel: number): string {
  if (bardLevel >= 15) return 'd12';
  if (bardLevel >= 10) return 'd10';
  if (bardLevel >= 5) return 'd8';
  return 'd6';
}

/**
 * Get the maximum number of Bardic Inspiration uses.
 * Equal to Charisma modifier, minimum of 1.
 */
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
  const chaMod = calculateModifier(character.abilities.charisma);

  const renderInspirationDice = () => {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: maxUses }, (_, index) => {
          const isAvailable = index < usesRemaining;

          return (
            <button
              key={index}
              onClick={() => {
                if (isAvailable) {
                  onUseInspiration();
                } else {
                  onRestoreInspiration();
                }
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
                isAvailable
                  ? 'border-accent-indigo-border-strong bg-accent-indigo-bg-strong text-accent-indigo-text scale-110 transform shadow-lg hover:shadow-xl'
                  : 'bg-surface-raised border-divider text-muted hover:border-accent-indigo-border hover:text-accent-indigo-text cursor-pointer'
              }`}
              title={
                isAvailable
                  ? 'Click to expend inspiration'
                  : 'Click to restore inspiration'
              }
            >
              <Music size={16} />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`border-divider from-surface-raised to-surface-secondary rounded-xl border bg-gradient-to-br p-6 shadow-lg ${className}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 p-2 shadow-md">
            <Music size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-heading text-xl font-bold">
              Bardic Inspiration
            </h3>
            <span className="text-muted text-xs">Bard Level {bardLevel}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Badge className="border-accent-indigo-border bg-accent-indigo-bg-strong text-accent-indigo-text px-3 py-1 text-sm font-bold shadow-sm">
            {bardicDie}
          </Badge>
          <Button
            onClick={onResetInspiration}
            variant="ghost"
            size="xs"
            className="text-muted hover:text-heading"
            title="Reset (Long Rest)"
          >
            <RotateCcw size={16} />
          </Button>
        </div>
      </div>

      {/* Current Count Display */}
      <div className="mb-4 text-center">
        <div className="text-heading text-3xl font-bold">
          {usesRemaining}
          <span className="text-muted ml-1 text-lg">/ {maxUses}</span>
        </div>
        <div className="text-body text-sm">
          {usesRemaining === 0
            ? 'No inspirations remaining'
            : usesRemaining === 1
              ? '1 inspiration remaining'
              : `${usesRemaining} inspirations remaining`}
        </div>
      </div>

      {/* Inspiration Dice Visual */}
      <div className="mb-4">{renderInspirationDice()}</div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-2">
        <Button
          onClick={onRestoreInspiration}
          disabled={usesExpended === 0}
          variant="success"
          size="sm"
          leftIcon={<Plus size={16} />}
        >
          Restore
        </Button>
        <Button
          onClick={onUseInspiration}
          disabled={usesRemaining === 0}
          variant="danger"
          size="sm"
          leftIcon={<Minus size={16} />}
        >
          Expend
        </Button>
      </div>

      {/* Die Progression Info */}
      <div className="bg-surface-secondary border-divider mt-4 rounded-lg border p-3">
        <div className="text-body mb-2 flex items-center gap-1 text-xs font-semibold">
          <Info size={12} />
          Bardic Die Progression
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {[
            { level: 1, die: 'd6' },
            { level: 5, die: 'd8' },
            { level: 10, die: 'd10' },
            { level: 15, die: 'd12' },
          ].map(({ level, die }) => (
            <span
              key={level}
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                bardLevel >= level
                  ? 'bg-accent-indigo-bg-strong text-accent-indigo-text'
                  : 'bg-surface-inset text-muted'
              }`}
            >
              Lv{level}: {die}
            </span>
          ))}
        </div>
      </div>

      {/* Helper Text */}
      <div className="bg-surface-secondary border-divider mt-3 rounded-lg border p-3 text-center text-xs">
        <p className="text-body">
          <strong>Bardic Inspiration:</strong> As a Bonus Action, inspire a
          creature within 60ft. They add your <strong>{bardicDie}</strong> to a
          failed D20 Test.
        </p>
        <p className="text-muted mt-1">
          Uses: <strong>CHA modifier</strong> ({chaMod >= 0 ? '+' : ''}
          {chaMod}, min 1) = <strong>{maxUses}/Long Rest</strong>
        </p>
      </div>
    </div>
  );
}
