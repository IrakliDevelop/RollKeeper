'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { CLASS_RESOURCE_STYLE } from '@/components/ui/character/classResourceStyles';
import { renderStatBlockEntryText } from '@/utils/statBlockText';
import type { DetailSectionProps } from './DetailHeader';

export function LegendarySection({ entity, actions }: DetailSectionProps) {
  const leg = entity.legendaryActions;
  if (!leg) return null;

  const remaining = Math.max(0, leg.maxActions - leg.usedActions);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="type-label-heading text-heading">Legendary actions</h4>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: leg.maxActions }).map((_, i) => (
              <span
                key={i}
                role="img"
                aria-label={`Legendary action use ${i + 1}, ${i < remaining ? 'available' : 'spent'}`}
                className={`size-2.5 rounded-full border-[1.5px] ${i < remaining ? CLASS_RESOURCE_STYLE.pipOn : CLASS_RESOURCE_STYLE.pipOff}`}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => actions.onResetLegendaryActions(entity.id)}
            className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            aria-label="Reset legendary actions"
          >
            <RotateCcw size={12} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {(leg.actions ?? []).map(action => {
        const canUse = remaining >= action.cost;
        return (
          <div
            key={action.id}
            className="border-divider flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0 pointer-coarse:min-h-11"
          >
            <div className="min-w-0 flex-1">
              <span className="text-body text-sm font-medium">
                {action.name}
              </span>
              <span className="text-muted ml-1 text-xs">
                ({action.cost} action{action.cost !== 1 ? 's' : ''})
              </span>
              {action.description && (
                <p
                  className="text-muted line-clamp-1 text-xs"
                  dangerouslySetInnerHTML={{
                    __html: renderStatBlockEntryText(action.description),
                  }}
                />
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => actions.onUseLegendaryAction(entity.id, action.id)}
              disabled={!canUse}
              aria-label={`Use ${action.name}`}
              className="shrink-0"
            >
              Use
            </Button>
            {!canUse && (
              <span className="text-muted text-xs">
                Needs {action.cost} {action.cost === 1 ? 'action' : 'actions'},{' '}
                {remaining} left
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
