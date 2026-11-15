'use client';

import React from 'react';
import { Eye, EyeOff, HeartPulse } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Section } from '@/components/ui/layout/section';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { SegmentedGroup } from '@/components/ui/campaign/location-map/ToolOptionControls';
import {
  playersSeeLabel,
  playersSeeSuffix,
} from '@/components/ui/encounter/combat-screen/detail/playersSee';
import { useDraftValue } from './useDraftValue';
import type { PlayerDisposition, EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

export interface CreaturePlayersRowProps {
  entity: EncounterEntity;
  actions: EntityActions;
}

const DISPOSITIONS: Array<{ value: PlayerDisposition; label: string }> = [
  { value: 'ally', label: 'Ally' },
  { value: 'enemy', label: 'Enemy' },
  { value: 'neutral', label: 'Neutral' },
];

/** "Players" section: disposition, hidden/HP toggles, alias, and a live preview of what players see. */
export function CreaturePlayersRow({
  entity,
  actions,
}: CreaturePlayersRowProps) {
  const hpVisible = entity.hpVisibleToPlayers === true;
  const hpToggleLabel = hpVisible
    ? 'Hide HP from players'
    : 'Show exact HP to players';
  const hiddenLabel = entity.isHidden
    ? 'Show name to players'
    : 'Hide name from players';
  const [alias, setAlias] = useDraftValue(entity.playerAlias ?? '');

  const commitAlias = () => {
    const next = alias.trim();
    if (next === (entity.playerAlias ?? '').trim()) return;
    actions.onUpdate(entity.id, { playerAlias: next || undefined });
  };

  return (
    <Section level={4} heading="Players">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedGroup
          label="Player disposition"
          size="sm"
          options={DISPOSITIONS}
          value={entity.playerDisposition ?? 'enemy'}
          onChange={value =>
            actions.onUpdate(entity.id, { playerDisposition: value })
          }
        />

        <Tooltip content={hiddenLabel}>
          <Button
            variant="ghost"
            size="sm"
            className="w-9 shrink-0 px-0"
            selected={!!entity.isHidden}
            onClick={() =>
              actions.onUpdate(entity.id, { isHidden: !entity.isHidden })
            }
            aria-label={hiddenLabel}
          >
            {entity.isHidden ? (
              <EyeOff size={16} aria-hidden />
            ) : (
              <Eye size={16} aria-hidden />
            )}
          </Button>
        </Tooltip>

        <Tooltip content={hpToggleLabel}>
          <Button
            variant="ghost"
            size="sm"
            className="w-9 shrink-0 px-0"
            selected={hpVisible}
            onClick={() =>
              actions.onUpdate(entity.id, { hpVisibleToPlayers: !hpVisible })
            }
            aria-label={hpToggleLabel}
          >
            <HeartPulse size={16} aria-hidden />
          </Button>
        </Tooltip>

        <Input
          type="text"
          size="sm"
          value={alias}
          onChange={e => setAlias(e.target.value)}
          onBlur={commitAlias}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder="Alias players see…"
          aria-label="Alias players see"
          wrapperClassName="w-44"
        />
      </div>

      <p className="type-small text-muted mt-2">
        Players see:{' '}
        <b className="text-body font-semibold">{playersSeeLabel(entity)}</b>
        {playersSeeSuffix(entity)}
      </p>
    </Section>
  );
}
