'use client';

import React, { useState } from 'react';
import {
  SkipForward,
  SkipBack,
  Play,
  Square,
  Dices,
  EyeOff,
  Eye,
} from 'lucide-react';
import {
  Encounter,
  EncounterEntity,
  EncounterCondition,
} from '@/types/encounter';
import { EntityCard } from './EntityCard';
import { Button } from '@/components/ui/forms/button';

interface InitiativeTrackerProps {
  encounter: Encounter;
  playerSyncMap?: Record<string, string>; // playerId → lastSynced ISO timestamp
  onStartCombat: () => void;
  onEndCombat: () => void;
  onNextTurn: () => void;
  onPrevTurn: () => void;
  onRollAllInitiatives: () => void;
  onUpdateEntity: (entityId: string, updates: Partial<EncounterEntity>) => void;
  onRemoveEntity: (entityId: string) => void;
  onDamageEntity: (entityId: string, amount: number) => void;
  onHealEntity: (entityId: string, amount: number) => void;
  onAddCondition: (
    entityId: string,
    condition: Omit<EncounterCondition, 'id'>
  ) => void;
  onRemoveCondition: (entityId: string, conditionId: string) => void;
  onUseAbility: (entityId: string, abilityId: string) => void;
  onRestoreAbility: (entityId: string, abilityId: string) => void;
  onUseLegendaryAction: (entityId: string, actionId: string) => void;
  onResetLegendaryActions: (entityId: string) => void;
  onSetConcentration: (entityId: string, spellName: string | null) => void;
  onUseLairAction: (entityId: string, actionId: string) => void;
  onSetInitiative: (entityId: string, value: number) => void;
  customCounterLabel?: string;
  playerCounterValues?: Record<string, number>;
  onAdjustPlayerCounter?: (playerId: string, delta: number) => void;
  onViewPlayer?: (playerCharacterId: string) => void;
  onViewNPC?: (npcSourceId: string) => void;
  onChangePlayerColor?: (
    playerCharacterId: string,
    color: string | undefined
  ) => void;
  onLongRestEntity?: (entityId: string) => void;
}

export function InitiativeTracker({
  encounter,
  playerSyncMap,
  onStartCombat,
  onEndCombat,
  onNextTurn,
  onPrevTurn,
  onRollAllInitiatives,
  onUpdateEntity,
  onRemoveEntity,
  onDamageEntity,
  onHealEntity,
  onAddCondition,
  onRemoveCondition,
  onUseAbility,
  onRestoreAbility,
  onUseLegendaryAction,
  onResetLegendaryActions,
  onSetConcentration,
  onUseLairAction,
  onSetInitiative,
  customCounterLabel,
  playerCounterValues,
  onAdjustPlayerCounter,
  onViewPlayer,
  onViewNPC,
  onChangePlayerColor,
  onLongRestEntity,
}: InitiativeTrackerProps) {
  const [hidePlayerHp, setHidePlayerHp] = useState(false);
  const currentEntity = encounter.entities[encounter.currentTurn];

  return (
    <div className="space-y-4">
      {/* Combat controls */}
      <div className="bg-surface-secondary flex flex-wrap items-center gap-2 rounded-lg p-3">
        {encounter.isActive ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevTurn}
              leftIcon={<SkipBack size={16} />}
            >
              Prev
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onNextTurn}
              leftIcon={<SkipForward size={16} />}
            >
              Next Turn
            </Button>
            <div className="text-body ml-2 text-sm">
              Round{' '}
              <span className="text-heading font-bold">{encounter.round}</span>
              {currentEntity && (
                <>
                  <span className="text-faint mx-2">|</span>
                  <span className="text-heading font-medium">
                    {currentEntity.name}
                  </span>
                  &apos;s turn
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant={hidePlayerHp ? 'warning' : 'ghost'}
                size="sm"
                onClick={() => setHidePlayerHp(prev => !prev)}
                leftIcon={
                  hidePlayerHp ? <EyeOff size={14} /> : <Eye size={14} />
                }
                title={hidePlayerHp ? 'Show player HP' : 'Hide player HP'}
              >
                Player HP
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={onEndCombat}
                leftIcon={<Square size={14} />}
              >
                End Combat
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={onStartCombat}
              leftIcon={<Play size={16} />}
              disabled={encounter.entities.length === 0}
            >
              Start Combat
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onRollAllInitiatives}
              leftIcon={<Dices size={16} />}
              disabled={encounter.entities.length === 0}
            >
              Roll Initiatives (NPCs/Monsters)
            </Button>
          </>
        )}
      </div>

      {/* Entity list */}
      {encounter.entities.length === 0 ? (
        <div className="border-divider bg-surface-secondary rounded-lg border-2 border-dashed p-8 text-center">
          <p className="text-muted">
            No combatants yet. Add players, NPCs, or monsters to begin.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {encounter.entities.map((entity, idx) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              isCurrentTurn={
                encounter.isActive && idx === encounter.currentTurn
              }
              hidePlayerHp={hidePlayerHp}
              lastSynced={
                entity.playerCharacterId
                  ? playerSyncMap?.[entity.playerCharacterId]
                  : entity.summonOwnerId
                    ? playerSyncMap?.[entity.summonOwnerId]
                    : undefined
              }
              onUpdate={updates => onUpdateEntity(entity.id, updates)}
              onRemove={() => onRemoveEntity(entity.id)}
              onDamage={amount => onDamageEntity(entity.id, amount)}
              onHeal={amount => onHealEntity(entity.id, amount)}
              onAddCondition={condition => onAddCondition(entity.id, condition)}
              onRemoveCondition={conditionId =>
                onRemoveCondition(entity.id, conditionId)
              }
              onUseAbility={abilityId => onUseAbility(entity.id, abilityId)}
              onRestoreAbility={abilityId =>
                onRestoreAbility(entity.id, abilityId)
              }
              onUseLegendaryAction={actionId =>
                onUseLegendaryAction(entity.id, actionId)
              }
              onResetLegendaryActions={() => onResetLegendaryActions(entity.id)}
              onSetConcentration={spellName =>
                onSetConcentration(entity.id, spellName)
              }
              onUseLairAction={actionId => onUseLairAction(entity.id, actionId)}
              onSetInitiative={value => onSetInitiative(entity.id, value)}
              customCounterLabel={customCounterLabel}
              counterValue={
                entity.playerCharacterId
                  ? (playerCounterValues?.[entity.playerCharacterId] ?? 0)
                  : 0
              }
              onAdjustCounter={
                entity.type === 'player' &&
                entity.playerCharacterId &&
                onAdjustPlayerCounter
                  ? delta =>
                      onAdjustPlayerCounter(entity.playerCharacterId!, delta)
                  : undefined
              }
              onViewPlayer={
                entity.type === 'player' &&
                entity.playerCharacterId &&
                onViewPlayer
                  ? () => onViewPlayer(entity.playerCharacterId!)
                  : undefined
              }
              onViewNPC={
                entity.npcSourceId && onViewNPC
                  ? () => onViewNPC(entity.npcSourceId!)
                  : undefined
              }
              onLongRest={
                entity.npcSourceId && onLongRestEntity
                  ? () => onLongRestEntity(entity.id)
                  : undefined
              }
              onChangePlayerColor={
                entity.type === 'player' &&
                entity.playerCharacterId &&
                onChangePlayerColor
                  ? color =>
                      onChangePlayerColor(entity.playerCharacterId!, color)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
