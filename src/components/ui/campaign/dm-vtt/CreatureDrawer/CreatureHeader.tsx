'use client';

import React, { useState } from 'react';
import { Pencil, Swords, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

import { dispositionColor } from '../combatantToken';
import { creatureBadge, creatureMetaLine } from './CreatureDrawer.utils';
import { CreatureHeaderActions } from './CreatureHeaderActions';

export interface CreatureHeaderProps {
  entity: EncounterEntity;
  actions: EntityActions;
  isTurn: boolean;
  editing: boolean;
  onToggleEditing: () => void;
  onClose: () => void;
}

const TONE_CLASSES: Record<ReturnType<typeof creatureBadge>['tone'], string> = {
  purple:
    'bg-accent-purple-bg text-accent-purple-text border-accent-purple-border',
  amber: 'bg-accent-amber-bg text-accent-amber-text border-accent-amber-border',
  blue: 'bg-accent-blue-bg text-accent-blue-text border-accent-blue-border',
  emerald:
    'bg-accent-emerald-bg text-accent-emerald-text border-accent-emerald-border',
};

/** Drawer header: avatar, rename, kind/CR/turn/concentration badges, meta line, and the action buttons. */
export function CreatureHeader({
  entity,
  actions,
  isTurn,
  editing,
  onToggleEditing,
  onClose,
}: CreatureHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const badge = creatureBadge(entity);
  const cr = entity.monsterStatBlock?.cr;
  const meta = creatureMetaLine(entity);
  const ringColor = dispositionColor(entity);

  const commitName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== entity.name) {
      actions.onUpdate(entity.id, { name: trimmed });
    }
    setIsEditingName(false);
  };

  const ringStyle = { boxShadow: `0 0 0 2px ${ringColor}` };

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 self-start">
          {entity.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entity.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
              style={ringStyle}
            />
          ) : (
            <div
              className="bg-surface-raised text-heading flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
              style={ringStyle}
            >
              {entity.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

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
              className="font-display text-heading bg-surface-raised border-divider w-full rounded border px-2 py-0.5 text-xl leading-tight font-bold"
              aria-label="Combatant name"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1">
              <h2 className="font-display text-heading min-w-0 truncate text-xl leading-tight font-bold">
                {entity.name}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setNameInput(entity.name);
                  setIsEditingName(true);
                }}
                aria-label="Rename"
                title="Rename"
                className="text-faint hover:text-body hover:bg-surface-raised flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[badge.tone]}`}
            >
              {badge.label}
            </span>
            {cr && (
              <span className="bg-surface-raised text-muted rounded-full px-2 py-0.5 text-[11px] font-medium">
                CR {cr}
              </span>
            )}
            {isTurn && (
              <Badge
                variant="success"
                size="sm"
                leftIcon={<Swords size={11} />}
              >
                Their turn
              </Badge>
            )}
            {entity.concentrationSpell && (
              <Badge variant="info" size="sm" leftIcon={<Zap size={11} />}>
                {entity.concentrationSpell}
              </Badge>
            )}
          </div>

          {meta && <p className="text-muted mt-0.5 text-xs">{meta}</p>}
        </div>

        <CreatureHeaderActions
          entity={entity}
          actions={actions}
          editing={editing}
          onToggleEditing={onToggleEditing}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
