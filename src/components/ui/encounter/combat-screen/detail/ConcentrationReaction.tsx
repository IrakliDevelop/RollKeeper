'use client';

import React from 'react';
import { Brain, ClockAlert } from 'lucide-react';
import type { DetailSectionProps } from './DetailHeader';

export function ConcentrationReaction({ entity, actions }: DetailSectionProps) {
  if (entity.type === 'lair') return null;
  const isPlayer = entity.type === 'player';

  return (
    <>
      {/* Concentration */}
      <div className="flex items-center gap-2">
        <Brain size={13} className="text-accent-purple-text shrink-0" />
        <span className="text-body text-xs">Concentration:</span>
        {isPlayer ? (
          <span className="text-body text-xs">
            {entity.concentrationSpell ? (
              <span className="text-accent-purple-text font-medium">
                {entity.concentrationSpell}
              </span>
            ) : (
              <span className="text-faint">None</span>
            )}
            <span className="text-faint ml-1">(synced)</span>
          </span>
        ) : (
          <>
            <input
              type="text"
              value={entity.concentrationSpell ?? ''}
              onChange={e =>
                actions.onSetConcentration(entity.id, e.target.value || null)
              }
              placeholder="None"
              className="bg-surface-raised text-body placeholder:text-faint flex-1 rounded px-2 py-0.5 text-xs shadow-sm"
            />
            {entity.concentrationSpell && (
              <button
                onClick={() => actions.onSetConcentration(entity.id, null)}
                className="text-muted hover:text-accent-red-text text-xs transition-colors"
              >
                Drop
              </button>
            )}
          </>
        )}
      </div>

      {/* Reaction */}
      <div className="flex items-center gap-2">
        <ClockAlert size={13} className="text-muted shrink-0" />
        <span className="text-body text-xs">Reaction:</span>
        {isPlayer ? (
          <span className="text-body text-xs">
            {entity.hasUsedReaction ? (
              <span className="text-accent-red-text font-medium">Used</span>
            ) : (
              <span className="text-accent-emerald-text font-medium">
                Available
              </span>
            )}
            <span className="text-faint ml-1">(synced)</span>
          </span>
        ) : (
          <button
            onClick={() =>
              actions.onUpdate(entity.id, {
                hasUsedReaction: !entity.hasUsedReaction,
              })
            }
            className={`rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors ${
              entity.hasUsedReaction
                ? 'border-accent-red-border bg-accent-red-bg text-accent-red-text'
                : 'border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text'
            }`}
          >
            {entity.hasUsedReaction ? 'Used' : 'Available'}
          </button>
        )}
      </div>
    </>
  );
}
