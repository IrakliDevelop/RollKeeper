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
} from './DetailAbilityScores.utils';
import type { DetailSectionProps } from './DetailHeader';

const ABILITY_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

export function DetailAbilityScores({ entity, actions }: DetailSectionProps) {
  const sb = entity.monsterStatBlock;
  if (!sb) return null;

  const { proficiencies, saveByAbility } = computeSaveProficiencies(sb);
  const isPlayer = entity.type === 'player';

  const handleChange = (key: AbilityKey, val: number | undefined) => {
    if (val !== undefined && sb) {
      actions.onUpdate(entity.id, {
        monsterStatBlock: { ...sb, [key]: val },
      });
    }
  };

  const setProficient = (key: AbilityKey, proficient: boolean) => {
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
    <div className="border-divider space-y-2 border-t p-4">
      <h3 className="text-heading text-xs font-semibold tracking-wider uppercase">
        Ability Scores
      </h3>
      <div className="grid grid-cols-6 gap-1">
        {ABILITY_KEYS.map((key, i) => {
          const score = sb[key];
          const override = saveByAbility[key];
          const proficient = proficiencies.includes(key);
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
              className="bg-surface border-divider flex flex-col items-center rounded-xl border p-2 text-center"
            >
              <span className="text-muted text-[10px] font-bold uppercase">
                {ABILITY_LABELS[i]}
              </span>
              {isPlayer ? (
                <span className="text-heading text-sm font-bold tabular-nums">
                  {score}
                </span>
              ) : (
                <NumberField
                  value={score}
                  onChange={v => handleChange(key, v)}
                  aria-label={ABILITY_LABELS[i]}
                  className="bg-surface-raised text-heading w-full rounded px-0.5 py-0.5 text-center text-sm font-bold tabular-nums"
                />
              )}
              <span className="text-accent-emerald-text-muted text-[10px]">
                {signedModifier(score)}
              </span>
              {!isPlayer && (
                <label className="text-muted flex items-center gap-0.5 text-[9px] font-semibold">
                  <input
                    type="checkbox"
                    checked={proficient}
                    onChange={event => setProficient(key, event.target.checked)}
                    aria-label={`${ABILITY_LABELS[i]} saving throw proficiency`}
                    className="text-accent-amber-text h-3 w-3 accent-current"
                  />
                  PROF
                </label>
              )}
              {proficient ? (
                <span className="text-accent-amber-text text-[10px] font-bold">
                  SAVE {save}
                </span>
              ) : (
                <span className="text-muted text-[10px] font-semibold">
                  SAVE {save}
                </span>
              )}
              {!isPlayer && override != null && (
                <button
                  type="button"
                  onClick={() => resetSave(key)}
                  className="text-faint hover:text-body text-[9px] underline"
                  aria-label={`Reset ${ABILITY_LABELS[i]} saving throw`}
                >
                  Reset
                </button>
              )}
            </div>
          );
        })}
      </div>
      {isPlayer && (
        <p className="text-faint text-[11px]">Synced from character sheet</p>
      )}
    </div>
  );
}
