import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SelectTool,
  PencilTool,
  ArrowTool,
  MeasureTool,
  TemplateTool,
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

export interface DmBattleMapCanvasProps {
  campaignCode: string;
  battleMapId: string;
  dmId: string;
  /** Chrome rendered inside the ViewportContext.Provider. */
  children?: React.ReactNode;
  onStatus?: (status: BattleMapConnectionStatus) => void;
  onViewportReady?: (vp: Viewport) => void;
  tokenConfigRef: React.MutableRefObject<DmTokenConfig | null>;
  /** Select-tool selection changes (element ids) — Task 8 maps to entities. */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Show/hide state for the token decoration layer, surfaced as a toolbar toggle. */
  tokenInfoToggle: { visible: boolean; onToggle: () => void };
}

/** Viewport exposes historyRecorder at runtime for batched store ops. */
type ViewportHistoryAccess = {
  historyRecorder: { begin: () => void; commit: () => void };
};

const DRAWING_TYPES = new Set(['stroke', 'arrow', 'template']);

export interface DmBattleMapCanvasState {
  viewport: Viewport | null;
  status: BattleMapConnectionStatus;
  tools: Tool[];
  handleReady: (vp: Viewport) => void;
  handleClearDrawings: () => void;
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
  onViewportReady,
  tokenConfigRef,
  onSelectionChange,
}: DmBattleMapCanvasProps): DmBattleMapCanvasState {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const autoSaveRef = useRef<AutoSave | null>(null);
  const connectionRef = useRef<{ stop: () => void } | null>(null);

  const tools = useMemo<Tool[]>(() => {
    const selectTool = new SelectTool();
    return [
      new PlayerHandTool(selectTool, el => isCombatantToken(el)),
      selectTool,
      new PencilTool({ color: '#F4C430', width: 2.6 }),
      new ArrowTool({ color: '#F4C430', width: 2 }),
      new MeasureTool({ feetPerCell: 5 }),
      new TemplateTool({
        templateShape: 'circle',
        feetPerCell: 5,
        renderStyle: 'geometric',
      }),
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

      const selectTool = vp.toolManager.getTool<SelectTool>('select');
      selectTool?.onSelectionChange(() => {
        onSelectionChange?.(selectTool.selectedIds);
      });

      // Live sync — resolver reads Zustand LIVE via getState() (a captured
      // snapshot would go stale after the first dm-only toggle).
      const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
      if (relayUrl) {
        connectionRef.current?.stop();
        connectionRef.current = createManagedBattleMapConnection({
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
          onStatus: s => {
            setStatus(s);
            onStatusProp?.(s);
          },
        });
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
      connectionRef.current?.stop();
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
    const { historyRecorder } = viewport as unknown as ViewportHistoryAccess;
    historyRecorder.begin();
    for (const id of ids) {
      viewport.store.remove(id);
    }
    historyRecorder.commit();
    viewport.requestRender();
  }, [viewport]);

  return { viewport, status, tools, handleReady, handleClearDrawings };
}
