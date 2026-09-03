'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { exposeStoreForE2E } from '@/lib/e2eStoreHandles';
import {
  HandTool,
  SelectTool,
  ArrowTool,
  MeasureTool,
  NoteTool,
  ImageTool,
  TextTool,
  ShapeTool,
  TemplateTool,
  EraserTool,
  LaserTool,
  PingTool,
  AutoSave,
  type CameraAnimator,
  type CameraView,
  type ElementActivationEvent,
  type FocusAudience,
  type Layer,
  type PathTool,
  type Tool,
  type Viewport,
} from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';
import { useLocationStore } from '@/store/locationStore';
import { useBattleMapStore } from '@/store/battleMapStore';
import {
  createManagedBattleMapConnection,
  type BattleMapConnection,
  type BattleMapConnectionStatus,
} from '@/lib/battlemapSync';
import { openTvDisplay } from '@/lib/openTvDisplay';
import { useShareWithPlayers } from './useShareWithPlayers';
import {
  ensureCanonicalLayers,
  migrateCanvasToContract,
  subscribePinCanonicalLayers,
  MAP_LAYER_ID,
} from './layerContract';
import { makeApplyRemoteLayer, publishOwnedLayers } from './layerSync';
import { attachLaserBroadcast, attachRemoteLaserTrails } from './laserSync';
import {
  attachPingBroadcast,
  attachPingInput,
  attachRemotePings,
} from './pingSync';
import {
  attachMeasureBroadcast,
  attachRemoteMeasurements,
  type MeasureBroadcastHandle,
} from './measureSync';
import {
  attachFocusBroadcast,
  createLocalCameraAnimator,
  type FocusBroadcastHandle,
} from './focusSync';
import { createMovementPathTool } from './movementTool';
import { applyMovementCommit } from './movementCommit';
import {
  attachPathBroadcast,
  attachRemotePaths,
  type PathBroadcastHandle,
} from './pathSync';
import { attachAwarenessSync } from './awarenessSync';
import type { AwarenessSyncHandle } from './awarenessSync';
import { attachConnectionScope } from './connectionScope';
import { useDmStore } from '@/store/dmStore';
import type { PeerRoster } from '@fieldnotes/core';
import { resolveDmMovement, logDmMovement } from './movementLogging';
import type { MovableTokenIdentity } from './tokenIdentity';
import { DmMarkerTool, type PlaceMarkerRequest } from './DmMarkerTool';
import { applyMarkerAudienceToggle } from './markerAudienceToggle';
import { MARKER_MIXED_AUDIENCE_MESSAGE } from './markerAudienceCopy';
import { buildPublicMarkerDetails } from './markerPublication';
import { markerRefForElement } from './markerWrites';
import { MARKER_DEFAULT_COLOR_KEY } from './markerPainter';
import type { MarkerDataIssue } from './markerPainter';
import { DM_AUDIENCE } from './markerData';
import type { MarkerColorKey, MarkerKind } from './markerData';
import {
  CANVAS_WRITING_TOOL_NAMES,
  useMarkerRegistration,
} from './useMarkerRegistration';
import { useCloseMarkerPanelOnRemove } from './useCloseMarkerPanelOnRemove';
import { useMarkerWrites } from './useMarkerWrites';
import { resolveMarkerPanelState } from './MarkerDetailPanel/MarkerDetailPanel.utils';
import type {
  MarkerPanelState,
  PortalTargetChoice,
  ResolvedPortalState,
} from './MarkerDetailPanel/MarkerDetailPanel.types';
import { resolveDmPortalDestination } from './markerPortal';
import type { MarkerToolControls } from './DmLocationToolOptions';
import { pinGridToMapLayer } from './gridPin';
import { nextMapImagePosition } from './mapImagePlacement';
import {
  enterArrangeMaps,
  exitArrangeMaps,
  type ArrangeMapsSession,
} from './arrangeMaps';
import type { DmLocationEditorProps } from './DmLocationEditor.types';
import type { GridSettings, LocationMap } from '@/types/location';
import type {
  BattleMap,
  MarkerDetail,
  MarkerPortalTargetV1,
} from '@/types/battlemap';

/** Stable identity for an empty campaign record — avoids a fresh `{}` on each
 *  selector call that would defeat Zustand's referential equality check. */
const EMPTY_RECORD: Record<string, { id: string; name: string }> = {};

/** `_fitCameraToMap` — retry when the viewport has zero size (layout not ready). */
const FIT_CAMERA_VIEWPORT_RETRY_MAX = 5;
/** Margin in pixels around the map when fitting to the viewport. */
const FIT_CAMERA_PADDING_PX = 40;
/** Do not zoom in beyond 100% (native image resolution). */
const FIT_CAMERA_MAX_ZOOM = 1;
/** Camera pan after fit (offsets map from UI chrome, e.g. toolbar). */
const FIT_CAMERA_PAN_OFFSET_X = 100;
const FIT_CAMERA_PAN_OFFSET_Y = 0;

/**
 * Route an S3 URL through our own proxy to avoid CORS canvas tainting.
 * Non-S3 URLs (e.g. blob: or data:) are returned as-is.
 */
