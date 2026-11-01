'use client';

import React, { useRef } from 'react';
import { Brain, ClockAlert } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import type { DetailSectionProps } from './DetailHeader';

export function ConcentrationReaction({
  entity,
  actions,
  capabilities,
}: DetailSectionProps) {
  const concentrationRef = useRef<HTMLInputElement>(null);
  if (entity.type === 'lair') return null;
  const isPlayer = entity.type === 'player';
  // Scene runs: concentration is display-only; reaction per capability.
  const readOnlyConcentration = capabilities ? true : isPlayer;
  const readOnlyReaction = capabilities ? !capabilities.reaction : isPlayer;
  const syncedNote = capabilities ? null : '(synced)';

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
        {readOnlyConcentration ? (
          <span className="text-body text-xs">
            {entity.concentrationSpell ? (
              <span className="text-lapis-text font-medium">
                {entity.concentrationSpell}
              </span>
            ) : (
              <span className="text-muted">None</span>
            )}
            {syncedNote && (
              <span className="text-muted ml-1">{syncedNote}</span>
            )}
          </span>
        ) : (
          <>
            <Input
              ref={concentrationRef}
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
                onClick={() => {
                  actions.onSetConcentration(entity.id, null);
                  concentrationRef.current?.focus();
                }}
                aria-label={`Drop concentration on ${entity.concentrationSpell}`}
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
        {readOnlyReaction && (
          <span className="text-body text-xs">Reaction:</span>
        )}
        {readOnlyReaction ? (
          <span className="text-body text-xs">
            {entity.hasUsedReaction ? (
              <span className="text-muted font-medium">Used</span>
            ) : (
              <span className="text-heading font-medium">Available</span>
            )}
            {(syncedNote || isPlayer) && (
              <span className="text-muted ml-1">(synced)</span>
            )}
          </span>
        ) : (
          <Switch
            label="Reaction used"
            size="sm"
            checked={entity.hasUsedReaction === true}
            onCheckedChange={checked =>
              actions.onUpdate(entity.id, { hasUsedReaction: checked })
            }
          />
        )}
      </div>
    </>
  );
}
