'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  applyCameraView,
  captureCameraView,
  type CameraView,
  type Viewport,
} from '@fieldnotes/core';

import type { BattleMapConnection } from '@/lib/battlemapSync';
import type { TableSceneRoomInput } from '@/lib/table/authorityLifecycle';
import { sceneCheckpointToViewportState } from '@/lib/table/checkpoint';
import { isTableWorkspaceBoundToCampaign } from '@/lib/table/sceneAdapter';
import type { TableSceneRecordV1 } from '@/lib/table/schema';
import { useDmStore } from '@/store/dmStore';

import { isUsableView } from '../display/tableDisplayController';
import { useTablePresentationPanel } from '../presentation';
import type { TablePresentationControlsProps } from '../presentation/TablePresentationControls.types';
import { useAuthenticatedTableWorkspace } from '../useAuthenticatedTableWorkspace';
import {
  parseTableWorkspaceQuery,
  tableWorkspaceHref,
  type TableWorkspaceQuery,
} from './tableWorkspaceRoutes';
import { useSceneCheckpointActions } from './useSceneCheckpointActions';
import { useTableSceneSwitch } from './useTableSceneSwitch';
import { useTableWorkspaceAuthority } from './useTableWorkspaceAuthority';
import { useWorkspaceCombatPublication } from './useWorkspaceCombatPublication';
import { useWorkspaceSceneBrowser } from './useWorkspaceSceneBrowser';

export const SCENE_UNAVAILABLE =
  'That scene is not available in this workspace';

type ViewportCamera = Pick<
  Viewport,
  'camera' | 'getVisibleRect' | 'getCanvasSize' | 'requestRender'
>;

/** Non-tombstoned workspace scenes, sorted by name (W5). */
export function liveScenesOf(
  snapshot: {
    scenes: readonly TableSceneRecordV1[];
    tombstones: readonly { kind: string; id: string }[];
  } | null
): TableSceneRecordV1[] {
  if (!snapshot) return [];
  const deleted = new Set(
    snapshot.tombstones
      .filter(tombstone => tombstone.kind === 'scene')
      .map(tombstone => tombstone.id)
  );
  return snapshot.scenes
    .filter(scene => !deleted.has(scene.sceneId))
    .sort(
      (left, right) =>
        left.map.name.localeCompare(right.map.name) ||
        left.sceneId.localeCompare(right.sceneId)
    );
}

/**
 * All workspace-level state of the unified Table (W1–W4): query-driven
 * selection, the repository, the one control session, the scene switch
 * machine, camera memory, presentation (one display-status poll) and the
 * one combat publisher. Nothing here is keyed by scene.
 */
