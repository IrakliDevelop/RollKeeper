import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SelectTool,
  PencilTool,
  ArrowTool,
  MeasureTool,
  TemplateTool,
  NoteTool,
  TextTool,
  ShapeTool,
  EraserTool,
  LaserTool,
  PingTool,
  AutoSave,
  type CameraAnimator,
  type CameraView,
  type ElementActivationEvent,
  type FocusAudience,
  type PathTool,
  type Tool,
  type Viewport,
} from '@fieldnotes/core';
import { PlayerHandTool } from '@/components/ui/campaign/location-map/PlayerHandTool';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
} from '@/lib/battlemapSync';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useLocationStore } from '@/store/locationStore';
import {
  DmTokenTool,
  isCombatantToken,
  type DmTokenConfig,
} from '@/components/ui/campaign/dm-vtt/combatantToken';
import {
  migrateCanvasToContract,
  subscribePinCanonicalLayers,
} from '@/components/ui/campaign/location-map/layerContract';
import {
  makeApplyRemoteLayer,
  publishOwnedLayers,
} from '@/components/ui/campaign/location-map/layerSync';
import {
  attachLaserBroadcast,
  attachRemoteLaserTrails,
} from '@/components/ui/campaign/location-map/laserSync';
import {
  attachPingBroadcast,
  attachPingInput,
  attachRemotePings,
} from '@/components/ui/campaign/location-map/pingSync';
import {
  attachMeasureBroadcast,
  attachRemoteMeasurements,
  type MeasureBroadcastHandle,
} from '@/components/ui/campaign/location-map/measureSync';
import {
  attachFocusBroadcast,
  createLocalCameraAnimator,
  type FocusBroadcastHandle,
} from '@/components/ui/campaign/location-map/focusSync';
import { createMovementPathTool } from '@/components/ui/campaign/location-map/movementTool';
import { applyMovementCommit } from '@/components/ui/campaign/location-map/movementCommit';
import {
  attachPathBroadcast,
  attachRemotePaths,
  type PathBroadcastHandle,
} from '@/components/ui/campaign/location-map/pathSync';
import { attachAwarenessSync } from '@/components/ui/campaign/location-map/awarenessSync';
import type { AwarenessSyncHandle } from '@/components/ui/campaign/location-map/awarenessSync';
import { attachConnectionScope } from '@/components/ui/campaign/location-map/connectionScope';
import { useDmStore } from '@/store/dmStore';
import type { PeerRoster } from '@fieldnotes/core';
import {
  resolveDmMovement,
  logDmMovement,
} from '@/components/ui/campaign/location-map/movementLogging';
import type { MovableTokenIdentity } from '@/components/ui/campaign/location-map/tokenIdentity';
import {
  DmMarkerTool,
  type PlaceMarkerRequest,
} from '@/components/ui/campaign/location-map/DmMarkerTool';
import { applyMarkerAudienceToggle } from '@/components/ui/campaign/location-map/markerAudienceToggle';
import { MARKER_MIXED_AUDIENCE_MESSAGE } from '@/components/ui/campaign/location-map/markerAudienceCopy';
import { buildPublicMarkerDetails } from '@/components/ui/campaign/location-map/markerPublication';
import { buildMarkerLootLedger } from '@/components/ui/campaign/location-map/markerLootPublication';
import { markerRefForElement } from '@/components/ui/campaign/location-map/markerWrites';
import type { MarkerDataIssue } from '@/components/ui/campaign/location-map/markerPainter';
import { MARKER_DEFAULT_COLOR_KEY } from '@/components/ui/campaign/location-map/markerPainter';
import { DM_AUDIENCE } from '@/components/ui/campaign/location-map/markerData';
import type {
  MarkerColorKey,
  MarkerKind,
} from '@/components/ui/campaign/location-map/markerData';
import {
  CANVAS_WRITING_TOOL_NAMES,
  useMarkerRegistration,
} from '@/components/ui/campaign/location-map/useMarkerRegistration';
import { useCloseMarkerPanelOnRemove } from '@/components/ui/campaign/location-map/useCloseMarkerPanelOnRemove';
import { useMarkerWrites } from '@/components/ui/campaign/location-map/useMarkerWrites';
import { resolveMarkerPanelState } from '@/components/ui/campaign/location-map/MarkerDetailPanel/MarkerDetailPanel.utils';
import type {
  MarkerPanelState,
  PortalTargetChoice,
  ResolvedPortalState,
} from '@/components/ui/campaign/location-map/MarkerDetailPanel/MarkerDetailPanel.types';
import { resolveDmPortalDestination } from '@/components/ui/campaign/location-map/markerPortal';
import type { MarkerToolControls } from '@/components/ui/campaign/location-map/DmLocationToolOptions';

