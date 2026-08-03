'use client';

import React from 'react';
import { NumberField } from '@/components/ui/forms/NumberInput';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '../types';

interface HeaderStatLineProps {
  entity: EncounterEntity;
  actions: EntityActions;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Compact Speed / Init / PB line under the combatant name — the 5e.tools-style
 * "spot it instantly" stats. Editable inline for non-players; static for
 * players (synced from their sheet). Speed needs a stat block as its patch
 * target; a non-player with a stat block keeps an editable (possibly empty)
 * input so a missing speed can still be set.
 */
export function HeaderStatLine({ entity, actions }: HeaderStatLineProps) {
  if (entity.type === 'lair') return null;

  const isPlayer = entity.type === 'player';
  const sb = entity.monsterStatBlock;
  const showSpeedLine =
    sb != null && (!isPlayer || (sb.speed?.length ?? 0) > 0);
  const showPb = !isPlayer || entity.proficiencyBonus != null;

  const updateSpeed = (value: string) => {
    if (!sb) return;
    actions.onUpdate(entity.id, {
      monsterStatBlock: { ...sb, speed: value },
    });
  };

  return (
    <div className="mt-1 space-y-0.5">
      {showSpeedLine && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted text-xs font-semibold">Speed</span>
          {isPlayer ? (
            <span className="text-body text-xs">{sb.speed}</span>
          ) : (
            <input
              type="text"
              defaultValue={sb.speed ?? ''}
              onBlur={e => updateSpeed(e.target.value)}
              className="bg-surface-raised border-divider text-body min-w-0 flex-1 rounded border px-2 py-0.5 text-xs"
              aria-label="Speed"
            />
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-muted text-xs font-semibold">Init</span>
        {isPlayer ? (
          <span className="text-body text-xs">
            {signed(entity.initiativeModifier)}
          </span>
        ) : (
          <NumberField
            value={entity.initiativeModifier}
            onChange={v => {
              if (v !== undefined)
                actions.onUpdate(entity.id, { initiativeModifier: v });
            }}
            className="bg-surface-raised text-body w-12 rounded px-1 py-0.5 text-center text-xs shadow-sm"
            aria-label="Initiative Mod"
          />
        )}
        {showPb && (
          <>
            <span className="text-faint text-xs">·</span>
            <span className="text-muted text-xs font-semibold">PB</span>
            {isPlayer ? (
              <span className="text-body text-xs">
                {signed(entity.proficiencyBonus as number)}
              </span>
            ) : (
              <NumberField
                value={entity.proficiencyBonus}
                onChange={v => {
                  if (v !== undefined)
                    actions.onUpdate(entity.id, { proficiencyBonus: v });
                }}
                allowEmpty
                className="bg-surface-raised text-body w-12 rounded px-1 py-0.5 text-center text-xs shadow-sm"
                aria-label="Proficiency Bonus"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
