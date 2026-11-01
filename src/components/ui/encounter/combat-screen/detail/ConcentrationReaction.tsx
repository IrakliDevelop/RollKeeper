'use client';

import React from 'react';
import { Brain, ClockAlert } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type { DetailSectionProps } from './DetailHeader';

export function ConcentrationReaction({ entity, actions }: DetailSectionProps) {
  if (entity.type === 'lair') return null;
  const isPlayer = entity.type === 'player';

  return (
    <>
      {/* Concentration */}
      <div className="flex items-center gap-2">
        <Brain
          size={13}
          className="text-lapis-text shrink-0"
          aria-hidden="true"
        />
        <span className="text-body text-xs">Concentration:</span>
        {isPlayer ? (
          <span className="text-body text-xs">
            {entity.concentrationSpell ? (
              <span className="text-lapis-text font-medium">
                {entity.concentrationSpell}
              </span>
            ) : (
              <span className="text-muted">None</span>
            )}
            <span className="text-muted ml-1">(synced)</span>
          </span>
        ) : (
          <>
            <Input
              type="text"
              value={entity.concentrationSpell ?? ''}
              onChange={e =>
                actions.onSetConcentration(entity.id, e.target.value || null)
              }
              placeholder="None"
              aria-label="Concentration spell"
              size="sm"
              wrapperClassName="min-w-0 flex-1"
            />
            {entity.concentrationSpell && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => actions.onSetConcentration(entity.id, null)}
              >
                Drop
              </Button>
            )}
          </>
        )}
      </div>

      {/* Reaction */}
      <div className="flex items-center gap-2">
        <ClockAlert
          size={13}
          className="text-muted shrink-0"
          aria-hidden="true"
        />
        <span className="text-body text-xs">Reaction:</span>
        {isPlayer ? (
          <span className="text-body text-xs">
            {entity.hasUsedReaction ? (
              <span className="text-muted font-medium">Used</span>
            ) : (
              <span className="text-heading font-medium">Available</span>
            )}
            <span className="text-muted ml-1">(synced)</span>
          </span>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="xs"
            selected={entity.hasUsedReaction}
            onClick={() =>
              actions.onUpdate(entity.id, {
                hasUsedReaction: !entity.hasUsedReaction,
              })
            }
          >
            {entity.hasUsedReaction ? 'Used' : 'Available'}
          </Button>
        )}
      </div>
    </>
  );
}
