'use client';

import React from 'react';
import { HPBar } from '@/components/shared/combat/HPBar';
import { ConditionBadge } from '@/components/shared/combat/ConditionBadge';
import type { EncounterEntity } from '@/types/encounter';

interface RowVitalsProps {
  entity: EncounterEntity;
  hidePlayerHp: boolean;
  maxConditions: number;
  onRemoveCondition: (entityId: string, conditionId: string) => void;
}

export function RowVitals({
  entity,
  hidePlayerHp,
  maxConditions,
  onRemoveCondition,
}: RowVitalsProps) {
  const showHp = entity.type !== 'lair';
  const isHpHidden = hidePlayerHp && entity.type === 'player';
  const buffs = entity.conditions.filter(c => c.kind === 'buff');
  const conditions = entity.conditions.filter(c => c.kind !== 'buff');
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

      <EffectStrip
        effects={conditions}
        max={maxConditions}
        variant="condition"
        entityId={entity.id}
        onRemoveCondition={onRemoveCondition}
      />
      <EffectStrip
        effects={buffs}
        max={maxConditions}
        variant="buff"
        entityId={entity.id}
        onRemoveCondition={onRemoveCondition}
      />
    </div>
  );
}

function EffectStrip({
  effects,
  max,
  variant,
  entityId,
  onRemoveCondition,
}: {
  effects: EncounterEntity['conditions'];
  max: number;
  variant: 'condition' | 'buff';
  entityId: string;
  onRemoveCondition: (entityId: string, conditionId: string) => void;
}) {
  if (effects.length === 0) return null;
  const visible = effects.slice(0, max);
  const overflowCount = effects.length - max;
  return (
    <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
      {visible.map(c => (
        <ConditionBadge
          key={c.id}
          name={c.name}
          stackCount={c.stackCount}
          sourceSpell={c.sourceSpell}
          variant={variant}
          onRemove={() => onRemoveCondition(entityId, c.id)}
        />
      ))}
      {overflowCount > 0 && (
        <span className="bg-surface-secondary text-faint inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium">
          +{overflowCount}
        </span>
      )}
    </div>
  );
}
