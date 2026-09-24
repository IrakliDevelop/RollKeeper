'use client';

import { Zap } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';

import { MaybeRollElement } from '../MaybeRollElement';

import {
  calculateSavingThrowModifier,
  formatModifier,
} from '@/utils/calculations';

import type { CharacterState } from '@/types/character';
import type { SheetRoll } from '../SheetDrawer.types';

export interface EffectsConcentrationProps {
  character: CharacterState;
  roll?: SheetRoll;
  onEndConcentration: () => void;
}

const SECTION_CLASS = 'border-divider bg-surface rounded-xl border p-3';
const HEADING_CLASS = 'text-faint mb-2 text-xs font-bold uppercase';

/** Concentration card: current spell + CON save hint, or the empty state. */
export function EffectsConcentration({
  character,
  roll,
  onEndConcentration,
}: EffectsConcentrationProps) {
  const { concentration } = character;

  if (!concentration.isConcentrating) {
    return (
      <div className={SECTION_CLASS}>
        <div className={HEADING_CLASS}>Concentration</div>
        <p className="text-muted text-sm">
          Not concentrating. Casting a concentration spell shows it here and on
          your token.
        </p>
      </div>
    );
  }

  const conMod = calculateSavingThrowModifier(character, 'constitution');

  return (
    <div className={SECTION_CLASS}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Zap className="text-accent-amber-text mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="text-heading text-sm font-semibold">
              Concentrating on {concentration.spellName}
            </div>
            <p className="text-faint text-xs">
              Taking damage? Make a Constitution save, DC 10 or half the damage
              (higher).
            </p>
            <MaybeRollElement
              ariaLabel="Roll concentration save"
              className="text-muted mt-1 text-xs font-semibold"
              onRoll={
                roll ? () => roll('Concentration Save', conMod) : undefined
              }
            >
              CON save {formatModifier(conMod)}
            </MaybeRollElement>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="End concentration"
          onClick={onEndConcentration}
        >
          End
        </Button>
      </div>
    </div>
  );
}
