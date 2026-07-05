'use client';

import React, { useState } from 'react';
import type {
  EncounterEntity,
  EntityType,
  PlayerDisposition,
} from '@/types/encounter';
import type { EntityActions } from './types';
import { TokenChip } from './TokenChip';
import { RowBadges } from './RowBadges';
import { RowVitals } from './RowVitals';
import { RowControls } from './RowControls';
import { InitiativeCell } from './InitiativeCell';

export type RowDensity = 'rail' | 'focus';

export interface CombatantRowProps {
  entity: EncounterEntity;
  density: RowDensity;
  isActive: boolean;
  isSelected: boolean;
  isOnDeck: boolean;
  combatActive: boolean;
  hidePlayerHp: boolean;
  lastSynced?: string;
  counterLabel?: string;
  counterValue?: number;
  actions: EntityActions;
  onSelect: () => void;
}

function getStripeClass(
  disposition: PlayerDisposition | undefined,
  type: EntityType
): string {
  const d = disposition ?? (type === 'player' ? 'ally' : 'enemy');
  if (d === 'ally') return 'bg-accent-blue-border-strong';
  if (d === 'neutral') return 'bg-divider-strong';
  return 'bg-accent-red-border-strong';
}

function getRowClass(
  isActive: boolean,
  isSelected: boolean,
  isOnDeck: boolean
): string {
  if (isActive)
    return 'border-accent-amber-border-strong bg-accent-amber-bg shadow-lg';
  if (isSelected) return 'border-accent-blue-border-strong bg-accent-blue-bg';
  if (isOnDeck) return 'border-accent-amber-border bg-accent-amber-bg';
  return 'border-divider bg-surface-raised';
}

function getIsDead(entity: EncounterEntity): boolean {
  const isDown = entity.currentHp <= 0 && entity.type !== 'lair';
  const hasDeathSaves = entity.type === 'player' || entity.type === 'npc';
  return hasDeathSaves ? entity.deathSaves?.failures === 3 : isDown;
}

export function CombatantRow({
  entity,
  density,
  isActive,
  isSelected,
  isOnDeck,
  hidePlayerHp,
  lastSynced,
  counterLabel,
  counterValue = 0,
  actions,
  onSelect,
}: CombatantRowProps): React.JSX.Element {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const isDead = getIsDead(entity);
  const isRail = density === 'rail';
  const stripeClass = getStripeClass(entity.playerDisposition, entity.type);
  const rowClass = getRowClass(isActive, isSelected, isOnDeck);

  function commitName() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== entity.name)
      actions.onUpdate(entity.id, { name: trimmed });
    setEditingName(false);
  }

  return (
    <div
      className={`relative rounded-lg border transition-all ${rowClass} ${isDead ? 'opacity-60' : ''}`}
      onClick={onSelect}
    >
      <div
        className={`absolute top-2 bottom-2 left-0 w-1 rounded-r ${stripeClass}`}
      />

      <div className="flex items-center gap-2.5 px-3 py-2 pl-4">
        <InitiativeCell
          entity={entity}
          isRail={isRail}
          isActive={isActive}
          onSetInitiative={actions.onSetInitiative}
        />

        <TokenChip
          entity={entity}
          size={isRail ? 'md' : 'sm'}
          actions={{
            onUpdate: actions.onUpdate,
            onChangePlayerColor: actions.onChangePlayerColor,
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
            {editingName ? (
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                onClick={e => e.stopPropagation()}
                className="bg-surface-raised text-heading max-w-[200px] min-w-0 rounded px-1.5 py-0.5 font-semibold shadow-sm"
                autoFocus
              />
            ) : (
              <span
                className={`font-display text-heading truncate text-sm font-bold ${isDead ? 'line-through opacity-60' : ''} ${entity.type !== 'player' ? 'hover:text-body cursor-pointer rounded transition-colors' : ''}`}
                onClick={e => {
                  if (entity.type !== 'player') {
                    e.stopPropagation();
                    setNameInput(entity.name);
                    setEditingName(true);
                  }
                }}
                title={entity.type !== 'player' ? 'Click to rename' : undefined}
              >
                {entity.name}
              </span>
            )}
            <RowBadges
              entity={entity}
              isOnDeck={isOnDeck}
              lastSynced={lastSynced}
            />
          </div>

          <RowVitals
            entity={entity}
            hidePlayerHp={hidePlayerHp}
            onRemoveCondition={actions.onRemoveCondition}
          />
        </div>

        <RowControls
          entity={entity}
          isRail={isRail}
          counterLabel={counterLabel}
          counterValue={counterValue}
          actions={actions}
        />
      </div>
    </div>
  );
}