import type { TokenInfoMode } from '@/components/ui/campaign/token-overlay';
import type {
  BattleMap,
  MarkerDetail,
  MarkerPortalTargetV1,
} from '@/types/battlemap';

export interface DmBattleMapCanvasProps {
  campaignCode: string;
  battleMapId: string;
  dmId: string;
  /** Map/session controls rendered as the command dock's first row. */
  sessionControls?: React.ReactNode;
  /** Chrome rendered inside the ViewportContext.Provider. */
  children?: React.ReactNode;
  onStatus?: (status: BattleMapConnectionStatus) => void;
  /** Fires when the relay pokes this room (e.g. 'players' → refetch live HP). */
  onPoke?: (feature: string) => void;
  onViewportReady?: (vp: Viewport) => void;
  tokenConfigRef: React.MutableRefObject<DmTokenConfig | null>;
  /** Select-tool selection changes (element ids) — Task 8 maps to entities. */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Show/hide/compact state for the token decoration layer, surfaced as a toolbar toggle. */
  tokenInfoToggle: { mode: TokenInfoMode | null; onCycle: () => void };
  /** Surfaces export-control failures (e.g. no viewport, blob export threw). */
  onExportError: (message: string) => void;
}

/** Stable identity for an empty campaign record — avoids a fresh `{}` on each
 *  selector call that would defeat Zustand's referential equality check. */
const EMPTY_RECORD: Record<string, { id: string; name: string }> = {};

const DRAWING_TYPES = new Set(['stroke', 'arrow', 'template']);

export interface DmBattleMapCanvasState {
  viewport: Viewport | null;
  status: BattleMapConnectionStatus;
  /** Live store lookup — name/mapImageSize source for the export control. */
  battleMap: BattleMap | undefined;
  tools: Tool[];
  handleReady: (vp: Viewport) => void;
  handleClearDrawings: () => void;
  hiddenPlacementActive: boolean;
  handleToggleHiddenPlacement: () => void;
  hiddenElementCount: number;
  handleRevealAll: () => void;
  selectedElementId: string | null;
  selectedElementIsDmOnly: boolean;
  handleToggleSelectedDmOnly: () => void;
  measureSharing: boolean;
  handleSetMeasureSharing: (enabled: boolean) => void;
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
}

/**
 * Init/persistence/connection wiring for `DmBattleMapCanvas` — mirrors
 * `DmLocationEditor.hooks.ts`'s battlemap-mode path (loadJSON guard, AutoSave
 * + save-on-local-ops with remote-origin filtering, `createManagedBattleMapConnection`
 * with a live `dmOnlyElements` `resolveAudience`) while composing like
 * `PlayerBattleMapCanvas` (tools memo, provider/children seam, teardown).
 */
