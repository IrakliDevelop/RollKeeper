'use client';

import React from 'react';

import { AppIcon } from '@/components/ui/icons/AppIcon';
import {
  abilitySaveValue,
  computeSaveProficiencies,
} from '@/components/ui/encounter/combat-screen/detail/DetailAbilityScores.utils';
import type { EncounterEntity } from '@/types/encounter';

/** Signed CON save for a concentration check, or null without a stat block. */
function conSave(entity: EncounterEntity): string | null {
  const sb = entity.monsterStatBlock;
  if (!sb) return null;
  const { proficiencies, saveByAbility } = computeSaveProficiencies(sb);
  return abilitySaveValue(
    sb,
    'con',
    proficiencies,
    saveByAbility,
    entity.proficiencyBonus
  );
}

/** Read-only reminder of the concentration save while concentrating (no roll button). */
export function CreatureConcentrationBanner({
  entity,
}: {
  entity: EncounterEntity;
}) {
  if (!entity.concentrationSpell) return null;
  const save = conSave(entity);

  return (
    <div
      role="status"
      aria-label="Concentration"
      className="flex items-start gap-2"
    >
      <AppIcon
        name="concentration"
        className="text-lapis-text mt-0.5 size-4 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="type-ui text-heading">
          Concentrating on {entity.concentrationSpell}
        </p>
        <p className="type-small text-muted">
          On damage: CON save, DC 10 or half the damage, whichever is higher.
        </p>
      </div>
      {save && (
        <span className="type-ui text-heading shrink-0 tabular-nums">
          CON save {save}
        </span>
      )}
    </div>
  );
}
