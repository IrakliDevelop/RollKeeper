'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { DetailSectionProps } from './DetailHeader';

export function LegendarySection({ entity, actions }: DetailSectionProps) {
  const leg = entity.legendaryActions;
  if (!leg) return null;

  const remaining = leg.maxActions - leg.usedActions;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-heading text-xs font-semibold tracking-wider uppercase">
          Legendary Actions
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: leg.maxActions }).map((_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full border-2 transition-colors ${
                  i < remaining
                    ? 'border-accent-amber-border-strong bg-accent-amber-border-strong'
                    : 'border-divider bg-surface-raised'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => actions.onResetLegendaryActions(entity.id)}
            className="text-muted hover:text-body rounded p-0.5 transition-colors"
            title="Reset legendary actions"
            aria-label="Reset legendary actions"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {leg.actions.map(action => {
        const canUse = remaining >= action.cost;
        return (
          <div
            key={action.id}
            className="bg-surface-raised flex items-center justify-between rounded px-2 py-1.5 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <span className="text-body text-sm font-medium">
                {action.name}
              </span>
              <span className="text-muted ml-1 text-xs">
                ({action.cost} action{action.cost !== 1 ? 's' : ''})
              </span>
              {action.description && (
                <p className="text-muted line-clamp-1 text-xs">
                  {action.description}
                </p>
              )}
            </div>
            <button
              onClick={() => actions.onUseLegendaryAction(entity.id, action.id)}
              disabled={!canUse}
              aria-label={`Use ${action.name}`}
              className={`ml-2 shrink-0 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                canUse
                  ? 'bg-accent-amber-bg text-accent-amber-text hover:opacity-80'
                  : 'bg-surface-raised text-faint cursor-not-allowed'
              }`}
            >
              Use
            </button>
          </div>
        );
      })}
    </div>
  );
}
