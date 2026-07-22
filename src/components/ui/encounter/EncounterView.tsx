'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEncounterStore } from '@/store/encounterStore';
import { useNPCStore } from '@/store/npcStore';
import { useDmStore } from '@/store/dmStore';
import { useCampaignSync } from '@/hooks/useCampaignSync';
import { applyPlayersToEncounter } from '@/utils/encounterSync';
import { useDmEffectsSync } from '@/hooks/useDmEffectsSync';
import { useDmCounterSync } from '@/hooks/useDmCounterSync';
import { useDmInitiativeSync } from '@/hooks/useDmInitiativeSync';
import { useTurnRequestSync } from '@/hooks/useTurnRequestSync';
import { useInitiativeSubmissionSync } from '@/hooks/useInitiativeSubmissionSync';
import { useActiveBattleMapId } from '@/hooks/useActiveBattleMapId';
import { useBattleMapPokes } from '@/hooks/useBattleMapPokes';
import { useDebouncedRefetch } from '@/hooks/useDebouncedRefetch';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useDmBattleMapSync } from '@/hooks/useDmBattleMapSync';
import { findLinkedBattleMap } from '@/utils/battleMapLinks';
import type { BattleMap } from '@/types/battlemap';
import { buildSharedInitiative } from '@/utils/buildSharedInitiative';
import { Button } from '@/components/ui/forms/button';
import { CombatScreen } from './combat-screen/CombatScreen';
import { EncounterBattleMapButton } from './EncounterBattleMapButton';
import type { EntityActions } from './combat-screen/types';
import { buildEntityActions } from './combat-screen/buildEntityActions';
import { AddCombatantDialog } from './combat-screen/AddCombatantDialog';
import { CombatConfigDialog } from './CombatConfigDialog';
import { PlayerDetailDialog } from '@/components/ui/campaign/PlayerDetailDialog';
import { NPCDetailDialog } from '@/components/ui/campaign/NPCDetailDialog';
import type { CampaignPlayerData } from '@/types/campaign';
import type { CampaignNPC } from '@/types/encounter';

interface EncounterViewProps {
  encounterId: string;
  campaignCode: string;
}

/**
 * `useBattleMapPokes` onPoke handler, extracted so the wiring is unit
 * testable without a full `EncounterView` render harness. EncounterView is
 * the initiative author for its own encounters, so 'initiative' pokes are
 * ignored here — only a 'players' poke (DM battle-map activity nudging
 * player HP/state) triggers an immediate campaign-sync refresh.
 */
export function handleEncounterPoke(
  feature: string,
  refresh: () => void
): void {
  if (feature === 'players') refresh();
}

/**
 * Start-combat side effect, extracted for unit testability (same pattern
 * as `handleEncounterPoke`). Starting combat makes the encounter's linked
 * battle map the campaign's live map, so players who tap the banner land
 * on the map the DM is actually fighting on — previously the only writer
 * of activeBattleMapId was the editor's manual share toggle, and a map
 * shared in an earlier session stayed live forever (with two same-named
 * maps, players joined the wrong one). No linked map → no push: never
 * clear a share the DM set up manually.
 */
export function pushLinkedMapLive(
  battleMaps: BattleMap[],
  encounterId: string,
  pushActive: (battleMapId: string | null, name?: string) => Promise<void>
): void {
  const linked = findLinkedBattleMap(battleMaps, encounterId);
  if (linked) void pushActive(linked.id, linked.name);
}

