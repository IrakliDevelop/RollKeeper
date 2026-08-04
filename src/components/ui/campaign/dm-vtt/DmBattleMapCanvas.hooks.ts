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
  type Tool,
  type Viewport,
} from '@fieldnotes/core';
import { PlayerHandTool } from '@/components/ui/campaign/location-map/PlayerHandTool';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
} from '@/lib/battlemapSync';
import { useBattleMapStore } from '@/store/battleMapStore';
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

import type { TokenInfoMode } from '@/components/ui/campaign/token-overlay';

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
}

const DRAWING_TYPES = new Set(['stroke', 'arrow', 'template']);

export interface DmBattleMapCanvasState {
  viewport: Viewport | null;
  status: BattleMapConnectionStatus;
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
  const [hiddenPlacementActive, setHiddenPlacementActive] = useState(false);
  const hiddenPlacementActiveRef = useRef(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
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
  // The connection is created once inside the fire-once `handleReady`
  // callback; a plain closure over `onPoke` would go stale if the prop's
  // identity changes later (e.g. encounterId change) after the connection
  // is already established. Read the latest value via a ref instead.
  const onPokeRef = useRef(onPoke);
  onPokeRef.current = onPoke;

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
    ];
  }, [tokenConfigRef]);

  const handleReady = useCallback(
    (vp: Viewport) => {
      setViewport(vp);

      const battleMap = useBattleMapStore
        .getState()
        .getBattleMap(campaignCode, battleMapId);
      if (battleMap?.canvasState && battleMap.canvasState.trim().length > 0) {
        try {
          vp.loadJSON(battleMap.canvasState);
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

      pinUnsubRef.current?.();
      // Play canvas never arranges maps — the annotations layer (DM tokens,
      // notes, text) must stay unlocked, repairing any state persisted locked
      // by the setup editor's arrange-maps mode.
      pinUnsubRef.current = subscribePinCanonicalLayers(vp, () => ({
        annotationsLocked: false,
      }));

      const selectTool = vp.toolManager.getTool<SelectTool>('select');
      selectTool?.onSelectionChange(() => {
        setSelectedElementId(
          selectTool.selectedIds.length === 1 ? selectTool.selectedIds[0] : null
        );
        onSelectionChange?.(selectTool.selectedIds);
      });

      // Live sync — resolver reads Zustand LIVE via getState() (a captured
      // snapshot would go stale after the first dm-only toggle).
      const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
      if (relayUrl) {
        connectionRef.current?.stop();
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
              ? 'dm'
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
          },
          onPoke: feature => onPokeRef.current?.(feature),
        });
        connectionRef.current = connection;
        // Teach peers and late joiners the custom layers persisted in this
        // canvas (created before layer sync, or on another device). Ledger
        // buffers until the first snapshot if the socket is still connecting.
        publishOwnedLayers(vp, 'dm', def => connection.publishLayerUpsert(def));

        // Laser pointer + map pings: broadcast this DM's, render everyone
        // else's.
        laserCleanupRef.current?.();
        const remotePings = attachRemotePings(vp, connection);
        const laserCleanups = [
          attachRemoteLaserTrails(vp, connection),
          remotePings.dispose,
        ];
        const laserTool = vp.toolManager.getTool<LaserTool>('laser');
        if (laserTool) {
          laserCleanups.push(attachLaserBroadcast(laserTool, connection));
        }
        const pingTool = vp.toolManager.getTool<PingTool>('ping');
        if (pingTool) {
          laserCleanups.push(attachPingBroadcast(pingTool, connection));
        }
        // Always-available DM pings: long-press with any tool + "P" at the
        // cursor, self-pulse through the shared receive overlay. The veto
        // skips the ping tool, whose own tap already pinged on pointer down.
        laserCleanups.push(
          attachPingInput(vp, remotePings.overlay, connection, {
            color: '#F4C430',
            // Options-bar swatch changes restyle long-press/hotkey pings too.
            ...(pingTool ? { followTool: pingTool } : {}),
            hotkey: 'p',
            shouldPing: () => vp.toolManager.activeTool?.name !== 'ping',
          })
        );
        laserCleanupRef.current = () => {
          for (const cleanup of laserCleanups) cleanup();
        };
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
    ]
  );

  useEffect(() => {
    return () => {
      autoSaveRef.current?.stop();
      laserCleanupRef.current?.();
      connectionRef.current?.stop();
      pinUnsubRef.current?.();
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

  const handleToggleSelectedDmOnly = useCallback(() => {
    if (!viewport || !selectedElementId) return;
    useBattleMapStore
      .getState()
      .toggleDmOnly(campaignCode, battleMapId, selectedElementId);
    if (viewport.store.getById(selectedElementId)) {
      viewport.store.update(selectedElementId, {});
    }
  }, [viewport, selectedElementId, campaignCode, battleMapId]);

  return {
    viewport,
    status,
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
  };
}
