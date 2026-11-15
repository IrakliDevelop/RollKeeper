'use client';

import { Button } from '@/components/ui/forms/button';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
import { Section } from '@/components/ui/layout/section';

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

/** Concentration: current spell + CON save, or the empty state. */
export function EffectsConcentration({
  character,
  roll,
  onEndConcentration,
}: EffectsConcentrationProps) {
  const { concentration } = character;

  if (!concentration.isConcentrating) {
    return (
      <Section heading="Concentration" level={4}>
        <p className="type-body text-muted">
          Not concentrating. Casting a concentration spell shows it here and on
          your token.
        </p>
      </Section>
    );
  }

  const conMod = calculateSavingThrowModifier(character, 'constitution');

  return (
    <Section
      heading="Concentration"
      level={4}
      trailing={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label="End concentration"
          onClick={onEndConcentration}
        >
          End
        </Button>
      }
    >
      <div className="space-y-2">
        <ConditionChip
          kind="concentration"
          name={
            concentration.spellName
              ? `Concentrating on ${concentration.spellName}`
              : 'Concentrating'
          }
        />
        <p className="type-small text-muted">
          On damage: CON save, DC 10 or half the damage, whichever is higher.
        </p>
        <MaybeRollElement
          ariaLabel="Roll concentration save"
          className="type-ui text-heading tabular-nums"
          onRoll={roll ? () => roll('Concentration Save', conMod) : undefined}
        >
          CON save {formatModifier(conMod)}
        </MaybeRollElement>
      </div>
    </Section>
  );
}
