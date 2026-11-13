'use client';

import React, { useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
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

  // Disposition ring: a data colour, drawn inline rather than as a shadow class.
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
              className="bg-surface-raised type-subheading text-heading flex h-12 w-12 items-center justify-center rounded-full"
              style={ringStyle}
            >
              {entity.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <Input
              size="sm"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              aria-label="Combatant name"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1">
              <h2 className="type-heading text-heading min-w-0 truncate">
                {entity.name}
              </h2>
              {/* SideDrawer auto-focuses the first tabbable on open; a Radix
                  Tooltip here would open on every open. `title` keeps today's
                  hover hint. */}
              <Button
                variant="ghost"
                size="sm"
                className="w-9 shrink-0 px-0"
                aria-label={`Rename ${entity.name}`}
                title={`Rename ${entity.name}`}
                onClick={() => {
                  setNameInput(entity.name);
                  setIsEditingName(true);
                }}
              >
                <Pencil size={16} aria-hidden />
              </Button>
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral" size="sm">
              {badge.label}
            </Badge>
            {cr && (
              <Badge variant="neutral" size="sm">
                CR {cr}
              </Badge>
            )}
            {isTurn && (
              <Badge variant="primary" size="sm">
                Current turn
              </Badge>
            )}
            {entity.concentrationSpell && (
              <ConditionChip
                kind="concentration"
                name={entity.concentrationSpell}
              />
            )}
          </div>

          {meta && <p className="type-small text-muted mt-0.5">{meta}</p>}
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
