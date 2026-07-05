'use client';

import React from 'react';
import type { DetailSectionProps } from './DetailHeader';

const ABILITY_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function signedMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function DetailAbilityScores({ entity, actions }: DetailSectionProps) {
  const sb = entity.monsterStatBlock;
  if (!sb) return null;

  const isPlayer = entity.type === 'player';

  const handleChange = (key: AbilityKey, raw: string) => {
    const val = parseInt(raw, 10);
    if (!isNaN(val) && sb) {
      actions.onUpdate(entity.id, {
        monsterStatBlock: { ...sb, [key]: val },
      });
    }
  };

  return (
    <div className="border-divider space-y-2 border-t p-4">
      <h3 className="text-heading text-xs font-semibold tracking-wider uppercase">
        Ability Scores
      </h3>
      <div className="grid grid-cols-6 gap-1">
        {ABILITY_KEYS.map((key, i) => {
          const score = sb[key];
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
                <input
                  type="number"
                  value={score}
                  onChange={e => handleChange(key, e.target.value)}
                  aria-label={ABILITY_LABELS[i]}
                  className="bg-surface-raised text-heading w-full rounded px-0.5 py-0.5 text-center text-sm font-bold tabular-nums"
                />
              )}
              <span className="text-accent-emerald-text-muted text-[10px]">
                {signedMod(score)}
              </span>
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
