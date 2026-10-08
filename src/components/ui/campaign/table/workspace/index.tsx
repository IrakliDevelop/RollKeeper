'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/forms/button';

import { TableCombatPanel } from '../combat/TableCombatPanel';
import {
  createTablePlayersCache,
  TablePlayersCacheProvider,
} from '../useTablePlayersSnapshot';
import { TableCreateSceneDialog } from './TableCreateSceneDialog';
import { TablePrepareEncounter } from './TablePrepareEncounter';
import { TableSceneBrowser, TableScenesToggle } from './TableSceneBrowser';
import { TableSceneStage } from './TableSceneStage';
import { SCENE_UNAVAILABLE, useTableWorkspace } from './TableWorkspace.hooks';
import { TableWorkspaceHeader } from './TableWorkspaceHeader';
import { switchNoticeText } from './useTableSceneSwitch';

const NOT_BOUND =
  'This imported Table workspace is not bound to this campaign route. No private authority request was sent.';

/**
 * PR06 unified Table workspace (W1–W4): one page per campaign, one control
 * session, one presentation/display poll and one combat publisher; the
 * selected scene's canvas, roster and combat panel are keyed by scene.
 * Selecting a scene is private preparation only — nothing here presents.
 */
export function TableWorkspace({ campaignCode }: { campaignCode: string }) {
  const workspace = useTableWorkspace(campaignCode);
  /** The scene whose canvas is on screen (gate applies to new scenes only). */
  const shownScene = useRef<string | null>(null);
  const [playersCache] = useState(createTablePlayersCache);
  const { authority, switcher, mountedScene, repository, current, checkpoint } =
    workspace;

  useShownScene(workspace, shownScene);

  if (!repository || current?.status !== 'ready') {
    const text = workspace.routeRejected
      ? NOT_BOUND
      : (workspace.opened.error ??
        (current?.status === 'read-only'
          ? 'This Table data uses an unsupported format. It is read-only; raw export remains available on Battle Maps.'
          : current?.status === 'unavailable'
            ? 'Table storage is unavailable on this device.'
            : 'Local scenes loading…'));
    return (
      <main className="bg-surface flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-heading text-lg font-semibold" role="status">
          {text}
        </p>
        <Link href={`/dm/campaign/${encodeURIComponent(campaignCode)}`}>
          <Button variant="ghost">Back to campaign</Button>
        </Link>
      </main>
    );
  }

  const notices = [
    ...(workspace.sceneUnavailable
      ? [
          {
            id: 'unavailable',
            text: SCENE_UNAVAILABLE,
            tone: 'status' as const,
          },
        ]
      : []),
    ...(switcher.notice
      ? [
          {
            id: 'switch',
            text: switchNoticeText(switcher.notice),
            tone: 'alert' as const,
          },
        ]
      : []),
    ...(authority.room.message &&
    authority.room.sceneId === mountedScene?.sceneId
      ? [{ id: 'room', text: authority.room.message, tone: 'status' as const }]
      : []),
  ];
  const adapter = switcher.adapter;
  const header = (
    <TableWorkspaceHeader
      campaignCode={campaignCode}
      leading={
        <TableScenesToggle
          open={workspace.browser.open}
          onToggle={workspace.browser.toggle}
        />
      }
      authority={authority}
      clearedNotice={workspace.clearedNotice}
      presentationProps={workspace.presentationProps}
      presentation={workspace.presentation}
      notices={notices}
      extra={
        workspace.query.prepareEncounter ? (
          <TablePrepareEncounter
            encounterId={workspace.query.prepareEncounter}
            campaignCode={campaignCode}
            repository={repository}
            scene={mountedScene}
            navigate={workspace.navigate}
          />
        ) : null
      }
      scene={
        mountedScene && adapter
          ? {
              name: mountedScene.map.name,
              stored: mountedScene,
              relayStatus: workspace.relayStatus,
              checkpoint,
              pendingConflict: adapter.getPendingConflict(),
            }
          : undefined
      }
    />
  );

  // C3-7 initial gate; R3-F6 per-scene "Registering scene…" gate (canvas
  // only — presentation and display controls stay mounted in the header).
  // A canvas already on screen stays mounted while an explicit acquire
  // registers; it re-mints once afterwards (C6-2).
  const gate = !authority.firstOutcome
    ? 'Registering scene and preparing private authority…'
    : authority.room.status === 'registering' &&
        shownScene.current !== mountedScene?.sceneId
      ? 'Registering scene…'
      : null;
  const stage =
    mountedScene && adapter && !gate ? (
      <TablePlayersCacheProvider value={playersCache}>
        <TableSceneStage
          key={`${mountedScene.sceneId}:${workspace.canvasEpoch}`}
          campaignCode={campaignCode}
          dmId={workspace.dmId}
          sceneId={mountedScene.sceneId}
          repository={repository}
          adapter={adapter}
          header={header}
          relayStatus={workspace.relayStatus}
          relayLive={workspace.relayLive}
          presentedHere={workspace.presentedHere}
          connection={workspace.connection}
          onViewportReady={workspace.onViewportReady}
          onConnectionReady={workspace.setConnection}
          onStatus={workspace.onStatus}
          onMessage={checkpoint.setSaveMessage}
          onEditBusy={workspace.onEditBusy}
        />
        {/* Outside the keyed canvas: an explicit acquire remounts the canvas
          only, so open dialogs and the command queue survive (F6). */}
        <TableCombatPanel
          key={mountedScene.sceneId}
          repository={repository}
          sceneId={mountedScene.sceneId}
          campaignCode={campaignCode}
          dmId={workspace.dmId}
          controlSession={authority.session}
          controlEpoch={authority.controlEpoch}
          liveUnavailable={
            (authority.state.phase === 'failed' ||
              authority.state.phase === 'lost') &&
            authority.state.reason === 'live-unavailable'
          }
          requestedRunId={workspace.requestedRunId}
          tableWorkspaceId={workspace.query.tableWorkspace}
          presentation={authority.descriptor?.presentation ?? null}
          publication={workspace.combat.publication}
          onCombatBridge={workspace.combat.onCombatBridge}
        />
      </TablePlayersCacheProvider>
    ) : null;

  return (
    <>
      {stage ?? (
        <WorkspaceShell header={header}>
          <p className="text-muted text-sm" role="status">
            {gate ??
              (switcher.switching
                ? 'Switching scene…'
                : 'Choose a scene to prepare. Selecting a scene never changes what players see.')}
          </p>
        </WorkspaceShell>
      )}
      <TableSceneBrowser
        open={workspace.browser.open}
        onClose={() => workspace.browser.setOpen(false)}
        scenes={workspace.scenes}
        selectedSceneId={mountedScene?.sceneId ?? null}
        presentation={workspace.presented}
        onSelect={workspace.selectScene}
        onCreate={() => workspace.browser.setCreating(true)}
        adoptable={workspace.browser.adoptable}
        onAdopt={mapId => void workspace.browser.adopt(mapId)}
        busy={workspace.browser.busy}
        status={workspace.browser.status}
        battleMapsHref={`/dm/campaign/${encodeURIComponent(campaignCode)}/battlemaps${
          workspace.query.tableWorkspace
            ? `?tableWorkspace=${encodeURIComponent(workspace.query.tableWorkspace)}`
            : ''
        }`}
      />
      <TableCreateSceneDialog
        open={workspace.browser.creating}
        onOpenChange={workspace.browser.setCreating}
        repository={repository}
        onCreated={sceneId => {
          workspace.browser.setCreating(false);
          workspace.selectScene(sceneId);
        }}
      />
      {stage && switcher.switching && (
        <div
          role="status"
          className="bg-surface/70 text-heading fixed inset-0 z-50 flex items-center justify-center text-sm font-semibold"
        >
          Switching scene…
        </div>
      )}
    </>
  );
}

/** Records which scene's canvas was last committed to the screen. */
function useShownScene(
  workspace: ReturnType<typeof useTableWorkspace>,
  shownScene: { current: string | null }
): void {
  const sceneId =
    workspace.switcher.adapter && workspace.authority.firstOutcome
      ? (workspace.mountedScene?.sceneId ?? null)
      : null;
  const registering = workspace.authority.room.status === 'registering';
  useEffect(() => {
    if (sceneId === null) shownScene.current = null;
    else if (!registering || shownScene.current === sceneId)
      shownScene.current = sceneId;
  }, [registering, sceneId, shownScene]);
}

function WorkspaceShell(props: { header: ReactNode; children: ReactNode }) {
  return (
    <main className="bg-surface flex min-h-screen flex-col">
      <div className="border-divider border-b">{props.header}</div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        {props.children}
      </div>
    </main>
  );
}