function proxyUrl(url: string): string {
  if (url.includes('.s3.') && url.includes('.amazonaws.com')) {
    return `/api/assets/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/** Upload to S3 via /api/assets/upload; base64 data-URL fallback when S3 is
 *  not configured. Returns the canonical (non-proxied) src to store. */
async function uploadCanvasImage(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assetId', `canvas-${Date.now()}`);
    const res = await fetch('/api/assets/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url as string;
  } catch {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export interface DmLocationEditorState {
  // Mode
  mode: 'location' | 'battlemap';

  // Refs
  canvasRef: React.RefObject<FieldNotesCanvasRef | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  mapImageInputRef: React.RefObject<HTMLInputElement | null>;

  /** Shared with `ViewportContext` for @fieldnotes/react hooks */
  viewport: Viewport | null;

  // Tools
  tools: Tool[];

  layersPanelOpen: boolean;
  setLayersPanelOpen: (open: boolean) => void;

  // Grid
  gridEnabled: boolean;
  gridType: 'square' | 'hex';
  gridCellSize: number;
  gridColor: string;
  gridOpacity: number;
  handleSetGridType: (type: 'square' | 'hex' | 'off') => void;
  handleUpdateGridSettings: (settings: Partial<GridSettings>) => void;

  // DM-only
  dmOnlyElements: Record<string, boolean>;
  selectedElementId: string | null;
  isDmOnly: boolean;
  handleToggleDmOnly: () => void;
  hiddenPlacementActive: boolean;
  handleToggleHiddenPlacement: () => void;
  hiddenElementCount: number;
  handleRevealAll: () => void;

  // Loading states
  syncing: boolean;
  imageUploading: boolean;
  setImageUploading: (v: boolean) => void;

  // Sync status
  hasUnsyncedChanges: boolean;
  lastSyncedAt: string | null;
  syncStatus: BattleMapConnectionStatus | 'disabled';

  // Share with players (battlemap mode only)
  sharedWithPlayers: boolean;
  handleToggleShareWithPlayers: () => void;

  // Handlers
  handleReady: (vp: Viewport) => void;
  handlePickImage: () => void;
  handleClear: () => void;
  handleSyncToPlayers: () => Promise<void>;
  handleImageFileSelect: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => Promise<void>;
  handlePickMapImage: () => void;
  handleMapImageFileSelect: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => Promise<void>;
  handleOpenTvDisplay: () => Promise<void>;
  handleFitToMap: () => void;

  // Arrange maps (battlemap mode only)
  arrangeMapsActive: boolean;
  handleToggleArrangeMaps: () => void;

  // Layer sync (battlemap mode; no-ops when live sync is off)
  publishLayerUpsert: (definition: Layer) => void;
  publishLayerRemove: (id: string) => void;

  // Shared live ruler (battlemap mode; no-ops when live sync is off)
  measureSharing: boolean;
  handleSetMeasureSharing: (enabled: boolean) => void;

  // Movement path sharing + dash toggle (battlemap mode; no-ops when live sync is off)
  pathSharing: boolean;
  handleSetPathSharing: (enabled: boolean) => void;
  movementDash: boolean;
  handleSetMovementDash: (enabled: boolean) => void;

  /** Who-is-viewing roster from the shared-presence attachment (null before
   *  handleReady/relay attach). */
  awarenessRoster: PeerRoster | null;
  /** DM's own cursor-share session switch — default OFF. */
  cursorSharing: boolean;
  handleSetCursorSharing: (enabled: boolean) => void;
  /** Viewer-side render switch for PLAYER cursors — default ON. */
  showPlayerCursors: boolean;
  handleSetShowPlayerCursors: (enabled: boolean) => void;

  // Camera focus requests (battlemap mode; no-ops when live sync is off)
  handleGoToCameraView: (view: CameraView) => void;
  handleSendCameraView: (view: CameraView, audience: FocusAudience) => void;

  // ─── Markers (connection-independent; work with no relay URL) ───
  /** Kind + colour for the marker tool, mirrored into the refs it reads. */
  markerControls: MarkerToolControls;
  /** True when the selected element is a marker whose data is currently valid. */
  selectedElementIsMarker: boolean;
  /** Explanation for a refused audience transition, or null. */
  markerAudienceNotice: string | null;
  markerPanelOpen: boolean;
  markerPanelState: MarkerPanelState;
  markerPanelIsDmOnly: boolean;
  handleSetMarkerAudience: (dmOnly: boolean) => void;
  handleCloseMarkerPanel: () => void;
  handleSaveMarkerDetail: (patch: {
    title: string;
    body: string;
    dmNotes: string;
    status?: import('@/types/battlemap').MarkerStatus;
    discovery?: import('@/types/battlemap').MarkerDiscovery;
    trap?: import('@/types/battlemap').MarkerTrapMechanics;
    loot?: import('@/types/battlemap').MarkerLootEntry[];
    portal?: MarkerPortalTargetV1 | null;
  }) => void;
  handleDeleteMarker: () => void;

  /** Resolved portal destination state for the active marker panel. */
  portalState?: ResolvedPortalState;

  // Battle-map export control
  getViewport: () => Viewport | null;
  getDmOnlyElements: () => Record<string, boolean>;

  /** Mode-switching store write (locationStore vs. battleMapStore) — use
   *  this for ALL writes in the render site rather than reaching into a
   *  specific store directly, or a location-mode write can silently land in
   *  the wrong store. */
  storeUpdateLocation: (
    campaignCode: string,
    id: string,
    updates: Partial<BattleMap> & Partial<LocationMap>
  ) => void;
}

export function useDmLocationEditor(
  props: DmLocationEditorProps
): DmLocationEditorState {
  const { location, campaignCode, dmId, onSave, onSyncToPlayers } = props;
  const mode = props.mode ?? 'location';

  const canvasRef = useRef<FieldNotesCanvasRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapImageInputRef = useRef<HTMLInputElement>(null);
  const autoSaveRef = useRef<AutoSave | null>(null);
  const connectionRef = useRef<BattleMapConnection | null>(null);
  const laserCleanupRef = useRef<(() => void) | null>(null);
  const pinUnsubRef = useRef<(() => void) | null>(null);
  const hiddenPlacementUnsubRef = useRef<(() => void) | null>(null);
  const markerAddGuardUnsubRef = useRef<(() => void) | null>(null);
  const markerRemovalTrackUnsubRef = useRef<(() => void) | null>(null);
  const selectionUnsubRef = useRef<(() => void) | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    BattleMapConnectionStatus | 'disabled'
  >('disabled');
  const [arrangeMapsActive, setArrangeMapsActive] = useState(false);
  const arrangeActiveRef = useRef(false);
  const arrangeSessionRef = useRef<ArrangeMapsSession | null>(null);
  /** Live viewport for unmount-time cleanup — canvasRef is already nulled by
   * React (child refs detach before ancestor effect cleanup) when the
   * cleanup effect runs, so it cannot be used there. */
  const vpRef = useRef<Viewport | null>(null);

  const [viewport, setViewport] = useState<Viewport | null>(null);
  // E2E test handle — exposes the Fieldnotes viewport so Playwright can
  // query the camera and element store without reverse-engineering the
  // camera fit on every test run.
  useEffect(() => {
    if (viewport) exposeStoreForE2E('viewport', viewport);
  }, [viewport]);

  const [layersPanelOpen, setLayersPanelOpen] = useState(true);

  // Grid state
  const [gridEnabled, setGridEnabled] = useState(location.gridEnabled);
  const [gridType, setGridType] = useState<'square' | 'hex'>(
    location.gridSettings?.gridType ?? 'hex'
  );
  const [gridCellSize, setGridCellSize] = useState(
    location.gridSettings?.cellSize ?? 50
  );
  const [gridColor, setGridColor] = useState(
    location.gridSettings?.strokeColor ?? '#94a3b8'
  );
  const [gridOpacity, setGridOpacity] = useState(
    location.gridSettings?.opacity ?? 0.5
  );

  // DM-only state — pull from store (call both hooks unconditionally for React rules)
  const locationStoreGetLoc = useLocationStore(s => s.getLocation);
  const locationStoreToggle = useLocationStore(s => s.toggleDmOnly);
  const locationStoreUpdate = useLocationStore(s => s.updateLocation);
  const markerDmOnlyElements = useLocationStore(
    state => state.locations[campaignCode]?.[location.id]?.dmOnlyElements
  );

  const battleMapStoreGetBm = useBattleMapStore(s => s.getBattleMap);
  const battleMapStoreToggle = useBattleMapStore(s => s.toggleDmOnly);
  const battleMapStoreUpdate = useBattleMapStore(s => s.updateBattleMap);

  // Pick the right store based on mode
  const storeGetLocation =
    mode === 'battlemap' ? battleMapStoreGetBm : locationStoreGetLoc;
  const storeToggleDmOnly =
    mode === 'battlemap' ? battleMapStoreToggle : locationStoreToggle;
  const storeUpdateLocation =
    mode === 'battlemap' ? battleMapStoreUpdate : locationStoreUpdate;
  const currentLocation = storeGetLocation(campaignCode, location.id);
  const dmOnlyElements = currentLocation?.dmOnlyElements ?? {};
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
  const isDmOnly =
    selectedElementId != null
      ? (dmOnlyElements[selectedElementId] ?? false)
      : false;
  const [hiddenPlacementActive, setHiddenPlacementActive] = useState(false);
  const hiddenPlacementActiveRef = useRef(false);
  const [measureSharing, setMeasureSharing] = useState(false);
  const measureSharingRef = useRef(false);
  const measureBroadcastRef = useRef<MeasureBroadcastHandle | null>(null);
  const focusBroadcastRef = useRef<FocusBroadcastHandle | null>(null);
  const localAnimatorRef = useRef<CameraAnimator | null>(null);

  const handleSetMeasureSharing = useCallback((enabled: boolean) => {
    measureSharingRef.current = enabled;
    setMeasureSharing(enabled);
    measureBroadcastRef.current?.setSharing(enabled);
  }, []);

  const [pathSharing, setPathSharing] = useState(false);
  const pathSharingRef = useRef(false);
  const pathBroadcastRef = useRef<PathBroadcastHandle | null>(null);
  const [movementDash, setMovementDash] = useState(false);
  const movementDashRef = useRef(false);
  const movementCommitUnsubRef = useRef<(() => void) | null>(null);

  const handleSetPathSharing = useCallback((enabled: boolean) => {
    pathSharingRef.current = enabled;
    setPathSharing(enabled);
    pathBroadcastRef.current?.setSharing(enabled);
  }, []);
  const handleSetMovementDash = useCallback((enabled: boolean) => {
    movementDashRef.current = enabled;
    setMovementDash(enabled);
  }, []);

  // Shared presence (core 0.65.0 awareness). Session-scoped like measure/
  // path sharing: the DM's cursor is published only while this switch is on
  // (default OFF); identity heartbeats run regardless so players' "who is
  // viewing" sees the DM. `showPlayerCursors` is the viewer-side render
  // switch for PLAYER cursors (other DMs' cursors always draw).
  const [cursorSharing, setCursorSharing] = useState(false);
  const cursorSharingRef = useRef(false);
  const [showPlayerCursors, setShowPlayerCursors] = useState(true);
  const showPlayerCursorsRef = useRef(true);
  const awarenessRef = useRef<AwarenessSyncHandle | null>(null);
  const [awarenessRoster, setAwarenessRoster] = useState<PeerRoster | null>(
    null
  );
  const handleSetCursorSharing = useCallback((enabled: boolean) => {
    cursorSharingRef.current = enabled;
    setCursorSharing(enabled);
    awarenessRef.current?.setShareCursor(enabled);
  }, []);
  const handleSetShowPlayerCursors = useCallback((enabled: boolean) => {
    showPlayerCursorsRef.current = enabled;
    setShowPlayerCursors(enabled);
    awarenessRef.current?.setShowPlayerCursors(enabled);
  }, []);

  // ─── Portal target choices ────────────────────────────────────
  // Subscribe to the backing RECORD references (not `getBattleMaps()` /
  // `getLocations()` results — those produce fresh arrays and defeat Zustand's
  // referential equality check, causing every unrelated write to rerender).
  const campaignBattleMaps = useBattleMapStore(
    s => s.battleMaps[campaignCode] ?? EMPTY_RECORD
  );
  const campaignLocations = useLocationStore(
    s => s.locations[campaignCode] ?? EMPTY_RECORD
  );

  const portalBattleMapChoices = useMemo((): PortalTargetChoice[] => {
    const sourceIsBattleMap = mode === 'battlemap';
    return Object.values(campaignBattleMaps)
      .filter(bm => !(sourceIsBattleMap && bm.id === location.id))
      .map(bm => ({ id: bm.id, name: bm.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [campaignBattleMaps, location.id, mode]);

  const portalLocationChoices = useMemo((): PortalTargetChoice[] => {
    const sourceIsLocation = mode === 'location';
    return Object.values(campaignLocations)
      .filter(loc => !(sourceIsLocation && loc.id === location.id))
      .map(loc => ({ id: loc.id, name: loc.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [campaignLocations, location.id, mode]);

  const linkedEncounterIdsLive = useCallback(
    () =>
      useBattleMapStore.getState().battleMaps[campaignCode]?.[location.id]
        ?.linkedEncounterIds ?? [],
    [campaignCode, location.id]
  );
  const resolveMovement = useCallback(
    (identity: MovableTokenIdentity) =>
      resolveDmMovement(identity, linkedEncounterIdsLive()),
    [linkedEncounterIdsLive]
  );

  // ─── Markers ──────────────────────────────────────────────────
  // Everything below is deliberately connection-independent: no relay read,
  // no connection ref. Placing and opening markers must work with
  // NEXT_PUBLIC_BATTLEMAP_RELAY_URL unset (spec §7.2, CONSTRAINTS-B).
  const [markerKind, setMarkerKind] = useState<MarkerKind>('door');
  const [markerColor, setMarkerColor] = useState<MarkerColorKey>(
    MARKER_DEFAULT_COLOR_KEY
  );
  const [activeMarkerElementId, setActiveMarkerElementId] = useState<
    string | null
  >(null);
  const [markerAudienceNotice, setMarkerAudienceNotice] = useState<
    string | null
  >(null);

  // Read at placement time by `DmMarkerTool`, not captured at construction:
  // the canvas keeps the first registered tool instance, so a constructor
  // capture would go stale the moment the DM changes the picker.
  const markerKindRef = useRef<MarkerKind>(markerKind);
  markerKindRef.current = markerKind;
  const markerColorRef = useRef<MarkerColorKey>(markerColor);
  markerColorRef.current = markerColor;

  // Stable identity (canvasRef is a ref, so no dependency): declared here
  // rather than reusing `getVp` below, which is defined after this block.
  const getMarkerViewport = useCallback(
    () => canvasRef.current?.viewport ?? null,
    []
  );

  const markerWrites = useMarkerWrites({
    mode,
    campaignCode,
    mapId: location.id,
    getViewport: getMarkerViewport,
  });
  // Same staleness problem as the picker refs: the tool instance outlives
  // every `markerWrites` identity, so the placement handler is reached
  // through a ref rather than captured.
  const handlePlaceMarkerRef = useRef<(request: PlaceMarkerRequest) => void>(
    () => {}
  );
  handlePlaceMarkerRef.current = (request: PlaceMarkerRequest) => {
    const vp = getMarkerViewport();
    if (!vp) return;
    // The tool writes nothing itself — `createMarker` owns the §6.7 ordering
    // that marks the element DM-only BEFORE it reaches the canvas store.
    markerWrites.createMarker({
      ...request,
      layerId: vp.layerManager.activeLayerId,
      title: '',
      body: '',
      dmNotes: '',
    });
  };

  // Same staleness reasoning again: both of these are reached from
  // subscriptions installed once inside `handleReady`, which outlive every
  // `markerWrites` identity.
  const guardLocalMarkerAddRef = useRef(markerWrites.guardLocalMarkerAdd);
  guardLocalMarkerAddRef.current = markerWrites.guardLocalMarkerAdd;
  // The other half of that guard: what a removal remembers is what lets a
  // later re-add of the same id be recognised as an UNDO rather than a
  // duplicate.
  const noteMarkerRemovalRef = useRef(markerWrites.noteMarkerRemoval);
  noteMarkerRemovalRef.current = markerWrites.noteMarkerRemoval;
  const gcOrphanMarkerDetailsRef = useRef(markerWrites.gcOrphanMarkerDetails);
  gcOrphanMarkerDetailsRef.current = markerWrites.gcOrphanMarkerDetails;

  // Loading states
  const [syncing, setSyncing] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  // Sync status
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(true);

  // Share with players (battlemap mode only) — hydrated from server truth
  const { sharedWithPlayers, handleToggleShareWithPlayers } =
    useShareWithPlayers(campaignCode, dmId, location, mode === 'battlemap');

  // Build tools once. Battle-map setup also supports FieldNotes' stroke eraser.
  const tools = useMemo<Tool[]>(() => {
    const baseTools: Tool[] = [
      new HandTool(),
      new SelectTool(),
      new TextTool({ fontSize: 16, color: '#334155', textAlign: 'left' }),
      new NoteTool({ backgroundColor: '#fef08a', textColor: '#334155' }),
      new ShapeTool({
        shape: 'rectangle',
        strokeColor: '#334155',
        strokeWidth: 2,
        fillColor: 'transparent',
      }),
      new ArrowTool({ color: '#334155', width: 2 }),
      new ImageTool(),
    ];

    if (mode === 'battlemap') {
      baseTools.push(new MeasureTool({ feetPerCell: 5 }));
      baseTools.push(
        createMovementPathTool({
          getViewport: () => vpRef.current,
          role: 'dm',
          resolveMovement,
          isDashActive: () => movementDashRef.current,
        })
      );
      baseTools.push(
        new TemplateTool({
          templateShape: 'circle',
          feetPerCell: 5,
          fillColor: '#ef444480',
          strokeColor: '#ef4444',
          strokeWidth: 2,
          renderStyle: 'geometric',
        })
      );
      baseTools.push(new EraserTool({ radius: 12, mode: 'stroke' }));
      // Ephemeral pointer; trails broadcast as presence while the battlemap
      // room connection is up (see attachLaserBroadcast).
      baseTools.push(new LaserTool({ color: '#F4C430', width: 3 }));
      // Ephemeral "look here" pulse; taps broadcast as presence while the
      // battlemap room connection is up (see attachPingBroadcast).
      baseTools.push(new PingTool({ color: '#F4C430' }));
      baseTools.push(
        new DmMarkerTool(markerKindRef, markerColorRef, request =>
          handlePlaceMarkerRef.current(request)
        )
      );
    }

    // Both modes: marker anchors are available on all DM map surfaces.
    if (mode !== 'battlemap') {
      baseTools.push(
        new DmMarkerTool(markerKindRef, markerColorRef, request =>
          handlePlaceMarkerRef.current(request)
        )
      );
    }

    return baseTools;
  }, [mode, resolveMovement]);

  const getVp = useCallback(() => canvasRef.current?.viewport ?? null, []);

  const handleMarkerActivate = useCallback((event: ElementActivationEvent) => {
    setActiveMarkerElementId(event.element.id);
  }, []);

  const handleMarkerDataIssue = useCallback((issue: MarkerDataIssue) => {
    // A DM surface: the operator here can actually act on a malformed pin.
    // The player and display surfaces stay silent.
    console.warn(
      `[markers] element ${issue.elementId} has ${issue.status} marker data` +
        (issue.reason ? `: ${issue.reason}` : '') +
        (issue.version !== undefined ? ` (v${issue.version})` : '')
    );
  }, []);

  // OUTSIDE the relay guard in `handleReady`, and NOT part of `laserCleanups`
  // or any other connection-scoped cleanup: painter registration and
  // activation are connection-independent (spec §7.2). Unconditional with
  // respect to `mode` — both modes support the marker tool and must paint
  // markers.
  useMarkerRegistration({
    viewport,
    gesture: 'double',
    markerDetails: markerWrites.markers,
    onActivateMarker: handleMarkerActivate,
    onMarkerDataIssue: handleMarkerDataIssue,
    isCameraBusy: () => localAnimatorRef.current?.animating ?? false,
    // Read the ACTIVE TOOL at gesture time — see the twin comment in
    // `dm-vtt/DmBattleMapCanvas.hooks.ts`.
    isActivationSuppressed: () =>
      CANVAS_WRITING_TOOL_NAMES.has(
        vpRef.current?.toolManager.activeTool?.name ?? ''
      ),
  });

  const activeMarkerElement =
    activeMarkerElementId !== null
      ? (viewport?.store.getById(activeMarkerElementId) ?? null)
      : null;
  const markerPanelState = resolveMarkerPanelState(
    activeMarkerElement,
    markerWrites.markers,
    'dm'
  );
  const activeMarkerRef =
    markerPanelState.kind === 'ready' ||
    markerPanelState.kind === 'missing-detail'
      ? markerPanelState.data.ref
      : null;
  const markerPanelIsDmOnly =
    activeMarkerElementId !== null &&
    markerDmOnlyElements?.[activeMarkerElementId] === true;

  const sourceKind = mode === 'battlemap' ? 'battlemap' : 'location';

  const portalState = useMemo((): ResolvedPortalState | undefined => {
    if (markerPanelState.kind !== 'ready') return undefined;
    const detail = markerPanelState.detail as MarkerDetail;
    // Only resolve for DM details (which carry the portal field).
    if (!('dmNotes' in detail)) return undefined;

    const state: ResolvedPortalState = {
      target: detail.portal,
      battleMapChoices: portalBattleMapChoices,
      locationChoices: portalLocationChoices,
    };

    if (detail.portal) {
      state.resolved = resolveDmPortalDestination(
        detail.portal,
        campaignCode,
        location.id,
        sourceKind,
        {
          battleMaps: {
            getBattleMap: (_cc, id) =>
              campaignBattleMaps[id] as
                | { id: string; name: string }
                | undefined,
          },
          locations: {
            getLocation: (_cc, id) =>
              campaignLocations[id] as { id: string; name: string } | undefined,
          },
        }
      );
    }

    return state;
  }, [
    markerPanelState,
    portalBattleMapChoices,
    portalLocationChoices,
    campaignBattleMaps,
    campaignLocations,
    campaignCode,
    location.id,
    sourceKind,
  ]);

  const handleCloseMarkerPanel = useCallback(() => {
    setActiveMarkerElementId(null);
  }, []);

  const handleSetMarkerAudience = useCallback(
    (dmOnly: boolean) => {
      if (activeMarkerRef === null) return;
      const transition = markerWrites.setMarkerAudienceForRef(
        activeMarkerRef,
        dmOnly
      );
      setMarkerAudienceNotice(
        transition.status === 'refused' &&
          transition.reason === 'mixed-audience'
          ? MARKER_MIXED_AUDIENCE_MESSAGE
          : null
      );
      // Every successful audience change affects publication (§6.4 — the
      // public projection depends on `dmOnlyElements`). A refusal means
      // nothing moved, so it does not dirty the sync state.
      if (mode === 'location' && transition.status !== 'refused') {
        setHasUnsyncedChanges(true);
      }
    },
    [activeMarkerRef, markerWrites, mode]
  );

  // `activeMarkerElement` above is a bare render-time `getById` with no store
  // subscription — without this the panel would survive its own element.
  useCloseMarkerPanelOnRemove(
    viewport,
    activeMarkerElementId,
    handleCloseMarkerPanel
  );

  const handleSaveMarkerDetail = useCallback(
    (patch: {
      title: string;
      body: string;
      dmNotes: string;
      status?: import('@/types/battlemap').MarkerStatus;
      discovery?: import('@/types/battlemap').MarkerDiscovery;
      trap?: import('@/types/battlemap').MarkerTrapMechanics;
      loot?: import('@/types/battlemap').MarkerLootEntry[];
      portal?: MarkerPortalTargetV1 | null;
    }) => {
      if (activeMarkerRef === null) return;

      // Snapshot public-facing fields before the edit so we can compare
      // after. Only location mode needs this — battlemap syncs via the relay.
      const beforeDetail =
        mode === 'location'
          ? markerWrites.findMarkerDetail(activeMarkerRef)
          : undefined;

      markerWrites.editMarkerDetail(activeMarkerRef, patch);

      // Location mode publication-dirty seam: mark dirty ONLY when a field
      // that reaches `buildPublicMarkerDetails` changed. `dmNotes`, `portal`,
      // `discovery`, and `trap` are never published (§6.4), so edits to
      // those alone leave the sync indicator untouched.
      if (mode === 'location' && beforeDetail) {
        const afterDetail = markerWrites.findMarkerDetail(activeMarkerRef);
        if (afterDetail) {
          const publicChanged =
            beforeDetail.title !== afterDetail.title ||
            beforeDetail.body !== afterDetail.body ||
            beforeDetail.status !== afterDetail.status ||
            // Loot is a reference array — a cheap JSON snapshot comparison is
            // acceptable here because the array is small (usually < 10 items).
            JSON.stringify(beforeDetail.loot ?? []) !==
              JSON.stringify(afterDetail.loot ?? []);
          if (publicChanged) {
            setHasUnsyncedChanges(true);
          }
        }
      }
    },
    [activeMarkerRef, markerWrites, mode]
  );

  const handleDeleteMarker = useCallback(() => {
    if (activeMarkerElementId === null) return;
    markerWrites.deleteMarker(activeMarkerElementId);
    setActiveMarkerElementId(null);
  }, [activeMarkerElementId, markerWrites]);

  const markerControls = useMemo<MarkerToolControls>(
    () => ({
      kind: markerKind,
      color: markerColor,
      onKindChange: setMarkerKind,
      onColorChange: setMarkerColor,
    }),
    [markerKind, markerColor]
  );

  const handleReady = useCallback(
    async (vp: Viewport) => {
      setViewport(vp);
      vpRef.current = vp;

      // Track selected element for DM-only toggle. `viewport.onSelectionChange`
      // is a persistent, viewport-owned emitter: it works whether or not a
      // select tool is registered yet, and `getSelectedIds()` never surfaces
      // stale ids (deletions prune the selection before the event fires).
      const syncSelection = () => {
        const ids = vp.getSelectedIds();
        setSelectedElementId(ids.length === 1 ? ids[0] : null);
        // A refused mixed-audience notice is about the PREVIOUS selection;
        // once the DM moves on, leaving it attached to no control would
        // mislead rather than explain.
        setMarkerAudienceNotice(null);
      };
      selectionUnsubRef.current?.();
      selectionUnsubRef.current = vp.onSelectionChange(syncSelection);
      syncSelection();

      // AutoSave — persist to store
      const autoSave = new AutoSave(vp.store, vp.camera, {
        key: `location-canvas-${location.id}`,
        debounceMs: 1500,
        layerManager: vp.layerManager,
      });

      // Load existing canvas state from location, or initialize with map background
      if (location.canvasState && location.canvasState.trim().length > 0) {
        try {
          vp.loadJSON(location.canvasState);
          // §6.8: the ONLY point orphan GC may run — a fully successful
          // deserialization, with refs extracted from the state just loaded.
          // On the `catch` path below the canvas did NOT load, so GC must not
          // run there: it would tombstone details whose pins were simply
          // unreadable. Without a caller the soft delete never runs at all
          // and detail records, `dmNotes` included, accumulate forever.
          gcOrphanMarkerDetailsRef.current(location.canvasState);
          const migrated = migrateCanvasToContract(vp, 'dm');
          pinGridToMapLayer(vp);
          _fitCameraToMap(vp, location.mapImageSize);
          if (migrated) {
            onSave(vp.exportJSON());
            setHasUnsyncedChanges(true);
          }
        } catch {
          // Corrupt state — start fresh
          _initializeBackground(
            vp,
            location.mapImageUrl,
            location.mapImageSize
          );
        }
      } else {
        // New location — place the map image as a locked background on the map layer
        _initializeBackground(vp, location.mapImageUrl, location.mapImageSize);
      }

      autoSave.start();
      autoSaveRef.current = autoSave;

      // Wire autosave to also call onSave so parent can persist to store.
      // Remote-origin ops (relayed from another client) must not thrash
      // zustand/localStorage on every incoming drag frame; AutoSave still
      // snapshots everything on its own 1.5s debounce regardless of origin.
      const saveAndMarkDirty = (_data: unknown, meta?: { origin?: string }) => {
        if (meta?.origin !== undefined && meta.origin !== 'local') return;
        const json = vp.exportJSON();
        onSave(json);
        setHasUnsyncedChanges(true);
      };
      vp.store.on('add', saveAndMarkDirty);
      vp.store.on('remove', saveAndMarkDirty);
      vp.store.on('update', saveAndMarkDirty);

      // Register before live sync starts so a newly-created local element is
      // marked DM-only before the sync client resolves its audience. Remote
      // additions (including player tokens) must never inherit this setting.
      hiddenPlacementUnsubRef.current?.();
      hiddenPlacementUnsubRef.current = vp.store.on('add', (element, meta) => {
        if (
          mode !== 'battlemap' ||
          !hiddenPlacementActiveRef.current ||
          (meta?.origin !== undefined && meta.origin !== 'local')
        ) {
          return;
        }
        useBattleMapStore
          .getState()
          .setDmOnly(campaignCode, location.id, element.id, true);
      });

      // Markers are DM-only by DEFAULT, so unlike the hidden-placement
      // listener above this one is unconditional — not gated on a toggle, and
      // not gated on `mode` either (a location map can hold markers too;
      // `useMarkerWrites` routes the write to whichever store `mode` selects).
      // Registered BEFORE the live connection below so the mark lands before
      // the sync client resolves this element's audience, and AFTER
      // `loadJSON`, because `ElementStore.loadSnapshot` replays an `add` for
      // every persisted element with no origin meta.
      markerAddGuardUnsubRef.current?.();
      markerAddGuardUnsubRef.current = vp.store.on('add', (element, meta) => {
        // `vp` is handed over rather than looked up: this is the very store
        // that emitted the add, and a guard that resolved its viewport through
        // an accessor would fail OPEN the moment that accessor answered null.
        guardLocalMarkerAddRef.current(vp, element, meta);
      });

      // What the guard above discriminates on. `RemoveElementCommand.undo`
      // re-adds the SAME element with no meta, so without this the guard would
      // read an undo as a duplicate and silently un-share the pin. Registered
      // next to the guard because the two are one mechanism.
      markerRemovalTrackUnsubRef.current?.();
      markerRemovalTrackUnsubRef.current = vp.store.on(
        'remove',
        (element, meta) => {
          noteMarkerRemovalRef.current(element, meta);
        }
      );

      pinUnsubRef.current?.();
      pinUnsubRef.current = subscribePinCanonicalLayers(vp, () => ({
        mapUnlocked: arrangeActiveRef.current,
        // Annotations is locked only while arranging maps; pinned unlocked
        // otherwise so the DM is never trapped on a locked annotations layer.
        annotationsLocked: arrangeActiveRef.current,
      }));

      // Local "go to this view" for the DM's own camera (battlemap mode
      // only — the Views popover only renders then, see DmLocationToolbar).
      // Unlike attachFocusBroadcast below, moving your own camera needs no
      // relay connection at all, so this must run unconditionally here —
      // not inside the relay-gated block — or the popover's "go" button
      // silently no-ops for every DM running without
      // NEXT_PUBLIC_BATTLEMAP_RELAY_URL configured. Own cleanup ref (not
      // laserCleanups) because it is not connection-scoped.
      if (mode === 'battlemap') {
        localAnimatorRef.current?.dispose();
        const localAnimator = createLocalCameraAnimator(vp);
        localAnimatorRef.current = localAnimator;
      }

      // Movement commit: connection-independent — moving a token needs no
      // relay connection at all, so this runs unconditionally here (gated
      // only on `mode`, not on `relayUrl`), before the relay-gated block.
      movementCommitUnsubRef.current?.();
      const movementTool =
        mode === 'battlemap' ? vp.toolManager.getTool<PathTool>('path') : null;
      if (movementTool) {
        movementCommitUnsubRef.current = movementTool.onCommit(emission => {
          applyMovementCommit(emission, {
            viewport: vp,
            role: 'dm',
            resolveMovement,
            logMovement: payload =>
              logDmMovement(linkedEncounterIdsLive(), payload),
          });
        });
      }

      // Live sync — battlemap mode only; resolver reads Zustand LIVE via
      // getState() (a captured snapshot would go stale after the first toggle).
      if (mode === 'battlemap' && process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL) {
        // Re-attach: tear down the OLD connection-scoped handles BEFORE
        // stopping the old connection, so their final frames (awareness
        // `cleared`, measure/path clears) ride the still-live socket — the
        // same order the unmount effect uses.
        laserCleanupRef.current?.();
        laserCleanupRef.current = null;
        connectionRef.current?.stop();
        connectionRef.current = null;
        const connection = createManagedBattleMapConnection({
          relayUrl: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
          campaignCode,
          battleMapId: location.id,
          store: vp.store,
          clientId: dmId,
          tokenRequest: { role: 'dm', battleMapId: location.id, dmId },
          seedLocal: true,
          resolveAudience: el =>
            useBattleMapStore.getState().battleMaps[campaignCode]?.[location.id]
              ?.dmOnlyElements[el.id]
              ? DM_AUDIENCE
              : undefined,
          // Layer definitions sync (replaces the unknown-layer mirror):
          // winning remote records apply through history-transparent *Direct
          // calls; the pin subscription above re-pins bands on every change.
          layers: {
            applyLayer: makeApplyRemoteLayer(vp, 'dm', {
              onApplied: () => vp.requestRender(),
            }),
          },
          onStatus: s => {
            setSyncStatus(s);
            // Managed sendPresence drops while not live, so the attach-time
            // frame may be lost; announce on every live transition (first
            // connect AND reconnect) — the heartbeat self-heals otherwise.
            if (s === 'live') awarenessRef.current?.announce();
          },
        });
        connectionRef.current = connection;
        // Teach peers and late joiners the custom layers persisted in this
        // canvas (created before layer sync, or on another device).
        publishOwnedLayers(vp, 'dm', def => connection.publishLayerUpsert(def));

        // Laser pointer + map pings: broadcast this DM's, render everyone
        // else's. The whole attach sequence runs inside a connection scope:
        // if any helper below throws, everything already created is
        // unwound (in push order) and the NEW connection is stopped before
        // the error surfaces — no half-attached handles, no orphaned
        // socket. On success the returned composite cleanup is what
        // laserCleanupRef carries forward (unmount and re-attach both call
        // it before connection.stop()).
        try {
          laserCleanupRef.current = attachConnectionScope(connection, scope => {
            scope.push(attachRemoteLaserTrails(vp, connection));
            const remotePings = attachRemotePings(vp, connection);
            scope.push(remotePings.dispose);
            scope.push(attachRemoteMeasurements(vp, connection).dispose);
            scope.push(attachRemotePaths(vp, connection).dispose);
            const laserTool = vp.toolManager.getTool<LaserTool>('laser');
            if (laserTool) {
              scope.push(attachLaserBroadcast(laserTool, connection));
            }
            const pingTool = vp.toolManager.getTool<PingTool>('ping');
            if (pingTool) {
              scope.push(attachPingBroadcast(pingTool, connection));
            }
            const measureTool = vp.toolManager.getTool<MeasureTool>('measure');
            if (measureTool) {
              const measureBroadcast = attachMeasureBroadcast(
                measureTool,
                connection
              );
              // Reattachment (viewport/connection rebuild) must not silently
              // revert to private while the toggle still says shared — apply
              // the latest value now.
              measureBroadcast.setSharing(measureSharingRef.current);
              measureBroadcastRef.current = measureBroadcast;
              scope.push(() => {
                measureBroadcastRef.current = null;
                measureBroadcast.dispose();
              });
            }
            // Camera focus requests ("bring them here"): broadcast this DM's
            // sends over presence. Stateless by design — see
            // attachFocusBroadcast — so there is no re-apply after
            // (re)attach, unlike measureBroadcast. Broadcast genuinely needs
            // the connection (unlike the local animator above, which is set
            // up unconditionally), so it stays gated here.
            const focusBroadcast = attachFocusBroadcast(connection);
            focusBroadcastRef.current = focusBroadcast;
            scope.push(() => {
              focusBroadcastRef.current = null;
              focusBroadcast.dispose();
            });
            if (movementTool) {
              const pathBroadcast = attachPathBroadcast(
                movementTool,
                connection,
                {
                  role: 'dm',
                  isDmOnlyElement: id =>
                    !!useBattleMapStore.getState().battleMaps[campaignCode]?.[
                      location.id
                    ]?.dmOnlyElements[id],
                  getElement: id => vp.store.getById(id) ?? null,
                }
              );
              // Reattachment must not silently revert to private while the
              // toggle still says shared — apply the latest value now
              // (measure precedent).
              pathBroadcast.setSharing(pathSharingRef.current);
              pathBroadcastRef.current = pathBroadcast;
              scope.push(() => {
                pathBroadcastRef.current = null;
                pathBroadcast.dispose();
              });
            }

            // Always-available DM pings: long-press with any tool + "P" at
            // the cursor, self-pulse through the shared receive overlay. The
            // veto skips the ping tool, whose own tap already pinged on
            // pointer down.
            scope.push(
              attachPingInput(vp, remotePings.overlay, connection, {
                color: '#F4C430',
                // Options-bar swatch changes restyle long-press/hotkey pings
                // too.
                ...(pingTool ? { followTool: pingTool } : {}),
                hotkey: 'p',
                shouldPing: () => vp.toolManager.activeTool?.name !== 'ping',
              })
            );

            // Shared presence: identity always, cursor behind the session
            // switch, selection/tool never (see awarenessSync.ts). Re-attach
            // re-applies the switch state (measure precedent). Pushed into
            // the connection scope so the `cleared` frame rides the live
            // socket before connection.stop().
            const awareness = attachAwarenessSync(vp, connection, {
              identity: { id: dmId, name: 'DM', role: 'dm' },
              shareCursor: cursorSharingRef.current,
              showPlayerCursors: showPlayerCursorsRef.current,
              colorFor: peer =>
                useDmStore.getState().getPlayerColor(campaignCode, peer.id),
            });
            awarenessRef.current = awareness;
            setAwarenessRoster(awareness.roster);
            scope.push(() => {
              awarenessRef.current = null;
              setAwarenessRoster(null);
              awareness.dispose();
            });
          });
        } catch (error) {
          // attachConnectionScope already disposed every helper it saw and
          // stopped `connection`; drop the dead reference so unmount and the
          // next re-attach do not stop it twice, then surface the error.
          connectionRef.current = null;
          throw error;
        }
      }
    },
    [
      location,
      onSave,
      mode,
      campaignCode,
      dmId,
      resolveMovement,
      linkedEncounterIdsLive,
    ]
  );

  /** Zoom & pan so the map image fills the viewport with a small margin. */
  function _fitCameraToMap(
    vp: Viewport,
    mapImageSize: { w: number; h: number },
    retries = 0
  ) {
    const screenW = vp.domLayer.clientWidth;
    const screenH = vp.domLayer.clientHeight;

    if (screenW === 0 || screenH === 0) {
      if (retries < FIT_CAMERA_VIEWPORT_RETRY_MAX) {
        requestAnimationFrame(() =>
          _fitCameraToMap(vp, mapImageSize, retries + 1)
        );
      }
      return;
    }

    const zoom = Math.min(
      (screenW - FIT_CAMERA_PADDING_PX * 2) / mapImageSize.w,
      (screenH - FIT_CAMERA_PADDING_PX * 2) / mapImageSize.h,
      FIT_CAMERA_MAX_ZOOM
    );
    vp.camera.setZoom(zoom);
    vp.camera.moveTo(FIT_CAMERA_PAN_OFFSET_X, FIT_CAMERA_PAN_OFFSET_Y);
    vp.requestRender();
  }

  function _initializeBackground(
    vp: Viewport,
    mapImageUrl: string,
    mapImageSize: { w: number; h: number }
  ) {
    // Canonical layers are created synchronously so they always exist on the
    // active viewport, even if image loading completes asynchronously on a
    // different (StrictMode-destroyed) viewport. Migration drops the SDK's
    // empty default "Layer 1".
    ensureCanonicalLayers(vp, 'dm');
    migrateCanvasToContract(vp, 'dm');

    if (!mapImageUrl) return;

    // Use proxied URL for addImage so the SDK can render it on canvas
    // (raw S3 URLs fail silently due to CORS when the SDK loads them)
    const proxiedForCanvas = proxyUrl(mapImageUrl);

    const addImageToCanvas = () => {
      vp.addImage(proxiedForCanvas, { x: 0, y: 0 }, mapImageSize);
      // Lock the image element so arrows won't bind to it
      const allElements = vp.store.getAll();
      const bgImage = allElements[allElements.length - 1];
      if (bgImage) {
        vp.store.update(bgImage.id, { locked: true });
        vp.layerManager.moveElementToLayer(bgImage.id, MAP_LAYER_ID);
      }
      _fitCameraToMap(vp, mapImageSize);
      vp.requestRender();
    };

    // Load via our proxy to guarantee same-origin (no CORS tainting).
    const proxied = proxyUrl(mapImageUrl);
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = addImageToCanvas;
    img.onerror = () => {
      // If proxy fails, try direct URL without CORS — image still
      // displays but PNG export will fall back to JSON sync.
      const retry = new window.Image();
      retry.onload = addImageToCanvas;
      retry.onerror = () => {}; // Layers already set up
      retry.src = mapImageUrl;
    };
    img.src = proxied;
  }

  // Cleanup autosave and sync connection on unmount. Also exits arrange-maps
  // mid-arrange so leaving the page re-locks everything — otherwise the
  // persisted lock flags would stay unlocked.
  useEffect(() => {
    return () => {
      const vp = vpRef.current;
      if (arrangeActiveRef.current && arrangeSessionRef.current && vp) {
        arrangeActiveRef.current = false;
        exitArrangeMaps(vp, arrangeSessionRef.current);
        arrangeSessionRef.current = null;
      }
      autoSaveRef.current?.stop();
      laserCleanupRef.current?.();
      movementCommitUnsubRef.current?.();
      // Disposed after laserCleanupRef (which tears down focusBroadcast) and
      // before the connection stops, matching the pre-existing teardown
      // order tests — even though the animator is no longer connection-
      // scoped, it still needs to go before connectionRef.stop().
      localAnimatorRef.current?.dispose();
      localAnimatorRef.current = null;
      connectionRef.current?.stop();
      pinUnsubRef.current?.();
      hiddenPlacementUnsubRef.current?.();
      markerAddGuardUnsubRef.current?.();
      markerRemovalTrackUnsubRef.current?.();
      selectionUnsubRef.current?.();
    };
  }, []);

  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleToggleArrangeMaps = useCallback(() => {
    const vp = getVp();
    if (!vp) return;
    if (arrangeActiveRef.current) {
      arrangeActiveRef.current = false;
      if (arrangeSessionRef.current) {
        exitArrangeMaps(vp, arrangeSessionRef.current);
        arrangeSessionRef.current = null;
      }
      setArrangeMapsActive(false);
    } else {
      arrangeActiveRef.current = true;
      arrangeSessionRef.current = enterArrangeMaps(vp);
      vp.setTool('select');
      setArrangeMapsActive(true);
    }
  }, [getVp]);

  // ─── Handlers ────────────────────────────────────────────────

  const handleSetGridType = useCallback(
    (type: 'square' | 'hex' | 'off') => {
      const vp = getVp();
      if (!vp) return;

      // Always remove existing grid first
      if (gridEnabled) {
        vp.removeGrid();
      }

      if (type === 'off') {
        setGridEnabled(false);
        storeUpdateLocation(campaignCode, location.id, {
          gridEnabled: false,
        });
        return;
      }

      const settings = {
        gridType: type,
        hexOrientation: type === 'hex' ? ('pointy' as const) : undefined,
        cellSize: gridCellSize,
        strokeColor: gridColor,
        strokeWidth: 1,
        opacity: gridOpacity,
      };
      vp.addGrid(settings);

      pinGridToMapLayer(vp);

      setGridEnabled(true);
      setGridType(type);
      storeUpdateLocation(campaignCode, location.id, {
        gridEnabled: true,
        gridSettings: {
          ...settings,
          hexOrientation: settings.hexOrientation ?? 'pointy',
        },
      });
    },
    [
      gridEnabled,
      getVp,
      campaignCode,
      location.id,
      location.gridSettings,
      storeUpdateLocation,
    ]
  );

  const handleUpdateGridSettings = useCallback(
    (settings: Partial<GridSettings>) => {
      const vp = getVp();
      if (!vp || !gridEnabled) return;

      const currentGs: GridSettings = {
        gridType,
        cellSize: gridCellSize,
        strokeColor: gridColor,
        strokeWidth: 1,
        opacity: gridOpacity,
      };

      const updatedSettings = { ...currentGs, ...settings };
      vp.updateGrid(updatedSettings);

      // Sync local state
      if (settings.cellSize != null) setGridCellSize(settings.cellSize);
      if (settings.strokeColor != null) setGridColor(settings.strokeColor);
      if (settings.opacity != null) setGridOpacity(settings.opacity);

      storeUpdateLocation(campaignCode, location.id, {
        gridSettings: updatedSettings,
      });
    },
    [
      getVp,
      gridEnabled,
      gridType,
      gridCellSize,
      gridColor,
      gridOpacity,
      campaignCode,
      location.id,
      storeUpdateLocation,
    ]
  );

  const handleToggleDmOnly = useCallback(() => {
    if (!selectedElementId) return;

    // Markers move as a sibling SET (§6.4). ONE implementation, shared with
    // `dm-vtt/DmBattleMapCanvas.hooks.ts` — see `markerAudienceToggle.ts`.
    const outcome = applyMarkerAudienceToggle({
      element: getVp()?.store.getById(selectedElementId),
      selectedElementId,
      readDmOnlyElements: () =>
        storeGetLocation(campaignCode, location.id)?.dmOnlyElements ?? {},
      setMarkerAudienceForRef: markerWrites.setMarkerAudienceForRef,
    });
    if (outcome.handled) {
      setMarkerAudienceNotice(outcome.notice);
      // The sibling-marker branch returns before touching the canvas, so
      // `saveAndMarkDirty` never fires. In location mode every audience
      // change affects the public projection (§6.4), so mark dirty here
      // unless the toggle was refused (nothing moved).
      if (mode === 'location' && outcome.notice === null) {
        setHasUnsyncedChanges(true);
      }
      return;
    }

    setMarkerAudienceNotice(null);
    storeToggleDmOnly(campaignCode, location.id, selectedElementId);
    // Location mode: audience affects publication (§6.4). The non-marker
    // branch does not touch the canvas store, so mark dirty explicitly.
    if (mode === 'location') {
      setHasUnsyncedChanges(true);
      return;
    }
    // Battlemap only: re-emit the element so the sync client re-stamps its
    // audience (hide → relay sends players/display a remove; reveal → an
    // upsert).
    const vp = getVp();
    if (vp?.store.getById(selectedElementId)) {
      vp.store.update(selectedElementId, {});
    }
  }, [
    selectedElementId,
    campaignCode,
    location.id,
    storeToggleDmOnly,
    storeGetLocation,
    markerWrites,
    mode,
    getVp,
  ]);

  const handleToggleHiddenPlacement = useCallback(() => {
    setHiddenPlacementActive(current => {
      const next = !current;
      hiddenPlacementActiveRef.current = next;
      return next;
    });
  }, []);

  const handleRevealAll = useCallback(() => {
    if (mode !== 'battlemap') return;
    const vp = getVp();
    if (!vp) return;
    const hiddenIds = Object.keys(
      useBattleMapStore.getState().battleMaps[campaignCode]?.[location.id]
        ?.dmOnlyElements ?? {}
    );
    if (hiddenIds.length === 0) return;

    battleMapStoreUpdate(campaignCode, location.id, { dmOnlyElements: {} });
    // Re-emit surviving elements after clearing their flags. The sync client
    // stamps them for the player audience and publishes an upsert immediately.
    for (const id of hiddenIds) {
      if (vp.store.getById(id)) vp.store.update(id, {});
    }
  }, [mode, getVp, campaignCode, location.id, battleMapStoreUpdate]);

  const handleClear = useCallback(async () => {
    const vp = getVp();
    if (!vp || vp.store.count === 0) return;
    if (!confirm('Clear all elements from the canvas?')) return;
    vp.store.clear();
    await autoSaveRef.current?.clear();
    vp.requestRender();
    setSelectedElementId(null);
  }, [getVp]);

  const handleSyncToPlayers = useCallback(async () => {
    // Battle maps are live-synced via the relay; snapshot push is locations-only.
    if (mode === 'battlemap') return;

    const vp = getVp();
    if (!vp) return;
    setSyncing(true);

    try {
      // Export canvas as PNG, filtering out DM-only elements
      const storedLocation = storeGetLocation(campaignCode, location.id);
      const currentDmOnly = storedLocation?.dmOnlyElements ?? {};

      // Public marker projection (spec §6.4). Derived from the LIVE canvas so
      // an unsaved pin cannot publish a stale audience, falling back to the
      // persisted state. `buildPublicMarkerDetails` fails closed on anything
      // it cannot read, so there is deliberately no second guard here.
      const publicMarkers = buildPublicMarkerDetails({
        canvasState: vp.exportJSON() || storedLocation?.canvasState,
        markers: storedLocation?.markers ?? [],
        dmOnlyElements: currentDmOnly,
        onDroppedRef: info => {
          console.warn(
            `Marker ${info.ref} not published: ${info.reason} — its pins ` +
              'disagree about who may see it.'
          );
        },
      });

      // Try image export first, fall back to JSON if it fails (e.g. CORS)
      let snapshotUrl: string | undefined;
      const filteredState = '';

      let blob: Blob | null = null;
      try {
        blob = await vp.exportImage({
          scale: 2,
          scaleMode: 'fit',
          maxDimension: 4096,
          padding: 0,
          format: 'jpeg',
          quality: 0.85,
          filter: (el: { id: string }) => !currentDmOnly[el.id],
        });
      } catch (error) {
        console.warn('Failed to export image:', error);
        // exportImage can throw on tainted canvas (cross-origin images
        // without CORS). Fall through to JSON fallback.
      }

      if (blob) {
        // Try S3 upload first
        const assetId = `location-${location.id}-${Date.now()}`;
        const formData = new FormData();
        formData.append('file', blob, `${assetId}.jpg`);
        formData.append('assetId', assetId);

        try {
          const uploadRes = await fetch('/api/assets/upload', {
            method: 'POST',
            body: formData,
          });

          if (uploadRes.ok) {
            const data = (await uploadRes.json()) as { url: string };
            snapshotUrl = data.url;
          }
        } catch {
          // S3 not configured or network error — fall through to base64
        }

        // Fall back to base64 data URL if S3 upload didn't work
        if (!snapshotUrl) {
          snapshotUrl = await new Promise<string>(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob!);
          });
        }
      }

      const syncData = {
        id: location.id,
        name: location.name,
        mapImageUrl: location.mapImageUrl,
        mapImageSize: location.mapImageSize,
        snapshotUrl,
        canvasState: filteredState,
        gridEnabled,
        gridSettings: location.gridSettings,
        // One more EXPLICIT field. Never convert this literal to a spread of
        // the stored location: `markers` would then carry `dmNotes`.
        markers: publicMarkers,
        updatedAt: new Date().toISOString(),
      };

      const payload = { dmId, location: syncData };
      const endpoint = `/api/campaign/${campaignCode}/locations/${location.id}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Sync failed with status ${res.status}`);
      }

      setLastSyncedAt(new Date().toISOString());
      setHasUnsyncedChanges(false);
      onSyncToPlayers();
    } catch (error) {
      console.error('Failed to sync location to players:', error);
    } finally {
      setSyncing(false);
    }
  }, [
    getVp,
    campaignCode,
    dmId,
    location,
    gridEnabled,
    mode,
    storeGetLocation,
    onSyncToPlayers,
  ]);

  const getDmOnlyElements = useCallback(
    () => storeGetLocation(campaignCode, location.id)?.dmOnlyElements ?? {},
    [storeGetLocation, campaignCode, location.id]
  );

  const handleImageFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const vp = getVp();
      if (!file || !vp) return;
      e.target.value = '';

      setImageUploading(true);
      const src = await uploadCanvasImage(file);

      const proxiedSrc = proxyUrl(src);
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const maxDim = 400;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const center = vp.camera.screenToWorld({
          x: vp.domLayer.clientWidth / 2,
          y: vp.domLayer.clientHeight / 2,
        });
        // Add the original S3 URL to the canvas (not the proxy URL)
        // so the JSON state stores the canonical URL
        vp.addImage(
          src,
          { x: center.x - w / 2, y: center.y - h / 2 },
          { w, h }
        );
        setImageUploading(false);
      };
      img.onerror = () => setImageUploading(false);
      img.src = proxiedSrc;
    },
    [getVp]
  );

  const handlePickMapImage = useCallback(() => {
    mapImageInputRef.current?.click();
  }, []);

  const handleMapImageFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const vp = getVp();
      if (!file || !vp) return;
      e.target.value = '';

      setImageUploading(true);
      const src = await uploadCanvasImage(file);

      const proxiedSrc = proxyUrl(src);
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Natural size (it's a map, not an annotation) at the right edge of
        // the existing map images. Store the canonical URL, render the proxy.
        const position = nextMapImagePosition(vp.store.getAll());
        const before = new Set(vp.store.getAll().map(el => el.id));
        vp.addImage(src, position, { w: img.width, h: img.height });
        const added = vp.store.getAll().find(el => !before.has(el.id));
        if (added) {
          vp.store.update(added.id, { locked: true });
          vp.layerManager.moveElementToLayer(added.id, MAP_LAYER_ID);
        }
        vp.requestRender();
        setImageUploading(false);
      };
      img.onerror = () => setImageUploading(false);
      img.src = proxiedSrc;
    },
    [getVp]
  );

  const handleOpenTvDisplay = useCallback(
    () => openTvDisplay(campaignCode, location.id, dmId),
    [campaignCode, dmId, location.id]
  );

  const handleFitToMap = useCallback(() => {
    const vp = getVp();
    if (vp) _fitCameraToMap(vp, location.mapImageSize);
  }, [getVp, location.mapImageSize]);

  // Stable across renders; reads the live connection so the layers panel can
  // broadcast panel edits. Setup mode has no connection — silently local.
  const publishLayerUpsert = useCallback((definition: Layer) => {
    connectionRef.current?.publishLayerUpsert(definition);
  }, []);
  const publishLayerRemove = useCallback((id: string) => {
    connectionRef.current?.publishLayerRemove(id);
  }, []);

  const handleGoToCameraView = useCallback((view: CameraView) => {
    localAnimatorRef.current?.animateTo(view);
  }, []);

  const handleSendCameraView = useCallback(
    (view: CameraView, audience: FocusAudience) => {
      focusBroadcastRef.current?.send(view, audience, '#F4C430');
    },
    []
  );

  return {
    mode,
    canvasRef,
    fileInputRef,
    mapImageInputRef,
    viewport,
    tools,
    layersPanelOpen,
    setLayersPanelOpen,
    gridEnabled,
    gridType,
    gridCellSize,
    gridColor,
    gridOpacity,
    handleSetGridType,
    handleUpdateGridSettings,
    dmOnlyElements,
    selectedElementId,
    isDmOnly,
    handleToggleDmOnly,
    hiddenPlacementActive,
    handleToggleHiddenPlacement,
    hiddenElementCount: Object.keys(dmOnlyElements).length,
    handleRevealAll,
    syncing,
    hasUnsyncedChanges,
    lastSyncedAt,
    syncStatus,
    sharedWithPlayers,
    handleToggleShareWithPlayers,
    imageUploading,
    setImageUploading,
    handleReady,
    handlePickImage,
    handleClear,
    handleSyncToPlayers,
    handleImageFileSelect,
    handlePickMapImage,
    handleMapImageFileSelect,
    handleOpenTvDisplay,
    handleFitToMap,
    arrangeMapsActive,
    handleToggleArrangeMaps,
    publishLayerUpsert,
    publishLayerRemove,
    measureSharing,
    handleSetMeasureSharing,
    pathSharing,
    handleSetPathSharing,
    movementDash,
    handleSetMovementDash,
    awarenessRoster,
    cursorSharing,
    handleSetCursorSharing,
    showPlayerCursors,
    handleSetShowPlayerCursors,
    handleGoToCameraView,
    handleSendCameraView,
    getViewport: getVp,
    getDmOnlyElements,
    storeUpdateLocation,
    markerControls,
    selectedElementIsMarker:
      selectedElementId !== null &&
      markerRefForElement(viewport?.store.getById(selectedElementId)) !== null,
    markerAudienceNotice,
    markerPanelOpen: activeMarkerElementId !== null,
    markerPanelState,
    markerPanelIsDmOnly,
    handleSetMarkerAudience,
    handleCloseMarkerPanel,
    handleSaveMarkerDetail,
    handleDeleteMarker,
    portalState,
  };
}
