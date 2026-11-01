'use client';

import React from 'react';
import { NumberField } from '@/components/ui/forms/NumberInput';
import { Checkbox } from '@/components/ui/forms/checkbox';
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
      <h3 className="type-label-heading text-heading">Ability scores</h3>
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
              className="border-divider flex flex-col items-center border-r px-1 py-1 text-center last:border-r-0"
            >
              <span className="text-muted text-xs font-semibold">
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
                  className="bg-surface border-divider text-heading w-full rounded-sm border px-0.5 py-1 text-center text-base font-bold tabular-nums pointer-coarse:min-h-11"
                />
              )}
              <span className="text-muted text-xs">
                {signedModifier(score)}
              </span>
              {!isPlayer && (
                <div className="text-muted flex items-center gap-0.5 text-xs font-semibold">
                  <Checkbox
                    size="sm"
                    checked={proficient}
                    onCheckedChange={checked => setProficient(key, checked)}
                    aria-label={`${ABILITY_LABELS[i]} saving throw proficiency`}
                  />
                  Prof
                </div>
              )}
              {proficient ? (
                <span className="text-brass-text text-xs font-bold">
                  Save {save}
                </span>
              ) : (
                <span className="text-muted text-xs font-semibold">
                  Save {save}
                </span>
              )}
              {!isPlayer && override != null && (
                <button
                  type="button"
                  onClick={() => resetSave(key)}
                  className="text-muted text-xs underline pointer-coarse:min-h-11"
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
        <p className="text-muted text-xs">Synced from character sheet</p>
      )}
    </div>
  );
}
