'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Pencil, X } from 'lucide-react';
import type { EncounterEntity, PlayerDisposition } from '@/types/encounter';
import type { EntityActions } from '../types';

export interface DetailSectionProps {
  entity: EncounterEntity;
  actions: EntityActions;
}

const BADGE_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  player: {
    bg: 'bg-accent-blue-bg',
    text: 'text-accent-blue-text',
    border: 'border-accent-blue-border',
  },
  npc: {
    bg: 'bg-accent-amber-bg',
    text: 'text-accent-amber-text',
    border: 'border-accent-amber-border',
  },
  monster: {
    bg: 'bg-accent-purple-bg',
    text: 'text-accent-purple-text',
    border: 'border-accent-purple-border',
  },
  lair: {
    bg: 'bg-accent-emerald-bg',
    text: 'text-accent-emerald-text',
    border: 'border-accent-emerald-border',
  },
};

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

export function DetailHeader({
  entity,
  actions,
  onOpenSheet,
}: DetailSectionProps & { onOpenSheet?: () => void }) {
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState('');

  const isPlayer = entity.type === 'player';
  const isSummon = !!entity.summonId;
  const badge = isSummon
    ? BADGE_STYLES.player
    : (BADGE_STYLES[entity.type] ?? BADGE_STYLES.monster);
  const badgeLabel = isSummon
    ? 'Summon'
    : entity.type === 'npc'
      ? 'NPC'
      : entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
  const cr = entity.monsterStatBlock?.cr;
  const meta = entity.monsterStatBlock
    ? [
        entity.monsterStatBlock.size,
        entity.monsterStatBlock.type,
        entity.monsterStatBlock.alignment,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const npcSourceId = entity.npcSourceId;
  const onViewNPC = actions.onViewNPC;

  const handleRemove = () => {
    if (window.confirm(`Remove ${entity.name} from combat?`)) {
      actions.onRemove(entity.id);
    }
  };

  const commitAlias = (value: string) => {
    actions.onUpdate(entity.id, { playerAlias: value.trim() || undefined });
    setIsEditingAlias(false);
  };

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-heading text-2xl leading-tight font-bold">
            {entity.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text} ${badge.border}`}
            >
              {badgeLabel}
            </span>
            {cr && (
              <span className="bg-surface-raised text-muted rounded-full px-2 py-0.5 text-[11px] font-medium">
                CR {cr}
              </span>
            )}
          </div>
          {meta && <p className="text-muted mt-0.5 text-xs">{meta}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isPlayer && onOpenSheet && (
            <button
              onClick={onOpenSheet}
              className="bg-accent-blue-bg text-accent-blue-text border-accent-blue-border-strong rounded-lg border px-3 py-1.5 text-xs font-semibold"
            >
              Full character sheet
            </button>
          )}
          {npcSourceId && onViewNPC && (
            <button
              onClick={() => onViewNPC(npcSourceId, entity.id)}
              className="text-muted hover:text-accent-amber-text rounded p-1 transition-colors"
              title="View NPC details"
            >
              <Eye size={15} />
            </button>
          )}
          <button
            onClick={handleRemove}
            className="text-accent-red-text hover:bg-accent-red-bg rounded p-1 transition-colors"
            title="Remove from combat"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {!isPlayer && (
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

          {(entity.isHidden || entity.playerAlias) && (
            <span className="text-faint text-[10px]">
              Players see:{' '}
              <span className="font-medium">
                {entity.playerAlias?.trim() ||
                  (entity.isHidden ? 'Enemy' : entity.name)}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
