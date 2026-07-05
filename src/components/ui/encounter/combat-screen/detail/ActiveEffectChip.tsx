'use client';

import React from 'react';
import { X, Plus, Minus, Infinity as InfinityIcon } from 'lucide-react';
import type { EncounterCondition } from '@/types/encounter';
import type { EntityActions } from '../types';

interface ActiveEffectChipProps {
  cond: EncounterCondition;
  entityId: string;
  actions: Pick<EntityActions, 'onSetConditionRounds' | 'onRemoveCondition'>;
}

function kindDotClass(kind: EncounterCondition['kind']): string {
  if (kind === 'buff') return 'bg-accent-emerald-text';
  if (kind === 'debuff') return 'bg-accent-red-text';
  return 'bg-muted';
}

export function ActiveEffectChip({
  cond,
  entityId,
  actions,
}: ActiveEffectChipProps) {
  const hasRounds = cond.rounds != null;

  const handleDecrease = () => {
    const current = cond.rounds ?? 0;
    const next = current - 1;
    // stepping to 0 removes via the store; pass 0 directly
    actions.onSetConditionRounds(entityId, cond.id, next <= 0 ? 0 : next);
  };

  const handleIncrease = () => {
    const next = hasRounds ? (cond.rounds ?? 0) + 1 : 1;
    actions.onSetConditionRounds(entityId, cond.id, next);
  };

  return (
    <div className="bg-surface-raised border-divider flex items-center gap-0.5 rounded-full border px-2 py-0.5">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${kindDotClass(cond.kind)}`}
      />
      <span className="text-body mx-1 text-xs font-medium">{cond.name}</span>
      {cond.stackCount != null && cond.stackCount > 1 && (
        <span className="text-muted mr-0.5 text-xs">×{cond.stackCount}</span>
      )}
      <button
        onClick={handleDecrease}
        aria-label={`${cond.name} decrease rounds`}
        className="text-muted hover:text-body rounded p-0.5 transition-colors"
      >
        <Minus size={9} />
      </button>
      <span className="text-muted min-w-[1rem] text-center text-xs tabular-nums">
        {hasRounds ? (
          cond.rounds
        ) : (
          <InfinityIcon size={10} className="inline" />
        )}
      </span>
      <button
        onClick={handleIncrease}
        aria-label={`${cond.name} increase rounds`}
        className="text-muted hover:text-body rounded p-0.5 transition-colors"
      >
        <Plus size={9} />
      </button>
      <button
        onClick={() => actions.onRemoveCondition(entityId, cond.id)}
        aria-label={`Remove ${cond.name}`}
        className="text-muted hover:text-accent-red-text ml-0.5 rounded p-0.5 transition-colors"
      >
        <X size={9} />
      </button>
    </div>
  );
}
