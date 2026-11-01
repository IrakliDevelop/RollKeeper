'use client';

import React from 'react';
import { X, Plus, Minus, Infinity as InfinityIcon } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { getConditionIcon } from '@/utils/conditionIcons';
import { isConditionIconName } from '@/utils/conditionIconRegistry';
import type { EncounterCondition } from '@/types/encounter';
import type { EntityActions } from '../types';

interface ActiveEffectChipProps {
  cond: EncounterCondition;
  entityId: string;
  actions: Pick<EntityActions, 'onSetConditionRounds' | 'onRemoveCondition'>;
}

function kindDotClass(kind: EncounterCondition['kind']): string {
  if (kind === 'buff') return 'bg-verdigris-fill';
  if (kind === 'debuff') return 'bg-ember-fill';
  return 'bg-muted';
}

function kindTextClass(kind: EncounterCondition['kind']): string {
  if (kind === 'buff') return 'text-verdigris-text';
  if (kind === 'debuff') return 'text-ember-text';
  return 'text-muted';
}

export function ActiveEffectChip({
  cond,
  entityId,
  actions,
}: ActiveEffectChipProps) {
  const hasRounds = cond.rounds != null;

  const Icon = isConditionIconName(cond.icon)
    ? getConditionIcon(cond.name, cond.kind, cond.icon)
    : null;

  const handleDecrease = () => {
    if (typeof cond.rounds !== 'number') return; // ∞ — nothing to count down
    actions.onSetConditionRounds(
      entityId,
      cond.id,
      Math.max(0, cond.rounds - 1)
    );
  };

  const handleIncrease = () => {
    const next = hasRounds ? (cond.rounds ?? 0) + 1 : 1;
    actions.onSetConditionRounds(entityId, cond.id, next);
  };

  return (
    <div className="border-divider flex flex-wrap items-center gap-1 rounded-sm border px-2 py-1">
      {Icon ? (
        <Icon
          size={11}
          aria-hidden
          className={`shrink-0 ${kindTextClass(cond.kind)}`}
        />
      ) : (
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${kindDotClass(cond.kind)}`}
        />
      )}
      <span className="text-body text-xs font-medium">{cond.name}</span>
      {cond.stackCount != null && cond.stackCount > 1 && (
        <span className="text-muted mr-0.5 text-xs">×{cond.stackCount}</span>
      )}
      {cond.sourceSpell && (
        <span className="text-muted text-xs">From {cond.sourceSpell}</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={handleDecrease}
        disabled={!hasRounds}
        aria-label={`Decrease ${cond.name} rounds`}
        className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <Minus size={12} aria-hidden="true" />
      </Button>
      <span className="text-muted min-w-[1rem] text-center text-xs tabular-nums">
        {hasRounds ? (
          cond.rounds
        ) : (
          <InfinityIcon
            size={12}
            className="inline"
            role="img"
            aria-label="No round limit"
          />
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={handleIncrease}
        aria-label={`Increase ${cond.name} rounds`}
        className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <Plus size={12} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => actions.onRemoveCondition(entityId, cond.id)}
        aria-label={`Remove ${cond.name}`}
        className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <X size={12} aria-hidden="true" />
      </Button>
    </div>
  );
}
