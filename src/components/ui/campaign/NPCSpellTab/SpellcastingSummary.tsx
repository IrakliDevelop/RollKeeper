'use client';

import React, { useId } from 'react';
import { Button } from '@/components/ui/forms/button';
import type { NPCSpellcastingAbility } from '@/types/encounter';

const ABILITY_NAMES: Record<NPCSpellcastingAbility, string> = {
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};

interface SpellcastingSummaryProps {
  casterLevel: number;
  ability: NPCSpellcastingAbility;
  spellAttack: number;
  spellDC: number;
  onResetSlots: () => void;
}

/** The caster's numbers on one line, with the slot reset beside them. */
export function SpellcastingSummary({
  casterLevel,
  ability,
  spellAttack,
  spellDC,
  onResetSlots,
}: SpellcastingSummaryProps) {
  const helperId = useId();
  const attack = spellAttack >= 0 ? `+${spellAttack}` : `${spellAttack}`;

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <p className="type-ui text-body">
        Caster level <span className="tabular-nums">{casterLevel}</span>
        {' · '}
        {ABILITY_NAMES[ability] ?? ability}
        {' · '}
        Spell attack <span className="tabular-nums">{attack}</span>
        {' · '}
        Spell save DC <span className="tabular-nums">{spellDC}</span>
      </p>
      <div className="flex flex-col items-start gap-1">
        <Button
          variant="secondary"
          size="sm"
          aria-describedby={helperId}
          onClick={onResetSlots}
        >
          Reset slots
        </Button>
        <p id={helperId} className="type-small text-muted">
          Restores spell slots and innate casts.
        </p>
      </div>
    </div>
  );
}
