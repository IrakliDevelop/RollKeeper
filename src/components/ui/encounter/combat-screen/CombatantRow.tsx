'use client';

import { Button } from '@/components/ui/forms/button';
import type { EncounterEntity } from '@/types/encounter';
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
  hidePlayerHp: boolean;
  lastSynced?: string;
  counterLabel?: string;
  counterValue?: number;
  actions: EntityActions;
  onSelect: () => void;
}

function getIsDead(entity: EncounterEntity): boolean {
  const isDown = entity.currentHp <= 0 && entity.type !== 'lair';
  const hasDeathSaves =
    entity.type === 'player' || entity.type === 'npc' || !!entity.npcSourceId;
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
  const isRail = density === 'rail';
  const isDead = getIsDead(entity);
  const selectable = isRail || !isActive;

  return (
    <div
      className={`border-divider border-b py-2 ${isActive ? 'bg-surface-secondary border-l-brass-border border-l-2 pl-1' : ''} ${isSelected ? 'bg-surface-secondary' : ''} ${isOnDeck ? 'border-b-divider-strong' : ''}`}
    >
      <div className="flex min-w-0 flex-wrap items-start gap-2 px-2">
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
        <div className="min-w-24 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {selectable ? (
              <Button
                variant="ghost"
                size="xs"
                selected={isSelected}
                aria-pressed={isRail ? isSelected : undefined}
                onClick={onSelect}
                className={`max-w-full min-w-0 justify-start px-1 text-left ${isDead ? 'line-through' : ''}`}
              >
                <span className="truncate">{entity.name}</span>{' '}
                <span className="sr-only"> details</span>
              </Button>
            ) : (
              <span
                className={`type-ui text-heading ${isDead ? 'line-through' : ''}`}
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
            maxConditions={isRail ? 2 : 4}
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
