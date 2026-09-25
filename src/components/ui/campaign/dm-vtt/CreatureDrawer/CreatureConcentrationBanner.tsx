'use client';

import React from 'react';
import { Brain } from 'lucide-react';

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
      className="bg-accent-purple-bg border-accent-purple-border text-accent-purple-text flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs"
    >
      <Brain size={13} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          Concentrating on {entity.concentrationSpell}
        </p>
        <p className="text-muted text-[11px]">
          On damage: CON save, DC 10 or half the damage, whichever is higher.
        </p>
      </div>
      {save && (
        <span className="shrink-0 font-semibold tabular-nums">
          CON save {save}
        </span>
      )}
    </div>
  );
}