export function useDmBattleMapCanvas({
  campaignCode,
  battleMapId,
  dmId,
  onStatus: onStatusProp,
  onPoke,
  onViewportReady,
  tokenConfigRef,
  onSelectionChange,
}: DmBattleMapCanvasProps): DmBattleMapCanvasState {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const autoSaveRef = useRef<AutoSave | null>(null);
  const connectionRef = useRef<{ stop: () => void } | null>(null);
  const laserCleanupRef = useRef<(() => void) | null>(null);
  const pinUnsubRef = useRef<(() => void) | null>(null);
  const hiddenPlacementUnsubRef = useRef<(() => void) | null>(null);
  const markerAddGuardUnsubRef = useRef<(() => void) | null>(null);
  const markerRemovalTrackUnsubRef = useRef<(() => void) | null>(null);
  const selectionUnsubRef = useRef<(() => void) | null>(null);
  const [hiddenPlacementActive, setHiddenPlacementActive] = useState(false);
  const hiddenPlacementActiveRef = useRef(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
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

  const linkedEncounterIdsLive = useCallback(
    () =>
      useBattleMapStore.getState().battleMaps[campaignCode]?.[battleMapId]
        ?.linkedEncounterIds ?? [],
    [campaignCode, battleMapId]
  );
  const resolveMovement = useCallback(
    (identity: MovableTokenIdentity) =>
      resolveDmMovement(identity, linkedEncounterIdsLive()),
    [linkedEncounterIdsLive]
  );

  const hiddenElementCount = useBattleMapStore(
    state =>
      Object.keys(
        state.battleMaps[campaignCode]?.[battleMapId]?.dmOnlyElements ?? {}
      ).length
  );
  const selectedElementIsDmOnly = useBattleMapStore(state =>
    selectedElementId
      ? (state.battleMaps[campaignCode]?.[battleMapId]?.dmOnlyElements[
          selectedElementId
        ] ?? false)
      : false
  );
  // Same store-object reference each render unless the record actually
  // changes — safe as a selector return without a custom equality fn.
  const battleMap = useBattleMapStore(
    state => state.battleMaps[campaignCode]?.[battleMapId]
  );
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
    // VTT is always a battle map, so exclude self from battle map choices.
    return Object.values(campaignBattleMaps)
      .filter(bm => bm.id !== battleMapId)
      .map(bm => ({ id: bm.id, name: bm.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [campaignBattleMaps, battleMapId]);

  const portalLocationChoices = useMemo((): PortalTargetChoice[] => {
    // VTT source is always a battle map, so locations never exclude self.
    return Object.values(campaignLocations)
      .map(loc => ({ id: loc.id, name: loc.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [campaignLocations]);

  // The connection is created once inside the fire-once `handleReady`
  // callback; a plain closure over `onPoke` would go stale if the prop's
  // identity changes later (e.g. encounterId change) after the connection
  // is already established. Read the latest value via a ref instead.
  const onPokeRef = useRef(onPoke);
  onPokeRef.current = onPoke;
  const refreshMarkerClaimsRef = useRef<() => Promise<void>>(async () => {});

  // ─── Markers ──────────────────────────────────────────────────
  // Deliberately connection-independent: nothing below reads the relay URL or
  // touches `connectionRef`. Placing and opening markers must work with
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

  // `viewport` is state, so a plain closure over it would be null inside the
  // tool built on the first render. Mirror it into a ref instead.
  const viewportRef = useRef<Viewport | null>(null);
  const getMarkerViewport = useCallback(() => viewportRef.current, []);

  const markerWrites = useMarkerWrites({
    mode: 'battlemap',
    campaignCode,
    mapId: battleMapId,
    getViewport: getMarkerViewport,
  });
  refreshMarkerClaimsRef.current = async () => {
    const response = await fetch(
      `/api/campaign/${campaignCode}/battlemaps/${battleMapId}/markers`
    );
    if (!response.ok) return;
    const data = (await response.json()) as {
      markers?: import('@/types/battlemap').PublicMarkerDetail[];
    };
    for (const publicMarker of data.markers ?? []) {
      const local = markerWrites.markers.find(
        marker => marker.id === publicMarker.id
      );
      if (!local?.loot || !publicMarker.loot) continue;
      const remaining = new Map(
        publicMarker.loot.map(entry => [entry.id, entry.remainingQuantity])
      );
      const loot = local.loot.map(entry => ({
        ...entry,
        claimedQuantity: Math.max(
          entry.claimedQuantity,
          entry.quantity - (remaining.get(entry.id) ?? entry.quantity)
        ),
      }));
      if (
        loot.some(
          (entry, index) =>
            entry.claimedQuantity !== local.loot?.[index]?.claimedQuantity
        )
      ) {
        markerWrites.editMarkerDetail(local.id, { loot });
      }
    }
  };
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

  // The duplicate/paste/context-menu leak guard, reached through a ref for
  // the same reason `handlePlaceMarkerRef` is: the `store.on('add')`
  // subscription is installed once in `handleReady` and outlives every
  // `markerWrites` identity.
  const guardLocalMarkerAddRef = useRef(markerWrites.guardLocalMarkerAdd);
  guardLocalMarkerAddRef.current = markerWrites.guardLocalMarkerAdd;
  // The other half of that guard: what a removal remembers is what lets a
  // later re-add of the same id be recognised as an UNDO rather than a
  // duplicate. Same ref reasoning as above.
  const noteMarkerRemovalRef = useRef(markerWrites.noteMarkerRemoval);
  noteMarkerRemovalRef.current = markerWrites.noteMarkerRemoval;
  // Same reasoning for orphan GC, which runs once per canvas load.
  const gcOrphanMarkerDetailsRef = useRef(markerWrites.gcOrphanMarkerDetails);
  gcOrphanMarkerDetailsRef.current = markerWrites.gcOrphanMarkerDetails;

  const handleMarkerActivate = useCallback((event: ElementActivationEvent) => {
    setActiveMarkerElementId(event.element.id);
  }, []);

  const handleMarkerDataIssue = useCallback((issue: MarkerDataIssue) => {
    // The DM is the operator who can act on a malformed pin (delete it,
    // replace it), so this surface gets the diagnostic and the player /
    // display surfaces stay silent.
    console.warn(
      `[markers] element ${issue.elementId} has ${issue.status} marker data` +
        (issue.reason ? `: ${issue.reason}` : '') +
        (issue.version !== undefined ? ` (v${issue.version})` : '')
    );
  }, []);

  // OUTSIDE the `if (relayUrl)` guard in `handleReady`, and NOT part of
  // `laserCleanups` or any other connection-scoped cleanup: painter
  // registration and activation are connection-independent (spec §7.2).
  useMarkerRegistration({
    viewport,
    gesture: 'double',
    markerDetails: markerWrites.markers,
    onActivateMarker: handleMarkerActivate,
    onMarkerDataIssue: handleMarkerDataIssue,
    isCameraBusy: () => localAnimatorRef.current?.animating ?? false,
    // Read the ACTIVE TOOL at gesture time. Core's activation listens on the
    // wrapper and never consults the tool manager, so without this a
    // double-tap with the marker tool opens a panel over the pin it just
    // placed, and a double-tap with the eraser opens a panel on a pin that
    // has already been deleted.
    isActivationSuppressed: () =>
      CANVAS_WRITING_TOOL_NAMES.has(
        viewportRef.current?.toolManager.activeTool?.name ?? ''
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
    battleMap?.dmOnlyElements[activeMarkerElementId] === true;

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
        battleMapId,
        'battlemap',
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
    battleMapId,
  ]);

  // The relay transports canvas elements, not product-state marker details.
  // Publish the explicit player projection separately, together with the
  // private server-only definitions needed for authoritative loot claims.
  useEffect(() => {
    if (!viewport || !battleMap) return;
    const timeout = window.setTimeout(() => {
      const markers = buildPublicMarkerDetails({
        canvasState: viewport.exportJSON() || battleMap.canvasState,
        markers: markerWrites.markers,
        dmOnlyElements: battleMap.dmOnlyElements,
      });
      const loot = buildMarkerLootLedger(markerWrites.markers, markers);
      void fetch(
        `/api/campaign/${campaignCode}/battlemaps/${battleMapId}/markers`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dmId, markers, loot }),
        }
      ).catch(error => {
        console.warn('Failed to publish marker details:', error);
      });
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [
    battleMap,
    battleMapId,
    campaignCode,
    dmId,
    markerWrites.markers,
    viewport,
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
    },
    [activeMarkerRef, markerWrites]
  );

  // `activeMarkerElement` above is a bare render-time `getById` with no store
  // subscription, so without this the panel would keep showing a pin deleted
  // from another device (or by undo) until an unrelated re-render.
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
      markerWrites.editMarkerDetail(activeMarkerRef, patch);
    },
    [activeMarkerRef, markerWrites]
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

  const tools = useMemo<Tool[]>(() => {
    const selectTool = new SelectTool();
    return [
      new PlayerHandTool(selectTool, el => isCombatantToken(el)),
      selectTool,
      new PencilTool({ color: '#F4C430', width: 2.6 }),
      new ArrowTool({ color: '#F4C430', width: 2 }),
      new ShapeTool({
        shape: 'rectangle',
        strokeColor: '#F4C430',
        strokeWidth: 2,
        fillColor: 'transparent',
      }),
      new TextTool(),
      new NoteTool(),
      new MeasureTool({ feetPerCell: 5 }),
      createMovementPathTool({
        getViewport: () => viewportRef.current,
        role: 'dm',
        resolveMovement,
        isDashActive: () => movementDashRef.current,
      }),
      new TemplateTool({
        templateShape: 'circle',
        feetPerCell: 5,
        renderStyle: 'geometric',
      }),
      new EraserTool({ radius: 12, mode: 'stroke' }),
      // Ephemeral pointer in the DM accent color; trails broadcast as
      // presence when the room connection is up (see attachLaserBroadcast).
      new LaserTool({ color: '#F4C430', width: 3 }),
      // Ephemeral "look here" pulse; taps broadcast as presence when the
      // room connection is up (see attachPingBroadcast).
      new PingTool({ color: '#F4C430' }),
      new DmTokenTool(tokenConfigRef),
      new DmMarkerTool(markerKindRef, markerColorRef, request =>
        handlePlaceMarkerRef.current(request)
      ),
    ];
  }, [tokenConfigRef, resolveMovement]);

  const handleReady = useCallback(
    (vp: Viewport) => {
      setViewport(vp);
      viewportRef.current = vp;

      const battleMap = useBattleMapStore
        .getState()
        .getBattleMap(campaignCode, battleMapId);
      if (battleMap?.canvasState && battleMap.canvasState.trim().length > 0) {
        try {
          vp.loadJSON(battleMap.canvasState);
          // §6.8: the ONLY point orphan GC may run — a fully successful
          // deserialization, with the refs extracted from the very state that
          // was loaded. Anything earlier (or on a canvas that failed to load)
          // would soft-delete details whose pins this client simply could not
          // read. Without a caller the soft delete never happens at all and
          // detail records, `dmNotes` included, accumulate forever.
          gcOrphanMarkerDetailsRef.current(battleMap.canvasState);
        } catch {
          // Corrupt state — start with an empty canvas.
        }
      }

      // Canonical bands + one-shot migration. Runs before the save listeners
      // attach so element moves don't trigger a full-JSON save per element;
      // if anything migrated, persist the result once.
      const migrated = migrateCanvasToContract(vp, 'dm');
      if (migrated) {
        useBattleMapStore
          .getState()
          .updateBattleMap(campaignCode, battleMapId, {
            canvasState: vp.exportJSON(),
            updatedAt: new Date().toISOString(),
          });
      }

      const autoSave = new AutoSave(vp.store, vp.camera, {
        key: `battlemap-canvas-${battleMapId}`,
        debounceMs: 1500,
        layerManager: vp.layerManager,
      });
      autoSave.start();
      autoSaveRef.current = autoSave;

      // Remote-origin ops (relayed from another client) must not thrash
      // zustand/localStorage on every incoming drag frame (mirrors the
      // DmLocationEditor battlemap-mode save path).
      const saveOnLocalOps = (_data: unknown, meta?: { origin?: string }) => {
        if (meta?.origin !== undefined && meta.origin !== 'local') return;
        useBattleMapStore
          .getState()
          .updateBattleMap(campaignCode, battleMapId, {
            canvasState: vp.exportJSON(),
            updatedAt: new Date().toISOString(),
          });
      };
      vp.store.on('add', saveOnLocalOps);
      vp.store.on('remove', saveOnLocalOps);
      vp.store.on('update', saveOnLocalOps);

      // Attach before live sync so a local addition is marked private before
      // the sync client resolves the audience for its first outbound upsert.
      hiddenPlacementUnsubRef.current?.();
      hiddenPlacementUnsubRef.current = vp.store.on('add', (element, meta) => {
        if (
          !hiddenPlacementActiveRef.current ||
          (meta?.origin !== undefined && meta.origin !== 'local')
        ) {
          return;
        }
        useBattleMapStore
          .getState()
          .setDmOnly(campaignCode, battleMapId, element.id, true);
      });

      // Markers are DM-only by DEFAULT, so unlike the hidden-placement
      // listener above this one is unconditional — it is not gated on any
      // toggle. Registered here, BEFORE the live connection below, so the
      // mark lands before the sync client's own `add` listener resolves the
      // element's audience for its first outbound upsert. Registered AFTER
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
      // Play canvas never arranges maps — the annotations layer (DM tokens,
      // notes, text) must stay unlocked, repairing any state persisted locked
      // by the setup editor's arrange-maps mode.
      pinUnsubRef.current = subscribePinCanonicalLayers(vp, () => ({
        annotationsLocked: false,
      }));

      // `viewport.onSelectionChange` is a persistent, viewport-owned emitter
      // (unlike the tool-level one, it works regardless of registration
      // order) and `getSelectedIds()` never surfaces stale ids.
      selectionUnsubRef.current?.();
      selectionUnsubRef.current = vp.onSelectionChange(() => {
        const ids = vp.getSelectedIds();
        setSelectedElementId(ids.length === 1 ? ids[0] : null);
        // A refused mixed-audience notice is about the PREVIOUS selection;
        // once the DM moves on, leaving it attached to no control would
        // mislead rather than explain.
        setMarkerAudienceNotice(null);
        onSelectionChange?.(ids);
      });

      // Local "go to this view" for the DM's own camera. Unlike
      // attachFocusBroadcast below, moving your own camera needs no relay
      // connection at all, so this must run unconditionally here — not
      // inside the `if (relayUrl)` guard — or the Views popover's "go"
      // button silently no-ops for every DM running without
      // NEXT_PUBLIC_BATTLEMAP_RELAY_URL configured. Own cleanup ref (not
      // laserCleanups) because it is not connection-scoped.
      localAnimatorRef.current?.dispose();
      const localAnimator = createLocalCameraAnimator(vp);
      localAnimatorRef.current = localAnimator;

      // Movement commit: connection-independent — moving a token needs no
      // relay connection at all, so this is registered unconditionally here,
      // not inside the `if (relayUrl)` guard below.
      movementCommitUnsubRef.current?.();
      const movementTool = vp.toolManager.getTool<PathTool>('path');
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

      // Live sync — resolver reads Zustand LIVE via getState() (a captured
      // snapshot would go stale after the first dm-only toggle).
      const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
      if (relayUrl) {
        // Re-attach: tear down the OLD connection-scoped handles BEFORE
        // stopping the old connection, so their final frames (awareness
        // `cleared`, measure/path clears) ride the still-live socket —
        // the same order the unmount effect uses.
        laserCleanupRef.current?.();
        laserCleanupRef.current = null;
        connectionRef.current?.stop();
        connectionRef.current = null;
        const connection = createManagedBattleMapConnection({
          relayUrl,
          campaignCode,
          battleMapId,
          store: vp.store,
          clientId: dmId,
          tokenRequest: { role: 'dm', battleMapId, dmId },
          seedLocal: true,
          resolveAudience: el =>
            useBattleMapStore.getState().battleMaps[campaignCode]?.[battleMapId]
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
            setStatus(s);
            onStatusProp?.(s);
            // Managed sendPresence drops while not live, so the attach-time
            // frame may be lost; announce on every live transition (first
            // connect AND reconnect) — the heartbeat self-heals otherwise.
            if (s === 'live') awarenessRef.current?.announce();
          },
          onPoke: feature => {
            if (feature === 'markers') void refreshMarkerClaimsRef.current();
            onPokeRef.current?.(feature);
          },
        });
        connectionRef.current = connection;
        // Teach peers and late joiners the custom layers persisted in this
        // canvas (created before layer sync, or on another device). Ledger
        // buffers until the first snapshot if the socket is still connecting.
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
                      battleMapId
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

      onViewportReady?.(vp);
    },
    [
      campaignCode,
      battleMapId,
      dmId,
      onStatusProp,
      onViewportReady,
      onSelectionChange,
      resolveMovement,
      linkedEncounterIdsLive,
    ]
  );

  useEffect(() => {
    return () => {
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
      // Disposed here for the same reason as every other store subscription;
      // its absence was an oversight (the location editor already did it).
      hiddenPlacementUnsubRef.current?.();
      markerAddGuardUnsubRef.current?.();
      markerRemovalTrackUnsubRef.current?.();
      selectionUnsubRef.current?.();
    };
  }, []);

  const handleClearDrawings = useCallback(() => {
    if (!viewport) return;
    const ids = viewport.store
      .snapshot()
      .filter(el => DRAWING_TYPES.has(el.type))
      .map(el => el.id);
    if (ids.length === 0) return;
    if (!window.confirm('Clear all drawings (pencil, arrows, templates)?')) {
      return;
    }
    viewport.removeElements(ids);
  }, [viewport]);

  const handleToggleHiddenPlacement = useCallback(() => {
    setHiddenPlacementActive(current => {
      const next = !current;
      hiddenPlacementActiveRef.current = next;
      return next;
    });
  }, []);

  const handleRevealAll = useCallback(() => {
    if (!viewport) return;
    const hiddenIds = Object.keys(
      useBattleMapStore.getState().battleMaps[campaignCode]?.[battleMapId]
        ?.dmOnlyElements ?? {}
    );
    if (hiddenIds.length === 0) return;
    useBattleMapStore
      .getState()
      .updateBattleMap(campaignCode, battleMapId, { dmOnlyElements: {} });
    for (const id of hiddenIds) {
      if (viewport.store.getById(id)) viewport.store.update(id, {});
    }
  }, [viewport, campaignCode, battleMapId]);

  const handleGoToCameraView = useCallback((view: CameraView) => {
    localAnimatorRef.current?.animateTo(view);
  }, []);

  const handleSendCameraView = useCallback(
    (view: CameraView, audience: FocusAudience) => {
      focusBroadcastRef.current?.send(view, audience, '#F4C430');
    },
    []
  );

  const handleToggleSelectedDmOnly = useCallback(() => {
    if (!viewport || !selectedElementId) return;

    // Markers move as a sibling SET (§6.4). ONE implementation, shared with
    // `DmLocationEditor.hooks.ts` — see `markerAudienceToggle.ts`.
    const outcome = applyMarkerAudienceToggle({
      element: viewport.store.getById(selectedElementId),
      selectedElementId,
      readDmOnlyElements: () =>
        useBattleMapStore.getState().battleMaps[campaignCode]?.[battleMapId]
          ?.dmOnlyElements ?? {},
      setMarkerAudienceForRef: markerWrites.setMarkerAudienceForRef,
    });
    if (outcome.handled) {
      setMarkerAudienceNotice(outcome.notice);
      return;
    }

    setMarkerAudienceNotice(null);
    useBattleMapStore
      .getState()
      .toggleDmOnly(campaignCode, battleMapId, selectedElementId);
    if (viewport.store.getById(selectedElementId)) {
      viewport.store.update(selectedElementId, {});
    }
  }, [viewport, selectedElementId, campaignCode, battleMapId, markerWrites]);

  return {
    viewport,
    status,
    battleMap,
    tools,
    handleReady,
    handleClearDrawings,
    hiddenPlacementActive,
    handleToggleHiddenPlacement,
    hiddenElementCount,
    handleRevealAll,
    selectedElementId,
    selectedElementIsDmOnly,
    handleToggleSelectedDmOnly,
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