export function useTableWorkspace(campaignCode: string) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const query = useMemo(
    () => parseTableWorkspaceQuery(new URLSearchParams(search)),
    [search]
  );
  const dmId = useDmStore(state => state.dmId);
  const selectedWorkspaceId = query.tableWorkspace;
  const opened = useAuthenticatedTableWorkspace({
    sourceCampaignCode: campaignCode,
    localWorkspaceId: selectedWorkspaceId,
  });
  // An explicit workspace selection that does not open or is bound to
  // another campaign is refused — never the default workspace (R3-F12).
  const routeRejected = Boolean(
    selectedWorkspaceId &&
      (opened.error ||
        (opened.repository &&
          !isTableWorkspaceBoundToCampaign(
            opened.repository.workspaceSelection,
            campaignCode
          )))
  );
  const repository = routeRejected ? null : opened.repository;
  const current = repository?.getCurrent() ?? null;
  const snapshot = current?.status === 'ready' ? current.snapshot : null;
  const revision = opened.revision;
  const scenes = useMemo(
    () => liveScenesOf(snapshot),
    // `revision`: the repository reloads in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, revision]
  );
  const requestedScene = query.scene
    ? scenes.find(scene => scene.sceneId === query.scene)
    : undefined;
  const sceneUnavailable =
    (query.scene !== null || query.sceneInvalid === true) &&
    snapshot !== null &&
    !requestedScene;

  const navigate = useCallback(
    (mode: 'push' | 'replace', next: Partial<TableWorkspaceQuery>) => {
      const href = tableWorkspaceHref(campaignCode, {
        tableWorkspace: selectedWorkspaceId,
        ...next,
      });
      if (mode === 'push') router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [campaignCode, router, selectedWorkspaceId]
  );

  // ─── Viewport / connection / relay status of the mounted canvas ──────
  const [viewportState, setViewportState] = useState<{
    sceneId: string;
    viewport: ViewportCamera;
  } | null>(null);
  const [connection, setConnection] = useState<BattleMapConnection | null>(
    null
  );
  const [relay, setRelay] = useState<{ sceneId: string; status: string }>({
    sceneId: '',
    status: 'connecting',
  });
  const cameraMemory = useRef(new Map<string, CameraView>());

  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const sceneName = useCallback(
    (sceneId: string) =>
      scenesRef.current.find(scene => scene.sceneId === sceneId)?.map.name ??
      'this scene',
    []
  );
  const viewportRef = useRef(viewportState);
  viewportRef.current = viewportState;
  /** Review F9: Edit-map image work in flight on the mounted scene. */
  const editBusy = useRef(false);
  const onEditBusy = useCallback((busy: boolean) => {
    editBusy.current = busy;
  }, []);
  const switcher = useTableSceneSwitch({
    repository,
    campaignCode,
    requestedSceneId: requestedScene?.sceneId ?? null,
    sceneName,
    onRevert: sceneId =>
      navigate('replace', {
        scene: sceneId,
        prepareEncounter: query.prepareEncounter,
        panel: query.panel,
      }),
    // R3-F8: capture in the switch machine, before the canvas unmounts.
    onBeforeUnmount: sceneId => {
      const entry = viewportRef.current;
      if (!entry || entry.sceneId !== sceneId) return;
      try {
        const view = captureCameraView(entry.viewport);
        if (isUsableView(view)) cameraMemory.current.set(sceneId, view);
      } catch {
        // A destroyed viewport keeps the previously remembered view.
      }
    },
    isBusy: () => editBusy.current,
  });
  // Review F5: the workspace follows its adapter (conflict UI), and the
  // "Resolve … before switching" notice clears once the conflict is gone.
  const [adapterTick, onAdapter] = useReducer((value: number) => value + 1, 0);
  const mountedAdapter = switcher.adapter;
  useEffect(() => mountedAdapter?.subscribe(onAdapter), [mountedAdapter]);
  const { notice: switchNotice, clearNotice } = switcher;
  const conflictPending = mountedAdapter?.getPendingConflict() != null;
  useEffect(() => {
    if (switchNotice?.kind === 'conflict' && !conflictPending) clearNotice();
  }, [adapterTick, clearNotice, conflictPending, switchNotice]);
  const mountedSceneId = switcher.mountedSceneId;
  const mountedScene = scenes.find(scene => scene.sceneId === mountedSceneId);

  // ─── One control session (W3) ─────────────────────────────────────────
  const roomInput: TableSceneRoomInput | null =
    repository && mountedScene && snapshot
      ? {
          sceneId: mountedScene.sceneId,
          sourceMapId: mountedScene.originalMapId ?? mountedScene.sceneId,
          workspaceInstanceId:
            repository.workspaceSelection.workspace.localWorkspaceId,
          contentRevision: snapshot.campaign?.revision ?? 0,
          safeLabel: mountedScene.map.name,
          canvasState: mountedScene.canvasCheckpoint
            ? sceneCheckpointToViewportState(mountedScene.canvasCheckpoint)
            : {},
        }
      : null;
  const authority = useTableWorkspaceAuthority({
    repository,
    campaignCode,
    dmId,
    scene: roomInput,
  });

  // After an explicit acquire the canvas reconnects through a fresh mount
  // (re-mints its token) when it is not live — once A1b settled (C6-2).
  const relayStatus =
    relay.sceneId === mountedSceneId ? relay.status : 'connecting';
  const relayLive = relayStatus === 'live';
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const lastExplicit = useRef(0);
  useEffect(() => {
    if (authority.explicitAcquired === lastExplicit.current) return;
    lastExplicit.current = authority.explicitAcquired;
    if (!relayLive) setCanvasEpoch(value => value + 1);
  }, [authority.explicitAcquired, relayLive]);

  // ─── Camera memory (W4/R3-F8/C6-1): after load and after live ─────────
  const applied = useRef<{ viewport: unknown; phases: Set<string> }>({
    viewport: null,
    phases: new Set(),
  });
  useEffect(() => {
    const entry = viewportState;
    if (!entry || entry.sceneId !== mountedSceneId) return;
    const view = cameraMemory.current.get(entry.sceneId);
    if (!view || !isUsableView(view)) return;
    if (applied.current.viewport !== entry.viewport)
      applied.current = { viewport: entry.viewport, phases: new Set() };
    const phase = relayLive ? 'live' : 'load';
    if (applied.current.phases.has(phase)) return;
    applied.current.phases.add(phase);
    try {
      const size = entry.viewport.getCanvasSize();
      applyCameraView(entry.viewport.camera, view, size.w, size.h);
      entry.viewport.requestRender();
    } catch {
      // A zero or detached canvas keeps its own camera.
    }
  }, [mountedSceneId, relayLive, viewportState]);

  const onViewportReady = useCallback(
    (sceneId: string, viewport: ViewportCamera) =>
      setViewportState({ sceneId, viewport }),
    []
  );
  const onStatus = useCallback(
    (sceneId: string, status: string) => setRelay({ sceneId, status }),
    []
  );

  // ─── `run`: only a run of the mounted scene (else dropped, replace) ──
  const runInScene =
    query.run !== null &&
    snapshot !== null &&
    mountedSceneId !== null &&
    snapshot.encounters.some(
      run =>
        run.runId === query.run &&
        run.sceneId === mountedSceneId &&
        !snapshot.tombstones.some(
          tombstone =>
            tombstone.kind === 'encounter' && tombstone.id === run.runId
        )
    );
  const dropRun =
    query.run !== null &&
    snapshot !== null &&
    mountedSceneId !== null &&
    mountedSceneId === query.scene &&
    !runInScene;
  useEffect(() => {
    if (!dropRun) return;
    navigate('replace', {
      scene: query.scene,
      prepareEncounter: query.prepareEncounter,
      panel: query.panel,
    });
  }, [dropRun, navigate, query.panel, query.prepareEncounter, query.scene]);

  // ─── Presentation (one poll per page) and combat publication ─────────
  const presentationProps: TablePresentationControlsProps = {
    campaignCode,
    dmId,
    sceneId: mountedScene?.sceneId ?? null,
    sceneName: mountedScene?.map.name ?? '',
    authorityState: authority.state,
    session: authority.session,
    descriptor: authority.descriptor,
    canShow: authority.canShow && authority.room.sceneId === mountedSceneId,
    inactive: snapshot === null,
  };
  const presentation = useTablePresentationPanel(presentationProps);
  const combat = useWorkspaceCombatPublication({
    repository,
    controlSession: authority.session,
    controlEpoch: authority.controlEpoch,
    tick: revision,
  });
  // F5: "Public initiative cleared" until a publication outcome after
  // THAT explicit acquire.
  const explicitRef = useRef(authority.explicitAcquired);
  explicitRef.current = authority.explicitAcquired;
  const [publicationSeen, setPublicationSeen] = useState<{
    epoch: number;
    kind: string;
  } | null>(null);
  const publicationKind = combat.publication.status.kind;
  useEffect(() => {
    setPublicationSeen({ epoch: explicitRef.current, kind: publicationKind });
  }, [publicationKind, combat.publication.status]);
  const clearedNotice =
    authority.explicitAcquired > 0 &&
    !(
      publicationSeen?.epoch === authority.explicitAcquired &&
      (publicationSeen.kind === 'broadcasting' ||
        publicationSeen.kind === 'saved-locally')
    );

  // ─── W5 private browser: selection is a push, never a presentation ────
  // W7: a selection made while preparing an encounter keeps preparing.
  const selectScene = useCallback(
    (sceneId: string) =>
      navigate('push', {
        scene: sceneId,
        prepareEncounter: query.prepareEncounter,
      }),
    [navigate, query.prepareEncounter]
  );
  const browser = useWorkspaceSceneBrowser({
    campaignCode,
    repository,
    initiallyOpen: query.panel === 'scenes',
    onSelect: selectScene,
  });
  const presented = presentation.presentation.descriptor?.presentation ?? null;
  const presentedHere =
    presented !== null &&
    mountedSceneId !== null &&
    presented.sceneId === mountedSceneId &&
    !presented.blanked;

  const checkpoint = useSceneCheckpointActions({
    repository,
    adapter: switcher.adapter,
    connection,
    campaignCode,
    dmId,
    sceneId: mountedSceneId,
  });

  return {
    query,
    navigate,
    dmId,
    opened,
    routeRejected,
    repository,
    current,
    snapshot,
    revision,
    scenes,
    sceneUnavailable,
    switcher,
    mountedScene,
    authority,
    relayStatus,
    relayLive,
    canvasEpoch,
    connection,
    setConnection,
    onViewportReady,
    onStatus,
    viewport: viewportState?.sceneId === mountedSceneId ? viewportState : null,
    requestedRunId: runInScene ? query.run : null,
    presentationProps,
    presentation,
    combat,
    clearedNotice,
    checkpoint,
    selectScene,
    onEditBusy,
    browser,
    presented,
    presentedHere,
  };
}
