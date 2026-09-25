'use client';

import React from 'react';
import { Eye, EyeOff, HeartPulse } from 'lucide-react';

import { Input } from '@/components/ui/forms/input';
import {
  HEADING_CLASS,
  SECTION_CLASS,
} from '@/components/ui/campaign/player-vtt/SheetDrawer/sheetSectionStyles';
import {
  playersSeeLabel,
  playersSeeSuffix,
} from '@/components/ui/encounter/combat-screen/detail/playersSee';
import type { PlayerDisposition, EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

export interface CreaturePlayersRowProps {
  entity: EncounterEntity;
  actions: EntityActions;
}

const DISPOSITIONS: Array<{
  value: PlayerDisposition;
  label: string;
  activeClass: string;
}> = [
  {
    value: 'ally',
    label: 'Ally',
    activeClass: 'bg-surface-raised text-accent-emerald-text shadow-sm',
  },
  {
    value: 'enemy',
    label: 'Enemy',
    activeClass: 'bg-surface-raised text-accent-red-text shadow-sm',
  },
  {
    value: 'neutral',
    label: 'Neutral',
    activeClass: 'bg-surface-raised text-muted shadow-sm',
  },
];

/** Dashed "what the players see" card: disposition, hidden/HP toggles, alias, and a live preview. */
export function CreaturePlayersRow({
  entity,
  actions,
}: CreaturePlayersRowProps) {
  if (entity.type === 'lair') return null;

  const hpVisible = entity.hpVisibleToPlayers === true;
  const hpToggleLabel = hpVisible
    ? 'Hide HP from players'
    : 'Show exact HP to players';

  const commitAlias = (value: string) => {
    actions.onUpdate(entity.id, { playerAlias: value.trim() || undefined });
  };

  return (
    <div className={`${SECTION_CLASS} border-dashed`}>
      <p className={HEADING_CLASS}>Players</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-surface-secondary flex items-center rounded-md p-0.5">
          {DISPOSITIONS.map(({ value, label, activeClass }) => {
            const active = (entity.playerDisposition ?? 'enemy') === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  actions.onUpdate(entity.id, { playerDisposition: value })
                }
                aria-pressed={active}
                className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                  active ? activeClass : 'text-faint hover:text-muted'
                }`}
                title={label}
              >
                {label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() =>
            actions.onUpdate(entity.id, { isHidden: !entity.isHidden })
          }
          className={`rounded p-1 transition-colors ${
            entity.isHidden
              ? 'text-accent-amber-text hover:bg-accent-amber-bg'
              : 'text-faint hover:text-muted hover:bg-surface-raised'
          }`}
          title={
            entity.isHidden
              ? 'Name hidden from players — click to reveal'
              : 'Name visible to players — click to hide'
          }
        >
          {entity.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>

        <button
          type="button"
          onClick={() =>
            actions.onUpdate(entity.id, { hpVisibleToPlayers: !hpVisible })
          }
          aria-pressed={hpVisible}
          aria-label={hpToggleLabel}
          className={`rounded p-1 transition-colors ${
            hpVisible
              ? 'text-accent-red-text hover:bg-accent-red-bg'
              : 'text-faint hover:text-muted hover:bg-surface-raised'
          }`}
          title={hpToggleLabel}
        >
          <HeartPulse size={14} />
        </button>

        <Input
          type="text"
          defaultValue={entity.playerAlias ?? ''}
          onBlur={e => commitAlias(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              commitAlias((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Alias players see…"
          aria-label="Alias players see"
          wrapperClassName="w-44"
        />
      </div>

      <p className="text-faint mt-2 text-[11px]">
        Players see: <b className="font-semibold">{playersSeeLabel(entity)}</b>
        {playersSeeSuffix(entity)}
      </p>
    </div>
  );
}