export function EncounterView({
  encounterId,
  campaignCode,
}: EncounterViewProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState<CampaignPlayerData | null>(
    null
  );
  const [viewingNpcFromEncounter, setViewingNpcFromEncounter] =
    useState<CampaignNPC | null>(null);
  const [viewingNpcEntityId, setViewingNpcEntityId] = useState<string | null>(
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
    addTempHp,
    setEntityHp,
    addCondition,
    removeCondition,
    setConditionRounds,
    useAbility: expendAbility,
    restoreAbility,
    useLegendaryAction: expendLegendaryAction,
    resetLegendaryActions,
    setConcentration,
    useLairAction: expendLairAction,
    setInitiative,
    longRestEntity,
    setPendingInitiativeRequest,
  } = useEncounterStore();

  const { getNPCsForCampaign, getNPC } = useNPCStore();
  const npcs = getNPCsForCampaign(campaignCode);

  const { dmId, adjustPlayerCounter, setPlayerColor } = useDmStore();
  const campaign = useDmStore(state => state.getCampaign(campaignCode));

  const { syncPlayerEffects } = useDmEffectsSync({ campaignCode, dmId });
  useDmCounterSync(campaignCode, dmId);

  const combatConfig = useEncounterStore(state => state.combatConfig);

  const { pushInitiative, pushInitiativeRequest } = useDmInitiativeSync({
    campaignCode,
    dmId,
  });

  const { pushActive } = useDmBattleMapSync(campaignCode, dmId);
  const getBattleMaps = useBattleMapStore(state => state.getBattleMaps);

  useTurnRequestSync({
    campaignCode,
    encounterId: encounter?.id,
    isActive: !!encounter?.isActive,
    // No onApplied: EncounterView has no toast mechanism.
  });

  useInitiativeSubmissionSync({ campaignCode, encounter });

  // Push initiative state to Redis whenever turn/round/entities change.
  // Only fires for campaign-linked encounters; safe when encounter is undefined.
  useEffect(() => {
    if (!encounter || !encounter.campaignCode) return;
    pushInitiative(buildSharedInitiative(encounter, combatConfig));
  }, [
    encounter,
    encounter?.isActive,
    encounter?.round,
    encounter?.currentTurn,
    encounter?.entities,
    combatConfig,
    pushInitiative,
  ]);

  const { players: campaignPlayers, refresh: refreshPlayers } = useCampaignSync(
    {
      code: campaignCode,
      dmId,
      campaignName: campaign?.name ?? 'Campaign',
      createdAt: campaign?.createdAt ?? new Date().toISOString(),
      interval: 15000,
    }
  );

  // Slow-poll discovery of which battle map is currently live to players
  // (see useActiveBattleMapId) — only used to pick the poke room below.
  const activeBattleMapId = useActiveBattleMapId(campaignCode);

  // A poke burst (one per party member autosave) must not fan out into an
  // uncoalesced fetch of the heaviest campaign endpoint per poke — debounce
  // to a single leading + trailing refresh per window.
  const refreshPlayersDebounced = useDebouncedRefetch(refreshPlayers);

  // Best-effort relay listener: a 'players' poke shaves latency off the
  // next player-HP refresh instead of waiting on the 15s poll. 'initiative'
  // pokes are ignored — EncounterView authors initiative, it doesn't
  // consume it.
  useBattleMapPokes({
    campaignCode,
    battleMapId: activeBattleMapId,
    tokenRequest: dmId ? { role: 'dm', dmId } : null,
    onPoke: feature => handleEncounterPoke(feature, refreshPlayersDebounced),
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

    applyPlayersToEncounter(encounterId, campaignPlayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignPlayers]);

  const actions = useMemo<EntityActions | undefined>(
    () =>
      encounter
        ? buildEntityActions({
            encounterId,
            encounter,
            store: {
              updateEntity,
              removeEntity,
              damageEntity,
              healEntity,
              addTempHp,
              setEntityHp,
              addCondition,
              removeCondition,
              setConditionRounds,
              useAbility: expendAbility,
              restoreAbility,
              useLegendaryAction: expendLegendaryAction,
              resetLegendaryActions,
              setConcentration,
              useLairAction: expendLairAction,
              setInitiative,
              longRestEntity,
            },
            syncPlayerEffects,
            onViewPlayer: playerCharacterId => {
              const player = campaignPlayers.find(
                p => p.playerId === playerCharacterId
              );
              if (player) setViewingPlayer(player);
            },
            onViewNPC: (npcSourceId, entityId) => {
              const npc = npcs.find(n => n.id === npcSourceId);
              if (npc) {
                setViewingNpcFromEncounter(npc);
                setViewingNpcEntityId(entityId);
              }
            },
            onChangePlayerColor: (playerCharacterId, color) =>
              setPlayerColor(campaignCode, playerCharacterId, color),
            onAdjustCounter: (playerId, delta) =>
              adjustPlayerCounter(campaignCode, playerId, delta),
          })
        : undefined,
    [
      encounter,
      encounterId,
      campaignPlayers,
      npcs,
      campaignCode,
      syncPlayerEffects,
      updateEntity,
      removeEntity,
      damageEntity,
      healEntity,
      addTempHp,
      setEntityHp,
      addCondition,
      removeCondition,
      setConditionRounds,
      expendAbility,
      restoreAbility,
      expendLegendaryAction,
      resetLegendaryActions,
      setConcentration,
      expendLairAction,
      setInitiative,
      longRestEntity,
      setPlayerColor,
      adjustPlayerCounter,
    ]
  );

  const waitingNames = encounter?.pendingInitiativeRequest
    ? encounter.entities
        .filter(
          e =>
            e.type === 'player' && e.initiative === null && e.playerCharacterId
        )
        .map(e => e.name)
    : [];

  const handleRequestPlayerRolls = useCallback(() => {
    if (!encounter || !encounter.campaignCode) return;
    const req = {
      requestId: crypto.randomUUID(),
      encounterId: encounter.id,
      encounterName: encounter.name,
      requestedAt: Date.now(),
    };
    setPendingInitiativeRequest(encounter.id, {
      requestId: req.requestId,
      requestedAt: req.requestedAt,
    });
    void pushInitiativeRequest(req);
  }, [encounter, pushInitiativeRequest, setPendingInitiativeRequest]);

  const handleStartCombat = useCallback(() => {
    if (encounter?.pendingInitiativeRequest) {
      setPendingInitiativeRequest(encounterId, null);
      void pushInitiativeRequest(null);
      void fetch(`/api/campaign/${campaignCode}/initiative-submission`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    startCombat(encounterId);
    pushLinkedMapLive(getBattleMaps(campaignCode), encounterId, pushActive);
  }, [
    encounter?.pendingInitiativeRequest,
    encounterId,
    campaignCode,
    pushInitiativeRequest,
    setPendingInitiativeRequest,
    startCombat,
    getBattleMaps,
    pushActive,
  ]);

  if (!encounter || !actions) {
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

  return (
    <div className="flex h-full flex-col">
      <CombatScreen
        encounter={encounter}
        playerSyncMap={playerSyncMap}
        customCounterLabel={campaign?.customCounterLabel}
        playerCounterValues={campaign?.playerCounters}
        actions={actions}
        onStartCombat={handleStartCombat}
        onEndCombat={() => endCombat(encounterId)}
        onNextTurn={() => nextTurn(encounterId)}
        onPrevTurn={() => prevTurn(encounterId)}
        onRollAllInitiatives={() => rollAllInitiatives(encounterId)}
        onRequestPlayerRolls={handleRequestPlayerRolls}
        requestActive={!!encounter.pendingInitiativeRequest}
        waitingNames={waitingNames}
        canRequestRolls={!!encounter.campaignCode}
        onRename={name => updateEncounter(encounterId, { name })}
        onOpenAdd={() => setAddDialogOpen(true)}
        onOpenConfig={() => setConfigOpen(true)}
        backHref={`/dm/campaign/${campaignCode}/encounters`}
        mapAction={
          <EncounterBattleMapButton
            campaignCode={campaignCode}
            encounterId={encounterId}
          />
        }
      />

      {/* Add combatant dialog */}
      <AddCombatantDialog
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

      {/* Combat config dialog */}
      <CombatConfigDialog open={configOpen} onOpenChange={setConfigOpen} />

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

      {/* NPC detail dialog (from encounter entity) */}
      {viewingNpcFromEncounter && (
        <NPCDetailDialog
          npc={
            getNPC(
              viewingNpcFromEncounter.campaignCode,
              viewingNpcFromEncounter.id
            ) ?? viewingNpcFromEncounter
          }
          open={!!viewingNpcFromEncounter}
          onOpenChange={open => {
            if (!open) {
              setViewingNpcFromEncounter(null);
              setViewingNpcEntityId(null);
            }
          }}
          readOnly
          encounterId={encounterId}
          npcEntityId={viewingNpcEntityId ?? undefined}
        />
      )}
    </div>
  );
}
