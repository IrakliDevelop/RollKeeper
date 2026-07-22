'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  AutoSave,
  type Tool,
  type Viewport,
} from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';
import { useLocationStore } from '@/store/locationStore';
import { useBattleMapStore } from '@/store/battleMapStore';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
} from '@/lib/battlemapSync';
import { openTvDisplay } from '@/lib/openTvDisplay';
import { useShareWithPlayers } from './useShareWithPlayers';
import {
  ensureCanonicalLayers,
  migrateCanvasToContract,
  mirrorUnknownLayer,
  subscribePinCanonicalLayers,
  MAP_LAYER_ID,
} from './layerContract';
import type { DmLocationEditorProps } from './DmLocationEditor.types';
import type { GridSettings } from '@/types/location';

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

/** Viewport exposes historyRecorder at runtime for batched store ops */
type ViewportHistoryAccess = {
  historyRecorder: { begin: () => void; commit: () => void };
};

/**
 * Map + grid must live on the layer-locked map layer so hit-testing skips
 * them (see @fieldnotes/core InputHandler / SelectTool + `isLayerLocked`).
 * Grid elements must also be `locked` so Select cannot drag them (otherwise
 * they appear to slide when panning/zooming).
 */
function pinGridToMapLayer(vp: Viewport) {
  ensureCanonicalLayers(vp, 'dm');
  for (const g of vp.store.getElementsByType('grid')) {
    vp.layerManager.moveElementToLayer(g.id, MAP_LAYER_ID);
    vp.store.update(g.id, { locked: true });
  }
  vp.requestRender();
}

export interface DmLocationEditorState {
  // Mode
  mode: 'location' | 'battlemap';

  // Refs
  canvasRef: React.RefObject<FieldNotesCanvasRef | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

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
  handleDownloadExport: () => Promise<void>;
  handleDeleteSelected: () => void;
  handleClear: () => void;
  handleSyncToPlayers: () => Promise<void>;
  handleImageFileSelect: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => Promise<void>;
  handleOpenTvDisplay: () => Promise<void>;
  handleFitToMap: () => void;
}

