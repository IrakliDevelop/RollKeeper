'use client';

import React from 'react';
import { HPBar } from '@/components/shared/combat/HPBar';
import { ConditionBadge } from '@/components/shared/combat/ConditionBadge';
import type { EncounterEntity } from '@/types/encounter';

const MAX_VISIBLE_CONDITIONS = 4;

interface RowVitalsProps {
  entity: EncounterEntity;
  hidePlayerHp: boolean;
  onRemoveCondition: (entityId: string, conditionId: string) => void;
}

export function RowVitals({
  entity,
  hidePlayerHp,
  onRemoveCondition,
}: RowVitalsProps) {
  const showHp = entity.type !== 'lair';
  const isHpHidden = hidePlayerHp && entity.type === 'player';
  const conditions = entity.conditions;
  const visibleConditions = conditions.slice(0, MAX_VISIBLE_CONDITIONS);
  const overflowCount = conditions.length - MAX_VISIBLE_CONDITIONS;
  const showPlayerHint =
    entity.type !== 'player' &&
    ((entity.isHidden ?? false) || !!entity.playerAlias);

  return (
    <div className="space-y-0.5">
      {showHp &&
        (isHpHidden ? (
          <div className="text-muted text-xs italic">HP hidden</div>
        ) : (
          <HPBar
            current={entity.currentHp}
            max={entity.maxHp}
            temp={entity.tempHp}
            size="sm"
          />
        ))}

      {showPlayerHint && (
        <div className="text-faint text-[10px]">
          Players see:{' '}
          <span className="font-medium">
            {entity.playerAlias?.trim() ||
              (entity.isHidden ? 'Enemy' : entity.name)}
          </span>
        </div>
      )}

      {entity.type === 'lair' &&
        entity.lairActions &&
        entity.lairActions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entity.lairActions.map(la => (
              <span
                key={la.id}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  la.usedThisRound
                    ? 'bg-surface-secondary text-faint line-through'
                    : 'bg-accent-emerald-bg text-accent-emerald-text'
                }`}
              >
                {la.name}
              </span>
            ))}
          </div>
        )}

      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visibleConditions.map(c => (
            <ConditionBadge
              key={c.id}
              name={c.name}
              stackCount={c.stackCount}
              sourceSpell={c.sourceSpell}
              onRemove={() => onRemoveCondition(entity.id, c.id)}
            />
          ))}
          {overflowCount > 0 && (
            <span className="bg-surface-secondary text-faint inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              +{overflowCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
