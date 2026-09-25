'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, HeartPulse, Pencil } from 'lucide-react';
import type { PlayerDisposition } from '@/types/encounter';
import type { DetailSectionProps } from './DetailHeader';
import { playersSeeLabel, playersSeeSuffix } from './playersSee';

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

export function HeaderControls({ entity, actions }: DetailSectionProps) {
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState('');

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
      <div className="bg-surface-secondary flex items-center rounded-md p-0.5">
        {DISPOSITIONS.map(({ value, label, activeClass }) => {
          const active = (entity.playerDisposition ?? 'enemy') === value;
          return (
            <button
              key={value}
              onClick={() =>
                actions.onUpdate(entity.id, { playerDisposition: value })
              }
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

      {isEditingAlias ? (
        <input
          type="text"
          value={aliasInput}
          onChange={e => setAliasInput(e.target.value)}
          onBlur={() => commitAlias(aliasInput)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitAlias(aliasInput);
            if (e.key === 'Escape') setIsEditingAlias(false);
          }}
          placeholder="Alias…"
          className="bg-surface-raised text-body placeholder:text-faint w-28 rounded px-2 py-1 text-xs shadow-sm"
          autoFocus
        />
      ) : (
        <button
          onClick={() => {
            setAliasInput(entity.playerAlias ?? '');
            setIsEditingAlias(true);
          }}
          className={`flex items-center gap-1 rounded p-1 text-xs transition-colors ${
            entity.playerAlias
              ? 'text-accent-blue-text hover:bg-accent-blue-bg'
              : 'text-faint hover:text-muted hover:bg-surface-raised'
          }`}
          title={
            entity.playerAlias
              ? `Players see: "${entity.playerAlias}" — click to edit`
              : 'Set alias players see — click to edit'
          }
        >
          <Pencil size={13} />
          {entity.playerAlias && (
            <span>&ldquo;{entity.playerAlias}&rdquo;</span>
          )}
        </button>
      )}

      {(entity.isHidden || entity.playerAlias || hpVisible) && (
        <span className="text-faint text-[10px]">
          Players see:{' '}
          <span className="font-medium">{playersSeeLabel(entity)}</span>
          {playersSeeSuffix(entity)}
        </span>
      )}
    </div>
  );
}
