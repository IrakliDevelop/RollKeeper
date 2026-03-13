'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, ArrowLeft, Edit3 } from 'lucide-react';
import Link from 'next/link';
import { useEncounterStore } from '@/store/encounterStore';
import { useNPCStore } from '@/store/npcStore';
import { useDmStore } from '@/store/dmStore';
import { useCampaignSync } from '@/hooks/useCampaignSync';
import {
  mergePlayerSyncData,
  hasPlayerDataChanged,
  syncSummonsToEncounter,
} from '@/utils/encounterSync';
import { Button } from '@/components/ui/forms/button';
import { InitiativeTracker } from './InitiativeTracker';
import { AddEntityDialog } from './AddEntityDialog';
import { PlayerDetailDialog } from '@/components/ui/campaign/PlayerDetailDialog';
import { CampaignPlayerData } from '@/types/campaign';

interface EncounterViewProps {
  encounterId: string;
  campaignCode: string;
}

export function EncounterView({
  encounterId,
  campaignCode,
}: EncounterViewProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [viewingPlayer, setViewingPlayer] = useState<CampaignPlayerData | null>(
    null
  );

  const encounter = useEncounterStore(state =>
    state.encounters.find(e => e.id === encounterId)
  );
  const {
    updateEncounter,
    addEntity,
    removeEntity,
    updateEntity,
    startCombat,
    endCombat,
    nextTurn,
    prevTurn,
    rollAllInitiatives,
    damageEntity,
    healEntity,
    addCondition,
    removeCondition,
    useAbility: expendAbility,
    restoreAbility,
    useLegendaryAction: expendLegendaryAction,
    resetLegendaryActions,
    setConcentration,
    useLairAction: expendLairAction,
    setInitiative,
  } = useEncounterStore();

  const { npcs } = useNPCStore();

  const { dmId, adjustPlayerCounter, setPlayerColor } = useDmStore();
  const campaign = useDmStore(state => state.getCampaign(campaignCode));

  const { players: campaignPlayers } = useCampaignSync({
    code: campaignCode,
    dmId,
    campaignName: campaign?.name ?? 'Campaign',
    createdAt: campaign?.createdAt ?? new Date().toISOString(),
    interval: 15000,
  });

  const mappedPlayers = campaignPlayers.map(p => ({
    id: p.playerId,
    name: p.characterName,
    class: p.characterData?.class?.name ?? '',
    level: p.characterData?.level ?? 1,
    armorClass: p.characterData?.armorClass ?? 10,
    currentHp: p.characterData?.hitPoints?.current ?? 0,
    maxHp: p.characterData?.hitPoints?.max ?? 0,
    dexterity: p.characterData?.abilities?.dexterity ?? 10,
  }));

  // Build player sync timestamp map for freshness indicators
  const playerSyncMap = Object.fromEntries(
    campaignPlayers.map(p => [p.playerId, p.lastSynced])
  );

  // Sync live player data into encounter entities
  const syncRef = useRef(false);
  useEffect(() => {
    if (!encounter || campaignPlayers.length === 0) return;
    // Prevent running on first mount before data is loaded
    if (!syncRef.current) {
      syncRef.current = true;
      return;
    }

    for (const entity of encounter.entities) {
      if (entity.type === 'player' && entity.playerCharacterId) {
        const playerData = campaignPlayers.find(
          p => p.playerId === entity.playerCharacterId
        );
        if (playerData) {
          // Sync player HP/AC/conditions
          const updates = mergePlayerSyncData(entity, playerData);
          if (updates && hasPlayerDataChanged(entity, updates)) {
            updateEntity(encounterId, entity.id, updates);
          }
          // Sync player's summons into encounter
          const playerSummons = playerData.characterData?.summons ?? [];
          syncSummonsToEncounter(
            encounter,
            entity,
            playerSummons,
            addEntity,
            updateEntity,
            removeEntity
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignPlayers]);

  if (!encounter) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted mb-4">Encounter not found.</p>
        <Link href={`/dm/campaign/${campaignCode}/encounters`}>
          <Button variant="secondary" leftIcon={<ArrowLeft size={16} />}>
            Back to Encounters
          </Button>
        </Link>
      </div>
    );
  }

  const handleStartEditName = () => {
    setNameInput(encounter.name);
    setEditingName(true);
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      updateEncounter(encounterId, { name: nameInput.trim() });
    }
    setEditingName(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dm/campaign/${campaignCode}/encounters`}>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={16} />}
            >
              Back
            </Button>
          </Link>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="bg-surface-secondary text-heading rounded px-2 py-1 text-xl font-bold"
                autoFocus
              />
              <Button variant="primary" size="sm" onClick={handleSaveName}>
                Save
              </Button>
            </div>
          ) : (
            <button
              onClick={handleStartEditName}
              className="text-heading group flex items-center gap-2 text-xl font-bold"
            >
              {encounter.name}
              <Edit3
                size={14}
                className="text-muted opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          leftIcon={<Plus size={16} />}
        >
          Add Combatant
        </Button>
      </div>

      {/* Initiative tracker (the core of the encounter) */}
      <InitiativeTracker
        encounter={encounter}
        playerSyncMap={playerSyncMap}
        onStartCombat={() => startCombat(encounterId)}
        onEndCombat={() => endCombat(encounterId)}
        onNextTurn={() => nextTurn(encounterId)}
        onPrevTurn={() => prevTurn(encounterId)}
        onRollAllInitiatives={() => rollAllInitiatives(encounterId)}
        onSetInitiative={(entityId, value) =>
          setInitiative(encounterId, entityId, value)
        }
        onUpdateEntity={(entityId, updates) =>
          updateEntity(encounterId, entityId, updates)
        }
        onRemoveEntity={entityId => {
          // Cascade-remove summon entities when removing a player
          const entity = encounter.entities.find(e => e.id === entityId);
          if (entity?.type === 'player' && entity.playerCharacterId) {
            const summonEntities = encounter.entities.filter(
              e => e.summonOwnerId === entity.playerCharacterId
            );
            for (const se of summonEntities) {
              removeEntity(encounterId, se.id);
            }
          }
          removeEntity(encounterId, entityId);
        }}
        onDamageEntity={(entityId, amount) =>
          damageEntity(encounterId, entityId, amount)
        }
        onHealEntity={(entityId, amount) =>
          healEntity(encounterId, entityId, amount)
        }
        onAddCondition={(entityId, condition) =>
          addCondition(encounterId, entityId, condition)
        }
        onRemoveCondition={(entityId, conditionId) =>
          removeCondition(encounterId, entityId, conditionId)
        }
        onUseAbility={(entityId, abilityId) =>
          expendAbility(encounterId, entityId, abilityId)
        }
        onRestoreAbility={(entityId, abilityId) =>
          restoreAbility(encounterId, entityId, abilityId)
        }
        onUseLegendaryAction={(entityId, actionId) =>
          expendLegendaryAction(encounterId, entityId, actionId)
        }
        onResetLegendaryActions={entityId =>
          resetLegendaryActions(encounterId, entityId)
        }
        onSetConcentration={(entityId, spellName) =>
          setConcentration(encounterId, entityId, spellName)
        }
        onUseLairAction={(entityId, actionId) =>
          expendLairAction(encounterId, entityId, actionId)
        }
        customCounterLabel={campaign?.customCounterLabel}
        playerCounterValues={campaign?.playerCounters}
        onAdjustPlayerCounter={(playerId, delta) =>
          adjustPlayerCounter(campaignCode, playerId, delta)
        }
        onViewPlayer={playerCharacterId => {
          const player = campaignPlayers.find(
            p => p.playerId === playerCharacterId
          );
          if (player) setViewingPlayer(player);
        }}
        onChangePlayerColor={(playerCharacterId, color) =>
          setPlayerColor(campaignCode, playerCharacterId, color)
        }
      />

      {/* Add entity dialog */}
      <AddEntityDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAddEntity={entity => {
          addEntity(encounterId, entity);
        }}
        campaignCode={campaignCode}
        campaignPlayers={mappedPlayers}
        npcs={npcs}
        playerColors={campaign?.playerColors}
      />

      {/* Player detail dialog */}
      {viewingPlayer && (
        <PlayerDetailDialog
          open={!!viewingPlayer}
          onOpenChange={open => {
            if (!open) setViewingPlayer(null);
          }}
          player={viewingPlayer}
          customCounterLabel={campaign?.customCounterLabel}
          counterValue={campaign?.playerCounters?.[viewingPlayer.playerId] ?? 0}
          onAdjustCounter={
            campaign?.customCounterLabel
              ? delta =>
                  adjustPlayerCounter(
                    campaignCode,
                    viewingPlayer.playerId,
                    delta
                  )
              : undefined
          }
        />
      )}
    </div>
  );
}
