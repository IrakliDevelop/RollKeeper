'use client';

import { useEffect, useMemo, useState } from 'react';

import { StudioPanel } from '@/components/ui/campaign/dm-vtt/StudioPanel';
import { TurnControl } from '@/components/ui/campaign/dm-vtt/TurnControl';
import type { TableControlSession } from '@/lib/table/authorityLifecycle';
import type { TableCombatResult } from '@/lib/table/combat';
import type { PublicationStatus } from '@/lib/table/combatPublisher';
import type { TableRepository } from '@/lib/table/repository';
import type { CampaignPlayerData } from '@/types/campaign';

import { TableCombatHistoryDialog } from './TableCombatHistoryDialog';
import { TableCombatToolbar } from './TableCombatToolbar';
import { TableNewRunDialog } from './TableNewRunDialog';
import { TableParticipantDialog } from './TableParticipantDialog';
import { TableRunSetup } from './TableRunSetup';
import { publicationLabel } from './tableCombatMessages';
import { useTableCombat, type TableCombatIntent } from './useTableCombat';
import { useTableCombatPanelActions } from './useTableCombatPanelActions';
import { useTableCombatPublication } from './useTableCombatPublication';

const NO_LINK = null;

export interface TableCombatPublicationHandle {
  status: PublicationStatus;
  publishCurrentState: () => Promise<void>;
}

/** What the workspace publisher needs from the mounted scene panel. */
export interface TableCombatBridge {
  background: (intent: TableCombatIntent) => Promise<TableCombatResult>;
  playerData: CampaignPlayerData[] | undefined;
}

/**
 * Scene combat for the Table route (PR03): explicit run selection,
 * participant/initiative preparation, start/turns/end through the combat
 * command path, existing StudioPanel/CombatantDetail/TurnControl fed by the
 * repository read model, fenced publication status and local history.
 */
