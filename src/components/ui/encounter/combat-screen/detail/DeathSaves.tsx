'use client';

import React from 'react';
import { Skull } from 'lucide-react';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '../types';

interface DeathSavesProps {
  entity: EncounterEntity;
  actions: EntityActions;
}

export function DeathSaves({ entity, actions }: DeathSavesProps) {
  const ds = entity.deathSaves;
  if (!ds) return null;

  const isNpc = entity.type === 'npc';

  if (ds.isStabilized) {
    return (
      <div className="flex items-center gap-2">
        <Skull size={14} className="text-heading shrink-0" />
        <span className="bg-accent-amber-bg text-accent-amber-text rounded-full px-2.5 py-0.5 text-xs font-semibold">
          Stabilized
        </span>
      </div>
    );
  }

  if (ds.failures >= 3) {
    return (
      <div className="flex items-center gap-2">
        <Skull size={14} className="text-heading shrink-0" />
        <span className="bg-accent-red-bg text-accent-red-text rounded-full px-2.5 py-0.5 text-xs font-semibold">
          Dead
        </span>
      </div>
    );
  }

  const handleSuccess = (i: number) => {
    if (!isNpc) return;
    const filled = i <= ds.successes;
    const newSuccesses = filled ? i - 1 : i;
    actions.onUpdate(entity.id, {
      deathSaves: {
        ...ds,
        successes: newSuccesses,
        isStabilized: newSuccesses >= 3,
      },
    });
  };

  const handleFailure = (i: number) => {
    if (!isNpc) return;
    const filled = i <= ds.failures;
    const newFailures = filled ? i - 1 : i;
    actions.onUpdate(entity.id, {
      deathSaves: { ...ds, failures: newFailures },
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Skull size={14} className="text-heading shrink-0" />
      <div className="flex items-center gap-1.5">
        <span className="text-accent-emerald-text text-xs font-semibold">
          S
        </span>
        {[1, 2, 3].map(i => {
          const filled = i <= ds.successes;
          return (
            <span
              key={`s-${i}`}
              role={isNpc ? 'button' : undefined}
              aria-label={isNpc ? `Death save success ${i}` : undefined}
              onClick={() => handleSuccess(i)}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                filled
                  ? 'border-accent-emerald-border bg-accent-emerald-bg'
                  : 'border-divider bg-surface-raised'
              } ${isNpc ? 'hover:border-accent-emerald-border cursor-pointer' : ''}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-accent-red-text text-xs font-semibold">F</span>
        {[1, 2, 3].map(i => {
          const filled = i <= ds.failures;
          return (
            <span
              key={`f-${i}`}
              role={isNpc ? 'button' : undefined}
              aria-label={isNpc ? `Death save failure ${i}` : undefined}
              onClick={() => handleFailure(i)}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                filled
                  ? 'border-accent-red-border bg-accent-red-bg'
                  : 'border-divider bg-surface-raised'
              } ${isNpc ? 'hover:border-accent-red-border cursor-pointer' : ''}`}
            />
          );
        })}
      </div>
    </div>
  );
}
