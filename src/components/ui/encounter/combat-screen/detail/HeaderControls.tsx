'use client';

import React, { useRef, useState } from 'react';
import { Eye, EyeOff, HeartPulse, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type { PlayerDisposition } from '@/types/encounter';
import type { DetailSectionProps } from './DetailHeader';
import { playersSeeLabel, playersSeeSuffix } from './playersSee';

const DISPOSITIONS: Array<{
  value: PlayerDisposition;
  label: string;
}> = [
  { value: 'ally', label: 'Ally' },
  { value: 'enemy', label: 'Enemy' },
  { value: 'neutral', label: 'Neutral' },
];

export function HeaderControls({ entity, actions }: DetailSectionProps) {
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const cancelAlias = useRef(false);

  if (entity.type === 'player') return null;

  const hpVisible = entity.hpVisibleToPlayers === true;
  const hpToggleLabel = hpVisible
    ? 'Hide HP from players'
    : 'Show exact HP to players';

  const commitAlias = (value: string) => {
    actions.onUpdate(entity.id, { playerAlias: value.trim() || undefined });
    setIsEditingAlias(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex flex-wrap items-center gap-1"
        role="group"
        aria-label="Player disposition"
      >
        {DISPOSITIONS.map(({ value, label }) => {
          const active =
            (entity.playerDisposition ??
              (entity.summonOwnerId ? 'ally' : 'enemy')) === value;
          return (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="xs"
              selected={active}
              aria-pressed={active}
              onClick={() =>
                actions.onUpdate(entity.id, { playerDisposition: value })
              }
            >
              {label}
            </Button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() =>
          actions.onUpdate(entity.id, { isHidden: !entity.isHidden })
        }
        selected={entity.isHidden}
        aria-label={
          entity.isHidden ? 'Show name to players' : 'Hide name from players'
        }
        className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        {entity.isHidden ? (
          <EyeOff size={14} aria-hidden="true" />
        ) : (
          <Eye size={14} aria-hidden="true" />
        )}
      </Button>

      <Button
        type="button"
        onClick={() =>
          actions.onUpdate(entity.id, { hpVisibleToPlayers: !hpVisible })
        }
        variant="ghost"
        size="xs"
        aria-label={hpToggleLabel}
        className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <HeartPulse size={14} aria-hidden="true" />
      </Button>

      {isEditingAlias ? (
        <Input
          type="text"
          value={aliasInput}
          onChange={e => setAliasInput(e.target.value)}
          data-in-place-dirty=""
          onBlur={() => {
            if (!cancelAlias.current) commitAlias(aliasInput);
            cancelAlias.current = false;
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') commitAlias(aliasInput);
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancelAlias.current = true;
              setIsEditingAlias(false);
            }
          }}
          placeholder="Alias…"
          size="sm"
          aria-label={`Player alias for ${entity.name}`}
          wrapperClassName="w-36"
          autoFocus
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => {
            setAliasInput(entity.playerAlias ?? '');
            setIsEditingAlias(true);
          }}
          aria-label={
            entity.playerAlias
              ? `Edit player alias for ${entity.name}: ${entity.playerAlias}`
              : `Set player alias for ${entity.name}`
          }
          className="pointer-coarse:min-h-11"
        >
          <Pencil size={13} aria-hidden="true" />
          {entity.playerAlias && (
            <span>&ldquo;{entity.playerAlias}&rdquo;</span>
          )}
        </Button>
      )}

      {(entity.isHidden || entity.playerAlias || hpVisible) && (
        <span className="text-muted text-xs">
          Players see:{' '}
          <span className="font-medium">{playersSeeLabel(entity)}</span>
          {playersSeeSuffix(entity)}
        </span>
      )}
    </div>
  );
}