export function useDmLocationEditor(
  props: DmLocationEditorProps
): DmLocationEditorState {
  const { location, campaignCode, dmId, onSave, onSyncToPlayers } = props;
  const mode = props.mode ?? 'location';

  const canvasRef = useRef<FieldNotesCanvasRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveRef = useRef<AutoSave | null>(null);
  const connectionRef = useRef<{ stop: () => void } | null>(null);
  const pinUnsubRef = useRef<(() => void) | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    BattleMapConnectionStatus | 'disabled'
  >('disabled');

  const [viewport, setViewport] = useState<Viewport | null>(null);

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

  // Loading states
  const [syncing, setSyncing] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  // Sync status
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(true);

  // Share with players (battlemap mode only) — hydrated from server truth
  const { sharedWithPlayers, handleToggleShareWithPlayers } =
    useShareWithPlayers(campaignCode, dmId, location, mode === 'battlemap');

  // Build tools once — no PencilTool or EraserTool for the location editor
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
        new TemplateTool({
          templateShape: 'circle',
          feetPerCell: 5,
          fillColor: '#ef444480',
          strokeColor: '#ef4444',
          strokeWidth: 2,
          renderStyle: 'geometric',
        })
      );
    }

    return baseTools;
  }, [mode]);

  const getVp = useCallback(() => canvasRef.current?.viewport ?? null, []);

  const handleReady = useCallback(
    async (vp: Viewport) => {
      setViewport(vp);

      // Track selected element for DM-only toggle
      const syncSelection = () => {
        const selectTool = vp.toolManager.getTool<SelectTool>('select');
        if (!selectTool || vp.toolManager.activeTool?.name !== 'select') {
          setSelectedElementId(null);
          return;
        }
        const ids = selectTool.selectedIds.filter((id: string) =>
          vp.store.getById(id)
        );
        setSelectedElementId(ids.length === 1 ? ids[0] : null);
      };

      const wrapper = vp.domLayer.parentElement;
      if (wrapper) {
        wrapper.addEventListener('pointerup', syncSelection, { passive: true });
        wrapper.addEventListener('pointerdown', syncSelection, {
          passive: true,
        });
      }
      vp.toolManager.onChange(syncSelection);
      vp.store.on('remove', syncSelection);
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
          const migrated = migrateCanvasToContract(vp, 'dm');
          pinGridToMapLayer(vp);
          _fitCameraToMap(vp, location.mapImageSize);
          // Clear stale localStorage data after successful load
          await autoSave.clear();
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

      // Layers aren't synced: player tokens arrive referencing player-*
      // layer ids that don't exist on this canvas and would sort at layer
      // order 0 — UNDER the annotations layer where DM-added images live.
      // Mirror unknown layers into their canonical band instead.
      vp.store.on('add', el => {
        if (el.layerId && !vp.layerManager.getLayer(el.layerId)) {
          mirrorUnknownLayer(vp, el.layerId, 'dm');
          vp.requestRender();
        }
      });
      pinUnsubRef.current?.();
      pinUnsubRef.current = subscribePinCanonicalLayers(vp);

      // Live sync — battlemap mode only; resolver reads Zustand LIVE via
      // getState() (a captured snapshot would go stale after the first toggle).
      if (mode === 'battlemap' && process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL) {
        connectionRef.current?.stop();
        connectionRef.current = createManagedBattleMapConnection({
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
              ? 'dm'
              : undefined,
          onStatus: setSyncStatus,
        });
      }
    },
    [location, onSave, mode, campaignCode, dmId]
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

  // Cleanup autosave and sync connection on unmount
  useEffect(() => {
    return () => {
      autoSaveRef.current?.stop();
      connectionRef.current?.stop();
      pinUnsubRef.current?.();
    };
  }, []);

  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
    storeToggleDmOnly(campaignCode, location.id, selectedElementId);
    // Battlemap only: re-emit the element so the sync client re-stamps its
    // audience (hide → relay sends players/display a remove; reveal → an
    // upsert). Location mode has no relay — touching there would just fire
    // saveAndMarkDirty and flip the sync indicator on a pure visibility toggle.
    if (mode !== 'battlemap') return;
    const vp = getVp();
    if (vp?.store.getById(selectedElementId)) {
      vp.store.update(selectedElementId, {});
    }
  }, [
    selectedElementId,
    campaignCode,
    location.id,
    storeToggleDmOnly,
    mode,
    getVp,
  ]);

  const handleDeleteSelected = useCallback(() => {
    const vp = getVp();
    if (!vp) return;
    if (vp.toolManager.activeTool?.name !== 'select') return;
    const selectTool = vp.toolManager.getTool<SelectTool>('select');
    if (!selectTool) return;
    const ids = selectTool.selectedIds.filter((id: string) =>
      vp.store.getById(id)
    );
    if (ids.length === 0) return;
    const { historyRecorder } = vp as unknown as ViewportHistoryAccess;
    historyRecorder.begin();
    for (const id of ids) {
      vp.store.remove(id);
    }
    historyRecorder.commit();
    vp.requestRender();
    setSelectedElementId(null);
  }, [getVp]);

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
      const currentDmOnly =
        storeGetLocation(campaignCode, location.id)?.dmOnlyElements ?? {};

      // Try image export first, fall back to JSON if it fails (e.g. CORS)
      let snapshotUrl: string | undefined;
      const filteredState = '';

      let blob: Blob | null = null;
      try {
        // Cap export so the largest dimension stays under 4096px
        // to avoid massive PNGs on large maps
        const maxDim = Math.max(
          location.mapImageSize.w,
          location.mapImageSize.h
        );
        const exportScale = maxDim > 2048 ? 1 : 2;
        const pngBlob = await vp.exportImage({
          scale: exportScale,
          padding: 0,
          filter: (el: { id: string }) => !currentDmOnly[el.id],
        });

        // Convert PNG → JPEG for sync (display-only, much smaller)
        if (pngBlob) {
          blob = await new Promise<Blob | null>(resolve => {
            const img = new window.Image();
            img.onload = () => {
              const cvs = document.createElement('canvas');
              cvs.width = img.width;
              cvs.height = img.height;
              const ctx = cvs.getContext('2d');
              if (!ctx) {
                resolve(pngBlob);
                return;
              }
              ctx.drawImage(img, 0, 0);
              cvs.toBlob(
                jpegBlob => resolve(jpegBlob ?? pngBlob),
                'image/jpeg',
                0.85
              );
            };
            img.onerror = () => resolve(pngBlob);
            img.src = URL.createObjectURL(pngBlob);
          });
        }
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

  const handleDownloadExport = useCallback(async () => {
    const vp = getVp();
    if (!vp) return;
    const currentDmOnly =
      storeGetLocation(campaignCode, location.id)?.dmOnlyElements ?? {};
    try {
      const maxDim = Math.max(location.mapImageSize.w, location.mapImageSize.h);
      const exportScale = maxDim > 2048 ? 1 : 2;
      const blob = await vp.exportImage({
        scale: exportScale,
        padding: 0,
        filter: (el: { id: string }) => !currentDmOnly[el.id],
      });
      if (!blob) {
        console.warn('Export returned null');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${location.name || 'map'}-export.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [
    getVp,
    campaignCode,
    location.id,
    location.name,
    location.mapImageSize,
    storeGetLocation,
  ]);

  const handleImageFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const vp = getVp();
      if (!file || !vp) return;
      e.target.value = '';

      setImageUploading(true);

      let src: string;
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
        src = data.url as string;
      } catch {
        // Fall back to base64 if S3 not configured
        src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

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

  const handleOpenTvDisplay = useCallback(
    () => openTvDisplay(campaignCode, location.id, dmId),
    [campaignCode, dmId, location.id]
  );

  const handleFitToMap = useCallback(() => {
    const vp = getVp();
    if (vp) _fitCameraToMap(vp, location.mapImageSize);
  }, [getVp, location.mapImageSize]);

  return {
    mode,
    canvasRef,
    fileInputRef,
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
    handleDeleteSelected,
    handleClear,
    handleSyncToPlayers,
    handleDownloadExport,
    handleImageFileSelect,
    handleOpenTvDisplay,
    handleFitToMap,
  };
}
