'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Viewport } from '@fieldnotes/core';

import { DmBattleMapCanvas } from '@/components/ui/campaign/dm-vtt/DmBattleMapCanvas';
import type { DmTokenConfig } from '@/components/ui/campaign/dm-vtt/combatantToken';
import { PlacementBanner } from '@/components/ui/campaign/dm-vtt/PlacementBanner';
import {
  TokenPlacementController,
  type PendingTokenPlacement,
} from '@/components/ui/campaign/dm-vtt/TokenPlacementController';
import { Button } from '@/components/ui/forms/button';
import { TableAuthorityStatus } from '@/components/ui/campaign/table/TableAuthorityStatus';
import { TableCombatPanel } from '@/components/ui/campaign/table/combat/TableCombatPanel';
import { TableRosterPanel } from '@/components/ui/campaign/table/TableRosterPanel';
import { createTableRosterCanvas } from '@/components/ui/campaign/table/tableRosterCanvas';
import { useAuthenticatedTableWorkspace } from '@/components/ui/campaign/table/useAuthenticatedTableWorkspace';
import { useTableSceneAuthority } from '@/components/ui/campaign/table/useTableSceneAuthority';
import type { BattleMapConnection } from '@/lib/battlemapSync';
import {
  restoreAuthorityFork,
  saveSceneCheckpoint,
} from '@/lib/table/checkpoint';
import {
  createTableSceneAdapter,
  isTableWorkspaceBoundToCampaign,
  type TableSceneAdapter,
} from '@/lib/table/sceneAdapter';
import { useDmStore } from '@/store/dmStore';

