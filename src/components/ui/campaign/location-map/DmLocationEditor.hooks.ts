'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  HandTool,
  SelectTool,
  ArrowTool,
  NoteTool,
  ImageTool,
  TextTool,
  ShapeTool,
  AutoSave,
  type Tool,
  type Viewport,
} from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';
import { useLocationStore } from '@/store/locationStore';
import { useBattleMapStore } from '@/store/battleMapStore';
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
 * Map + grid must live on a layer-locked background so hit-testing skips them
 * (see @fieldnotes/core InputHandler / SelectTool + `isLayerLocked`).
 * Grid elements must also be `locked` so Select cannot drag them (otherwise they
 * appear to slide when panning/zooming).
 */
function pinGridToMapBackgroundLayer(vp: Viewport) {
  let layers = vp.layerManager.getLayers();
  if (layers.length === 0) return;

  if (layers.length === 1) {
    vp.layerManager.createLayer('Annotations');
    layers = vp.layerManager.getLayers();
  }

  const bgLayer = layers[0];
  vp.layerManager.renameLayer(bgLayer.id, 'Map Background');

  if (vp.layerManager.activeLayerId === bgLayer.id) {
    const fallback = layers.find(l => l.id !== bgLayer.id);
    if (fallback) {
      vp.layerManager.setActiveLayer(fallback.id);
    }
  }

  vp.layerManager.setLayerLocked(bgLayer.id, true);

  for (const g of vp.store.getElementsByType('grid')) {
    vp.layerManager.moveElementToLayer(g.id, bgLayer.id);
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
  handleOpenTvDisplay: () => void;
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

  // Build tools once — no PencilTool or EraserTool for the location editor
  const tools = useMemo<Tool[]>(
    () => [
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
    ],
    []
  );

  const getVp = useCallback(() => canvasRef.current?.viewport ?? null, []);

  const handleReady = useCallback(
    (vp: Viewport) => {
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
          pinGridToMapBackgroundLayer(vp);
          _fitCameraToMap(vp, location.mapImageSize);
          // Clear stale localStorage data after successful load
          autoSave.clear();
        } catch {
          // Corrupt state — start fresh
          _initializeBackground(
            vp,
            location.mapImageUrl,
            location.mapImageSize
          );
        }
      } else {
        // New location — place the map image as a locked background on the base layer
        _initializeBackground(vp, location.mapImageUrl, location.mapImageSize);
      }

      autoSave.start();
      autoSaveRef.current = autoSave;

      // Wire autosave to also call onSave so parent can persist to store
      const saveAndMarkDirty = () => {
        const json = vp.exportJSON();
        onSave(json);
        setHasUnsyncedChanges(true);
      };
      vp.store.on('add', saveAndMarkDirty);
      vp.store.on('remove', saveAndMarkDirty);
      vp.store.on('update', saveAndMarkDirty);
    },
    [location, onSave]
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
    // Set up layers synchronously so they're always created on the
    // active viewport, even if image loading completes asynchronously
    // on a different (StrictMode-destroyed) viewport.
    const baseLayer = vp.layerManager.getLayers()[0];
    if (baseLayer) {
      vp.layerManager.renameLayer(baseLayer.id, 'Map Background');
      vp.layerManager.setLayerLocked(baseLayer.id, true);
    }
    const annotationLayer = vp.layerManager.createLayer('Annotations');
    vp.layerManager.setActiveLayer(annotationLayer.id);

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
        // Ensure image is on the background layer
        if (baseLayer) {
          vp.layerManager.moveElementToLayer(bgImage.id, baseLayer.id);
        }
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

  // Cleanup autosave on unmount
  useEffect(() => {
    return () => {
      autoSaveRef.current?.stop();
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

      pinGridToMapBackgroundLayer(vp);

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
  }, [selectedElementId, campaignCode, location.id, storeToggleDmOnly]);

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

  const handleClear = useCallback(() => {
    const vp = getVp();
    if (!vp || vp.store.count === 0) return;
    if (!confirm('Clear all elements from the canvas?')) return;
    vp.store.clear();
    autoSaveRef.current?.clear();
    vp.requestRender();
    setSelectedElementId(null);
  }, [getVp]);

  const handleSyncToPlayers = useCallback(async () => {
    const vp = getVp();
    if (!vp) return;
    setSyncing(true);

    try {
      // Export canvas as PNG, filtering out DM-only elements
      const currentDmOnly =
        storeGetLocation(campaignCode, location.id)?.dmOnlyElements ?? {};

      // Try image export first, fall back to JSON if it fails (e.g. CORS)
      let snapshotUrl: string | undefined;
      let filteredState = '';

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

        // Convert PNG → JPEG for battle map sync (display-only, much smaller)
        if (pngBlob && mode === 'battlemap') {
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
        } else {
          blob = pngBlob;
        }
      } catch (error) {
        console.warn('Failed to export image:', error);
        // exportImage can throw on tainted canvas (cross-origin images
        // without CORS). Fall through to JSON fallback.
      }

      const ext = mode === 'battlemap' ? 'jpg' : 'png';
      if (blob) {
        // Upload snapshot to S3
        const assetId = `location-${location.id}-${Date.now()}`;
        const formData = new FormData();
        formData.append('file', blob, `${assetId}.${ext}`);
        formData.append('assetId', assetId);

        const uploadRes = await fetch('/api/assets/upload', {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const data = (await uploadRes.json()) as { url: string };
          snapshotUrl = data.url;
        }
      }

      // Fall back to JSON canvas state if image export didn't work
      if (!snapshotUrl) {
        const json = vp.exportJSON();
        const parsed = JSON.parse(json) as {
          elements: Array<{ id: string }>;
          [key: string]: unknown;
        };
        const filteredElements = parsed.elements.filter(
          (el: { id: string }) => !currentDmOnly[el.id]
        );
        filteredState = JSON.stringify({
          ...parsed,
          elements: filteredElements,
        });
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

      // In battlemap mode, broadcast locally for instant TV display updates
      if (mode === 'battlemap') {
        try {
          const channel = new BroadcastChannel(
            `battlemap:${campaignCode}:${location.id}`
          );
          channel.postMessage(syncData);
          channel.close();
        } catch {
          // BroadcastChannel not supported — Redis fallback handles it
        }
      }

      const payloadKey = mode === 'battlemap' ? 'battleMap' : 'location';
      const payload = {
        dmId,
        [payloadKey]: syncData,
      };

      const endpoint =
        mode === 'battlemap'
          ? `/api/campaign/${campaignCode}/battlemaps/${location.id}`
          : `/api/campaign/${campaignCode}/locations/${location.id}`;

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

  const handleOpenTvDisplay = useCallback(() => {
    window.open(
      `/dm/campaign/${campaignCode}/battlemaps/${location.id}/display`,
      '_blank'
    );
  }, [campaignCode, location.id]);

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
