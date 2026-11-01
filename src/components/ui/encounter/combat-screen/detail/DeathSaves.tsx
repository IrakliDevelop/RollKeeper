'use client';

import React, { useEffect, useRef } from 'react';
import { Skull } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '../types';

interface DeathSavesProps {
  entity: EncounterEntity;
  actions: EntityActions;
}

export function DeathSaves({ entity, actions }: DeathSavesProps) {
  const ds = entity.deathSaves;
  const pendingStatusFocus = useRef<'stable' | 'dead' | null>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const status = pendingStatusFocus.current;
    if (
      (status === 'stable' && ds?.isStabilized) ||
      (status === 'dead' && (ds?.failures ?? 0) >= 3)
    ) {
      statusRef.current?.focus();
      pendingStatusFocus.current = null;
    }
  }, [ds]);
  if (!ds) return null;

  const isNpc = entity.type === 'npc' || entity.npcSourceId != null;

  if (ds.isStabilized) {
    return (
      <div className="flex items-center gap-2">
        <Skull size={14} className="text-heading shrink-0" />
        <span ref={statusRef} tabIndex={-1}>
          <Badge variant="success">Stabilized</Badge>
        </span>
      </div>
    );
  }

  if (ds.failures >= 3) {
    return (
      <div className="flex items-center gap-2">
        <Skull size={14} className="text-heading shrink-0" />
        <span ref={statusRef} tabIndex={-1}>
          <Badge variant="danger">Dead</Badge>
        </span>
      </div>
    );
  }

  const handleSuccess = (i: number) => {
    if (!isNpc) return;
    const filled = i <= ds.successes;
    const newSuccesses = filled ? i - 1 : i;
    if (newSuccesses >= 3) pendingStatusFocus.current = 'stable';
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
    if (newFailures >= 3) pendingStatusFocus.current = 'dead';
    actions.onUpdate(entity.id, {
      deathSaves: { ...ds, failures: newFailures },
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Skull size={14} className="text-heading shrink-0" />
      <div className="flex items-center gap-1.5">
        <span className="text-verdigris-text text-xs font-semibold">S</span>
        {[1, 2, 3].map(i => {
          const filled = i <= ds.successes;
          return isNpc ? (
            <button
              key={`s-${i}`}
              type="button"
              aria-label={`${filled ? 'Clear' : 'Mark'} death save success ${i}`}
              onClick={() => handleSuccess(i)}
              className="focus-visible:outline-ring flex min-h-6 min-w-6 items-center justify-center rounded-sm focus-visible:outline-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              <span
                aria-hidden="true"
                className={`size-3 rounded-full border-2 ${filled ? 'border-verdigris-border bg-verdigris-bg' : 'border-divider-strong bg-surface'}`}
              />
            </button>
          ) : (
            <span
              key={`s-${i}`}
              role="img"
              aria-label={`Death save success ${i}, ${filled ? 'marked' : 'unmarked'}`}
              className={`size-3 rounded-full border-2 ${filled ? 'border-verdigris-border bg-verdigris-bg' : 'border-divider-strong bg-surface'}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-blood-text text-xs font-semibold">F</span>
        {[1, 2, 3].map(i => {
          const filled = i <= ds.failures;
          return isNpc ? (
            <button
              key={`f-${i}`}
              type="button"
              aria-label={`${filled ? 'Clear' : 'Mark'} death save failure ${i}`}
              onClick={() => handleFailure(i)}
              className="focus-visible:outline-ring flex min-h-6 min-w-6 items-center justify-center rounded-sm focus-visible:outline-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              <span
                aria-hidden="true"
                className={`size-3 rounded-full border-2 ${filled ? 'border-blood-border bg-blood-bg' : 'border-divider-strong bg-surface'}`}
              />
            </button>
          ) : (
            <span
              key={`f-${i}`}
              role="img"
              aria-label={`Death save failure ${i}, ${filled ? 'marked' : 'unmarked'}`}
              className={`size-3 rounded-full border-2 ${filled ? 'border-blood-border bg-blood-bg' : 'border-divider-strong bg-surface'}`}
            />
          );
        })}
      </div>
    </div>
  );
}