export default function TableScenePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignCode = params.code as string;
  const sceneId = params.sceneId as string;
  const selectedWorkspaceId = searchParams.get('tableWorkspace');
  const requestedRunId = searchParams.get('run');
  const battleMapsHref = `/dm/campaign/${campaignCode}/battlemaps${selectedWorkspaceId ? `?tableWorkspace=${encodeURIComponent(selectedWorkspaceId)}` : ''}`;
  const dmId = useDmStore(state => state.dmId);
  const tokenConfigRef = useRef<DmTokenConfig | null>(null);
  const {
    repository: openedRepository,
    loading,
    error,
  } = useAuthenticatedTableWorkspace({
    sourceCampaignCode: campaignCode,
    localWorkspaceId: selectedWorkspaceId,
  });
  const routeRejected = Boolean(
    selectedWorkspaceId &&
      openedRepository &&
      !isTableWorkspaceBoundToCampaign(
        openedRepository.workspaceSelection,
        campaignCode
      )
  );
  const repository = routeRejected ? null : openedRepository;
  const [adapter, setAdapter] = useState<TableSceneAdapter | null>(null);
  const [connection, setConnection] = useState<BattleMapConnection | null>(
    null
  );
  const [relayStatus, setRelayStatus] = useState('connecting');
  const [saveMessage, setSaveMessage] = useState('Local scene loading…');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [, refresh] = useState(0);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [pendingPlacement, setPendingPlacement] =
    useState<PendingTokenPlacement | null>(null);
  const cancelPlacement = useCallback(() => setPendingPlacement(null), []);
  // Roster canvas operations follow committed roster commands and travel the
  // v1 room as ordinary DM edits (placement, control conversion, bands).
  const rosterCanvas = useMemo(
    () =>
      viewport
        ? createTableRosterCanvas({
            viewport,
            connection,
            onArm: setPendingPlacement,
          })
        : null,
    [viewport, connection]
  );

  useEffect(() => {
    setAdapter(null);
    setConnection(null);
    if (!repository) return;
    const activeAdapter = createTableSceneAdapter({
      repository,
      sceneId,
      campaignCode,
    });
    setAdapter(activeAdapter);
    setSaveMessage(
      activeAdapter.getBattleMap()
        ? 'Local scene ready'
        : 'Scene not found in this local workspace'
    );
    const unsubscribe = activeAdapter.subscribe(() =>
      refresh(value => value + 1)
    );
    return () => {
      unsubscribe();
      activeAdapter.dispose();
    };
  }, [campaignCode, repository, sceneId]);

  const workspaceCurrent = repository?.getCurrent();
  const storedScene =
    workspaceCurrent?.status === 'ready'
      ? workspaceCurrent.snapshot.scenes.find(
          value => value.sceneId === sceneId
        )
      : undefined;

  // Live control (D8/R2-3): the first outcome gates canvas mounting (its
  // token request must not race private preparation, C3-7); afterwards the
  // canvas and combat stay mounted regardless of control.
  const authority = useTableSceneAuthority({
    repository,
    adapter,
    campaignCode,
    dmId,
    sceneId,
  });
  // After an explicit acquire the canvas reconnects through a fresh mount
  // (re-mints its token) when it is not live.
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const relayLive = relayStatus === 'live';
  const lastExplicit = useRef(0);
  useEffect(() => {
    if (authority.explicitAcquired === lastExplicit.current) return;
    lastExplicit.current = authority.explicitAcquired;
    if (!relayLive) setCanvasEpoch(value => value + 1);
  }, [authority.explicitAcquired, relayLive]);

  const handleConnectionReady = useCallback(
    (next: BattleMapConnection | null) => setConnection(next),
    []
  );

  async function saveCheckpoint() {
    if (!repository || !adapter || !connection) {
      setSaveMessage(
        'Relay is not ready. The local draft remains saved on this device.'
      );
      return;
    }
    await adapter.flush();
    const current = await repository.reload();
    if (current.status !== 'ready') {
      setSaveMessage('Table storage is unavailable; checkpoint not committed.');
      return;
    }
    const startGeneration = adapter.getLocalEditGeneration();
    setSaveMessage('Waiting for explicit relay receipts…');
    const result = await saveSceneCheckpoint({
      repository,
      connection,
      sceneId,
      expectedRevision: current.snapshot.campaign?.revision ?? 0,
      operationId: `checkpoint:${sceneId}:${crypto.randomUUID()}`,
      hasNewLocalEditsSinceBarrier: () =>
        adapter.getLocalEditGeneration() > startGeneration,
    });
    setSaveMessage(
      result.status === 'committed'
        ? result.pending
          ? 'Authoritative checkpoint committed; a newer local edit is still pending.'
          : 'Authoritative checkpoint committed locally.'
        : result.status === 'not-saved'
          ? `Checkpoint not committed (${result.reason}); the local draft remains pending.`
          : `Checkpoint not committed (${result.status}); the previous checkpoint is unchanged.`
    );
  }

  async function restore(
    checkpoint: NonNullable<typeof storedScene>['canvasCheckpoint'],
    label: string
  ) {
    if (!checkpoint) return;
    setRecoveryBusy(true);
    setSaveMessage(`${label} is being guarded by the current generation…`);
    const result = await restoreAuthorityFork({
      campaignCode,
      dmId,
      sceneId,
      checkpoint,
    });
    setRecoveryBusy(false);
    setSaveMessage(
      result.status === 'restored'
        ? `${label} restored to live authority.`
        : result.status === 'conflict'
          ? `${label} was not restored because live authority changed. Review the current scene and retry deliberately.`
          : `${label} failed (${result.reason}); live authority and local data are unchanged.`
    );
  }

  async function reconcilePendingEdit(action: 'refresh' | 'retry' | 'discard') {
    if (!adapter) return;
    if (action === 'discard') {
      adapter.discardPendingConflict();
      setSaveMessage(
        'Pending conflicted edit discarded. The winning scene remains unchanged.'
      );
      return;
    }
    if (action === 'refresh') {
      const refreshed = await adapter.refreshPendingConflict();
      setSaveMessage(
        refreshed
          ? 'Winning scene refreshed. The conflicted edit is still pending for deliberate retry or discard.'
          : 'The winning scene could not be refreshed; the conflicted edit remains pending.'
      );
      return;
    }
    const result = await adapter.retryPendingConflict();
    setSaveMessage(
      result === 'committed'
        ? 'Pending edit deliberately reapplied to the latest scene without replacing unrelated winner fields.'
        : result === 'conflict'
          ? 'The scene changed again. The edit remains pending and was not replayed.'
          : result === 'none'
            ? 'There is no pending conflicted edit.'
            : 'The pending edit could not be applied and remains available.'
    );
  }

  const scene = adapter?.getBattleMap();
  const pendingConflict = adapter?.getPendingConflict() ?? null;
  if (!scene || !adapter || !repository) {
    return (
      <main className="bg-surface flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-heading text-lg font-semibold">
          {routeRejected
            ? 'This imported Table workspace is not bound to this campaign route. No private authority request was sent.'
            : (error ?? (loading ? 'Local scene loading…' : saveMessage))}
        </p>
        <Link href={battleMapsHref}>
          <Button variant="ghost">Back to Battle Maps</Button>
        </Link>
      </main>
    );
  }

  if (!authority.firstOutcome) {
    return (
      <main className="bg-surface flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-heading text-lg font-semibold">
          Registering scene and preparing private authority…
        </p>
      </main>
    );
  }

  return (
    <DmBattleMapCanvas
      key={`canvas-${canvasEpoch}`}
      campaignCode={campaignCode}
      battleMapId={sceneId}
      dmId={dmId}
      tableSceneAdapter={adapter}
      onConnectionReady={handleConnectionReady}
      onStatus={setRelayStatus}
      tokenConfigRef={tokenConfigRef}
      onViewportReady={setViewport}
      tokenInfoToggle={{ mode: null, onCycle: () => {} }}
      onExportError={message => setSaveMessage(message)}
      sessionControls={
        <div className="border-divider bg-surface-secondary pointer-events-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-lg border p-3 shadow-lg">
          <Link href={battleMapsHref}>
            <Button variant="ghost" size="sm">
              Battle Maps
            </Button>
          </Link>
          <div className="min-w-[min(100%,16rem)] flex-1">
            <p className="text-heading truncate text-sm font-semibold">
              {scene.name}
            </p>
            <p className="text-muted text-xs">
              Relay: {relayStatus} · local operations:{' '}
              {storedScene?.localDraft ? 'pending' : 'none'}
            </p>
            <p className="text-muted text-xs">
              Local draft: {storedScene?.localDraft ? 'saved' : 'none'} ·
              authoritative checkpoint:{' '}
              {storedScene?.canvasCheckpoint
                ? storedScene.canvasCheckpoint.generation.startsWith(
                    'adoption:'
                  )
                  ? 'not yet committed (local adoption snapshot available)'
                  : 'committed locally'
                : 'none'}
            </p>
            <p className="text-muted text-xs">{saveMessage}</p>
          </div>
          <TableAuthorityStatus
            state={authority.state}
            waitSeconds={authority.waitSeconds}
            clearedNotice={authority.explicitAcquired > 0}
            onAcquire={authority.acquire}
            onWorkOffline={authority.workOffline}
          />
          {pendingConflict && (
            <div
              className="border-accent-orange-text w-full rounded border p-2"
              role="alert"
            >
              <p className="text-accent-orange-text text-xs">
                A local edit conflicted with a newer scene and was not replayed.
                Pending fields: {pendingConflict.fields.join(', ')}. Review the
                winner, then retry deliberately or discard this edit.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void reconcilePendingEdit('refresh')}
                >
                  Refresh winner
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void reconcilePendingEdit('retry')}
                >
                  Retry pending edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void reconcilePendingEdit('discard')}
                >
                  Discard pending edit
                </Button>
              </div>
            </div>
          )}
          {storedScene?.localDraft && (
            <Button
              variant="ghost"
              size="sm"
              disabled={recoveryBusy}
              onClick={() =>
                void restore(storedScene.localDraft ?? null, 'Local draft')
              }
            >
              Reapply local draft
            </Button>
          )}
          {storedScene?.canvasCheckpoint && (
            <Button
              variant="ghost"
              size="sm"
              disabled={recoveryBusy}
              onClick={() =>
                void restore(storedScene.canvasCheckpoint, 'Saved checkpoint')
              }
            >
              Restore saved checkpoint
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => void saveCheckpoint()}
          >
            Save checkpoint
          </Button>
        </div>
      }
    >
      <TokenPlacementController
        pending={pendingPlacement}
        configRef={tokenConfigRef}
        onCancel={cancelPlacement}
      />
      {pendingPlacement && (
        <PlacementBanner
          entityName={pendingPlacement.entityName}
          onCancel={cancelPlacement}
        />
      )}
      <TableRosterPanel
        repository={repository}
        sceneId={sceneId}
        campaignCode={campaignCode}
        dmId={dmId}
        canvas={rosterCanvas}
        live={relayStatus === 'live'}
      />
      <TableCombatPanel
        repository={repository}
        sceneId={sceneId}
        campaignCode={campaignCode}
        dmId={dmId}
        controlSession={authority.session}
        controlEpoch={authority.controlEpoch}
        liveUnavailable={
          (authority.state.phase === 'failed' ||
            authority.state.phase === 'lost') &&
          authority.state.reason === 'live-unavailable'
        }
        requestedRunId={requestedRunId}
      />
    </DmBattleMapCanvas>
  );
}
