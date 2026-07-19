'use client';

import React, { useState } from 'react';
import { Eye, Pencil, X } from 'lucide-react';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '../types';
import { HeaderControls } from './HeaderControls';

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

export function DetailHeader({
  entity,
  actions,
  onOpenSheet,
}: DetailSectionProps & { onOpenSheet?: () => void }) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

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

  const commitName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== entity.name) {
      actions.onUpdate(entity.id, { name: trimmed });
    }
    setIsEditingName(false);
  };

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              className="font-display text-heading bg-surface-raised border-divider w-full rounded border px-2 py-0.5 text-2xl leading-tight font-bold"
              aria-label="Combatant name"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1">
              <h2 className="font-display text-heading min-w-0 truncate text-2xl leading-tight font-bold">
                {entity.name}
              </h2>
              {!isPlayer && (
                <button
                  onClick={() => {
                    setNameInput(entity.name);
                    setIsEditingName(true);
                  }}
                  aria-label="Rename"
                  title="Rename"
                  className="text-faint hover:text-body hover:bg-surface-raised flex h-11 w-11 shrink-0 items-center justify-center rounded transition-colors"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}
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

      <HeaderControls entity={entity} actions={actions} />
    </div>
  );
}
