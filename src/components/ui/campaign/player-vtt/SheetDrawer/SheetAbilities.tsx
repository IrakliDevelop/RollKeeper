'use client';

import { useMemo } from 'react';

import { LedgerRow } from '@/components/ui/game/LedgerRow';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import { useCharacterStore } from '@/store/characterStore';
import type { AbilityName } from '@/types/character';

import { buildAbilityCells } from './SheetDrawer.utils';

export interface SheetAbilitiesProps {
  locked: boolean;
  roll?: (label: string, modifier: number) => Promise<void>;
}

/**
 * The six abilities as a ledger row. Unlocked, each score opens the score
 * editor; names and saves roll only when `roll` is passed (rolls stay
 * gated by `SHEET_DICE_ROLLS_ENABLED`).
 */
export function SheetAbilities({ locked, roll }: SheetAbilitiesProps) {
  const character = useCharacterStore(s => s.character);
  const updateAbilityScore = useCharacterStore(s => s.updateAbilityScore);
  const cells = useMemo(() => buildAbilityCells(character), [character]);
  const { prefs } = useUiPrefs();

  const cellFor = (ability: AbilityName) =>
    cells.find(cell => cell.ability === ability)!;

  return (
    <LedgerRow
      cells={cells}
      abilityDisplay={prefs.abilityDisplay}
      editing={!locked}
      onScoreChange={updateAbilityScore}
      onRollCheck={
        roll
          ? ability => {
              const cell = cellFor(ability);
              void roll(`${cell.name} Check`, cell.modifier);
            }
          : undefined
      }
      onRollSave={
        roll
          ? ability => {
              const cell = cellFor(ability);
              void roll(`${cell.name} Save`, cell.save);
            }
          : undefined
      }
    />
  );
}
