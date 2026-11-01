'use client';

import React, { useRef, useState } from 'react';
import { Eye, Link2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '../types';
import { HeaderControls } from './HeaderControls';
import { HeaderStatLine } from './HeaderStatLine';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';

export interface DetailSectionProps {
  entity: EncounterEntity;
  actions: EntityActions;
}

export function DetailHeader({
  entity,
  actions,
  onOpenSheet,
  hideNameHeading = false,
}: DetailSectionProps & {
  onOpenSheet?: () => void;
  hideNameHeading?: boolean;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const cancelName = useRef(false);

  const isPlayer = entity.type === 'player';
  const isSummon = !!entity.summonId;
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

  const handleRemove = async () => {
    const confirmed = await confirmDialog({
      title: `Remove ${entity.name} from combat?`,
      confirmLabel: 'Remove from combat',
      tone: 'danger',
    });
    if (confirmed) actions.onRemove(entity.id);
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
              data-in-place-dirty=""
              onBlur={() => {
                if (!cancelName.current) commitName();
                cancelName.current = false;
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelName.current = true;
                  setIsEditingName(false);
                }
              }}
              className="font-display text-heading bg-surface border-divider w-full rounded-sm border px-2 py-1 text-2xl leading-tight font-bold"
              aria-label="Combatant name"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1">
              {hideNameHeading ? (
                <span className="font-display text-heading min-w-0 truncate text-2xl leading-tight font-bold">
                  {entity.name}
                </span>
              ) : (
                <h2 className="font-display text-heading min-w-0 truncate text-2xl leading-tight font-bold">
                  {entity.name}
                </h2>
              )}
              {!isPlayer && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setNameInput(entity.name);
                    setIsEditingName(true);
                  }}
                  aria-label={`Rename ${entity.name}`}
                  className="shrink-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                >
                  <Pencil size={14} aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral" size="sm">
              {badgeLabel}
            </Badge>
            {cr && (
              <Badge variant="neutral" size="sm">
                CR {cr}
              </Badge>
            )}
            {!isPlayer && npcSourceId && (
              <span className="text-muted inline-flex items-center gap-1 text-xs">
                <Link2 size={12} aria-hidden="true" />
                Stat edits sync to the NPC library record
              </span>
            )}
          </div>
          {meta && <p className="text-muted mt-0.5 text-xs">{meta}</p>}
          <HeaderStatLine entity={entity} actions={actions} />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isPlayer && onOpenSheet && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={onOpenSheet}
            >
              Full character sheet
            </Button>
          )}
          {npcSourceId && onViewNPC && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onViewNPC(npcSourceId, entity.id)}
              aria-label={`View ${entity.name} in NPC library`}
              className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              <Eye size={15} aria-hidden="true" />
            </Button>
          )}
          <Button
            type="button"
            variant="danger"
            size="xs"
            onClick={handleRemove}
            aria-label={`Remove ${entity.name} from combat`}
            className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            <X size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <HeaderControls entity={entity} actions={actions} />
    </div>
  );
}
