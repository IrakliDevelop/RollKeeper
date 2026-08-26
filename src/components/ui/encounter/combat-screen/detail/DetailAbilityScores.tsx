'use client';

import React from 'react';
import { NumberField } from '@/components/ui/forms/NumberInput';
import {
  parseSavesString,
  removeSaveOverride,
  type AbilityKey,
} from './DetailAbilityScores.utils';
import type { DetailSectionProps } from './DetailHeader';

const ABILITY_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function signedMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function DetailAbilityScores({ entity, actions }: DetailSectionProps) {
  const sb = entity.monsterStatBlock;
  if (!sb) return null;

  const saveByAbility = parseSavesString(sb.saves);
  const isPlayer = entity.type === 'player';
  const inferredProficiencies = ABILITY_KEYS.filter(key => saveByAbility[key]);
  const proficiencies = sb.saveProficiencies ?? inferredProficiencies;

  const handleChange = (key: AbilityKey, val: number | undefined) => {
    if (val !== undefined && sb) {
      actions.onUpdate(entity.id, {
        monsterStatBlock: { ...sb, [key]: val },
      });
    }
  };

  const setProficient = (key: AbilityKey, proficient: boolean) => {
    const next = proficient
      ? [...new Set([...proficiencies, key])]
      : proficiencies.filter(candidate => candidate !== key);
    actions.onUpdate(entity.id, {
      monsterStatBlock: {
        ...sb,
        saveProficiencies: next,
        saves: proficient ? sb.saves : removeSaveOverride(sb.saves, key),
      },
    });
  };

  const resetSave = (key: AbilityKey) => {
    actions.onUpdate(entity.id, {
      monsterStatBlock: {
        ...sb,
        saveProficiencies: proficiencies,
        saves: removeSaveOverride(sb.saves, key),
      },
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
          const calculated =
            Math.floor((score - 10) / 2) +
            (proficient ? (entity.proficiencyBonus ?? 0) : 0);
          const save = override ?? signed(calculated);
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
                {signedMod(score)}
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