export function TableCombatPanel(props: {
  repository: TableRepository;
  sceneId: string;
  campaignCode: string;
  dmId: string;
  controlSession: TableControlSession | null;
  /** Increments on every successful (re)acquire (publication hold). */
  controlEpoch: number;
  liveUnavailable: boolean;
  requestedRunId: string | null;
  /** Imported-workspace route selection (kept in cross-scene links). */
  tableWorkspaceId?: string | null;
  /** Reports publication status (the page clears its acquire banner). */
  onPublicationStatus?: (status: PublicationStatus) => void;
  /** Server-acknowledged audience presentation (combined Show + Start). */
  presentation?: { sceneId: string | null; blanked: boolean } | null;
  /**
   * PR06 W4: the workspace's one publication (no per-scene publisher, no
   * hold on scene switch). Absent: this panel owns a publisher (PR03).
   */
  publication?: TableCombatPublicationHandle;
  /** Feeds the workspace publisher this scene's queue and player data. */
  onCombatBridge?: (bridge: TableCombatBridge | null) => void;
}) {
  const combat = useTableCombat(props);
  const owned = useTableCombatPublication({
    repository: props.repository,
    enabled: props.publication === undefined,
    controlSession: props.controlSession,
    controlEpoch: props.controlEpoch,
    tick: combat.tick,
    playerData: combat.playerData,
    background: combat.background,
  });
  const publication = props.publication ?? owned;
  const { onCombatBridge } = props;
  const { background, playerData } = combat;
  useEffect(() => {
    onCombatBridge?.({ background, playerData });
  }, [onCombatBridge, background, playerData]);
  useEffect(() => () => onCombatBridge?.(null), [onCombatBridge]);
  const panel = useTableCombatPanelActions({
    combat,
    sceneId: props.sceneId,
    campaignCode: props.campaignCode,
    tableWorkspaceId: props.tableWorkspaceId ?? null,
    controlSession: props.controlSession,
  });
  const { onPublicationStatus } = props;
  useEffect(() => {
    onPublicationStatus?.(publication.status);
  }, [publication.status, onPublicationStatus]);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<'initiative' | 'selected'>('initiative');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const { model, running, selectedRun } = combat;
  const capabilityByEntity = useMemo(
    () => new Map(panel.capabilities.map(item => [item.entityId, item.caps])),
    [panel.capabilities]
  );
  const canPublish =
    !props.liveUnavailable &&
    props.controlSession !== null &&
    !props.controlSession.isLost() &&
    ['cleared', 'not-broadcasting', 'stale', 'blocked'].includes(
      publication.status.kind
    );
  // P8: holder only, while this route scene is not the shown unblanked one.
  const offerShowAndStart =
    !props.liveUnavailable &&
    props.controlSession !== null &&
    !props.controlSession.isLost() &&
    props.presentation != null &&
    !(
      props.presentation.sceneId === props.sceneId &&
      !props.presentation.blanked
    );
  const activeName =
    model && model.encounter.currentTurn >= 0
      ? (model.encounter.entities[model.encounter.currentTurn]?.name ?? '—')
      : '—';

  return (
    <>
      <StudioPanel
        encounter={model?.encounter ?? null}
        selectedEntityId={selectedEntityId}
        onSelectEntity={entityId => {
          setSelectedEntityId(entityId);
          setTab('selected');
        }}
        actions={panel.entityActions}
        activeTab={tab}
        onTabChange={setTab}
        encounterHref=""
        encounterLink={NO_LINK}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(value => !value)}
        toolbar={
          <TableCombatToolbar
            campaignCode={props.campaignCode}
            runs={combat.runs}
            selectedRun={selectedRun}
            activeRunId={combat.campaign?.activeRunId ?? null}
            running={running}
            loggingPaused={panel.loggingPaused}
            publicationLabel={publicationLabel(
              publication.status,
              props.liveUnavailable
            )}
            publishedRun={panel.activeSummary}
            playersStale={
              combat.players.snapshot.status === 'ready' &&
              combat.players.snapshot.stale
            }
            playerNotices={panel.playerNotices}
            canPublish={canPublish}
            saving={combat.saving}
            notice={combat.notice}
            onSelect={panel.selectRun}
            onNewRun={panel.openNewRun}
            onHistory={() => panel.setHistoryOpen(true)}
            onEnd={panel.end}
            onPublish={() => void publication.publishCurrentState()}
          />
        }
        emptyContent={
          <p className="text-muted px-3 py-4 text-xs">
            Create or choose a scene run. Runs are saved on this device.
          </p>
        }
        inactiveContent={
          model ? (
            <TableRunSetup
              model={model}
              bystanders={panel.bystanders}
              activeElsewhere={panel.activeElsewhere}
              missingPrompt={panel.missingPrompt}
              busy={combat.saving}
              onChooseParticipants={panel.openParticipants}
              onInitiative={panel.setInitiative}
              onHidden={panel.setHidden}
              onStart={panel.start}
              onShowAndStart={
                offerShowAndStart ? panel.showAndStart : undefined
              }
              onResetImported={panel.end}
              onGoToActive={panel.goToActive}
            />
          ) : undefined
        }
        detailCapabilities={entity => capabilityByEntity.get(entity.id)}
        hpUnknownEntityIds={panel.hpUnknownEntityIds}
        // Fits a 390px viewport; header, toolbar and setup scroll as one.
        widthClassName="w-[min(390px,calc(100vw-1rem))]"
        scrollToolbar
      />
      {running && model && (
        <TurnControl
          round={model.encounter.round}
          activeName={activeName}
          onNext={panel.nextTurn}
          onPrev={panel.prevTurn}
        />
      )}
      <TableNewRunDialog
        key={`new-run-${panel.newRunKey}`}
        open={panel.newRunOpen}
        onOpenChange={panel.setNewRunOpen}
        defaultLabel={`Scene run ${combat.runs.length + 1}`}
        busy={combat.saving}
        onCreate={panel.createRun}
      />
      <TableParticipantDialog
        key={`participants-${panel.participantsKey}`}
        open={panel.participantsOpen}
        onOpenChange={panel.setParticipantsOpen}
        options={panel.participantOptions}
        selected={selectedRun?.participants.map(p => p.actorId) ?? []}
        busy={combat.saving}
        onSave={panel.saveParticipants}
      />
      <TableCombatHistoryDialog
        open={panel.historyOpen}
        onOpenChange={panel.setHistoryOpen}
        snapshot={combat.snapshot}
        busy={combat.saving}
        onDelete={panel.deleteArchive}
      />
    </>
  );
}
