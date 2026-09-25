'use client';

import React from 'react';

import { NumberField } from '@/components/ui/forms/NumberInput';
import {
  ABILITY_KEYS,
  abilitySaveValue,
  computeSaveProficiencies,
  resetSavePatch,
  saveProficiencyPatch,
  signedModifier,
  type AbilityKey,
} from '@/components/ui/encounter/combat-screen/detail/DetailAbilityScores.utils';
import {
  HEADING_CLASS,
  SECTION_CLASS,
} from '@/components/ui/campaign/player-vtt/SheetDrawer/sheetSectionStyles';

import type { CreatureVitalsProps } from './CreatureDrawer.utils';

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

function SaveFooter({
  proficient,
  save,
}: {
  proficient: boolean;
  save: string;
}) {
  return (
    <>
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          proficient ? 'bg-accent-amber-text' : 'bg-divider'
        }`}
      />
      <span className={proficient ? 'text-accent-amber-text' : 'text-muted'}>
        {save}
      </span>
    </>
  );
}

/** Six-card ability score grid — scores, modifiers, and save proficiency/overrides. */
export function CreatureAbilities({
  entity,
  actions,
  editing,
}: CreatureVitalsProps) {
  const sb = entity.monsterStatBlock;
  if (!sb) return null;

  const { proficiencies, saveByAbility } = computeSaveProficiencies(sb);

  const handleScoreChange = (key: AbilityKey, value: number | undefined) => {
    if (value === undefined) return;
    actions.onUpdate(entity.id, {
      monsterStatBlock: { ...sb, [key]: value },
    });
  };

  const toggleProficiency = (key: AbilityKey, proficient: boolean) => {
    actions.onUpdate(entity.id, {
      monsterStatBlock: saveProficiencyPatch(
        sb,
        proficiencies,
        key,
        proficient
      ),
    });
  };

  const resetSave = (key: AbilityKey) => {
    actions.onUpdate(entity.id, {
      monsterStatBlock: resetSavePatch(sb, proficiencies, key),
    });
  };

  return (
    <div className={SECTION_CLASS}>
      <p className={HEADING_CLASS}>Ability Scores</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITY_KEYS.map(key => {
          const label = ABILITY_LABELS[key];
          const score = sb[key];
          const proficient = proficiencies.includes(key);
          const override = saveByAbility[key];
          const save = abilitySaveValue(
            sb,
            key,
            proficiencies,
            saveByAbility,
            entity.proficiencyBonus
          );

          return (
            <div
              key={key}
              className="bg-surface-secondary flex flex-col items-center gap-0.5 rounded-lg p-2 text-center"
            >
              <span className="text-faint text-[10px] font-bold uppercase">
                {label}
              </span>
              <span className="text-heading text-lg font-bold tabular-nums">
                {signedModifier(score)}
              </span>
              {editing ? (
                <NumberField
                  value={score}
                  onChange={v => handleScoreChange(key, v)}
                  aria-label={`${label} score`}
                  className="bg-surface-raised text-heading w-full rounded px-0.5 py-0.5 text-center text-xs font-semibold tabular-nums"
                />
              ) : (
                <span className="text-faint text-xs tabular-nums">{score}</span>
              )}

              {editing ? (
                <button
                  type="button"
                  onClick={() => toggleProficiency(key, !proficient)}
                  aria-pressed={proficient}
                  aria-label={`${label} save proficiency`}
                  className="flex items-center gap-1 text-[10px] font-semibold"
                >
                  <SaveFooter proficient={proficient} save={save} />
                </button>
              ) : (
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  <SaveFooter proficient={proficient} save={save} />
                </div>
              )}

              {editing && override != null && (
                <button
                  type="button"
                  onClick={() => resetSave(key)}
                  className="text-faint hover:text-body text-[9px] underline"
                  aria-label={`Reset ${label} saving throw`}
                >
                  Reset
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
