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
  type ShapeKind,
  type Layer,
  type Viewport,
} from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';
import { useLocationStore } from '@/store/locationStore';
import type { DmLocationEditorProps } from './DmLocationEditor.types';
import type { GridSettings } from '@/types/location';

/** Viewport exposes historyRecorder at runtime for batched store ops */
type ViewportHistoryAccess = {
  historyRecorder: { begin: () => void; commit: () => void };
};

export interface DmLocationEditorState {
  // Refs
  canvasRef: React.RefObject<FieldNotesCanvasRef | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Tools
  tools: Tool[];
  activeTool: string;

  // Tool options — arrow
  arrowColor: string;
  setArrowColor: (c: string) => void;

  // Tool options — note
  noteColor: string;
  setNoteColor: (c: string) => void;
  noteTextColor: string;
  setNoteTextColor: (c: string) => void;

  // Tool options — text
  textColor: string;
  setTextColor: (c: string) => void;
  textFontSize: number;
  setTextFontSize: (n: number) => void;
  textAlign: 'left' | 'center' | 'right';
  setTextAlign: (a: 'left' | 'center' | 'right') => void;

  // Tool options — shape
  shapeKind: ShapeKind;
  setShapeKind: (k: ShapeKind) => void;
  shapeStrokeColor: string;
  setShapeStrokeColor: (c: string) => void;
  shapeStrokeWidth: number;
  setShapeStrokeWidth: (n: number) => void;
  shapeFillColor: string;
  setShapeFillColor: (c: string) => void;

  // Layers
  layers: Layer[];
  activeLayerId: string;
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

  // Undo / redo
  canUndo: boolean;
  canRedo: boolean;

  // Counts
  elementCount: number;
  zoom: number;

  // Loading states
  syncing: boolean;
  imageUploading: boolean;
  setImageUploading: (v: boolean) => void;

  // Sync status
  hasUnsyncedChanges: boolean;
  lastSyncedAt: string | null;

  // Handlers
  handleReady: (vp: Viewport) => void;
  handleToolChange: (name: string) => void;
  handleDownloadExport: () => Promise<void>;
  handleUndo: () => void;
  handleRedo: () => void;
  handleDeleteSelected: () => void;
  handleClear: () => void;
  handleSyncToPlayers: () => Promise<void>;
  handleImageFileSelect: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => Promise<void>;
}

export function useDmLocationEditor(
  props: DmLocationEditorProps
): DmLocationEditorState {
  const { location, campaignCode, dmId, onSave, onSyncToPlayers } = props;

  const canvasRef = useRef<FieldNotesCanvasRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveRef = useRef<AutoSave | null>(null);

  // Tool state
  const [activeTool, setActiveTool] = useState('hand');

  // Tool options
  const [arrowColor, setArrowColor] = useState('#334155');
  const [noteColor, setNoteColor] = useState('#fef08a');
  const [noteTextColor, setNoteTextColor] = useState('#334155');
  const [textColor, setTextColor] = useState('#334155');
  const [textFontSize, setTextFontSize] = useState(16);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(
    'left'
  );
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle');
  const [shapeStrokeColor, setShapeStrokeColor] = useState('#334155');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(2);
  const [shapeFillColor, setShapeFillColor] = useState('transparent');

  // Layer state
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState('');
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

  // DM-only state — pull from store
  const storeGetLocation = useLocationStore(s => s.getLocation);
  const storeToggleDmOnly = useLocationStore(s => s.toggleDmOnly);
  const storeUpdateLocation = useLocationStore(s => s.updateLocation);
  const currentLocation = storeGetLocation(campaignCode, location.id);
  const dmOnlyElements = currentLocation?.dmOnlyElements ?? {};
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
  const isDmOnly =
    selectedElementId != null
      ? (dmOnlyElements[selectedElementId] ?? false)
      : false;

  // Undo / redo
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Counts
  const [elementCount, setElementCount] = useState(0);
  const [zoom, setZoom] = useState(1);

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
      // Store event subscriptions
      vp.store.on('add', () => setElementCount(vp.store.count));
      vp.store.on('remove', () => setElementCount(vp.store.count));
      vp.store.on('clear', () => setElementCount(0));

      vp.toolManager.onChange(name => setActiveTool(name));
      vp.camera.onChange(() => setZoom(vp.camera.zoom));
      vp.history.onChange(() => {
        setCanUndo(vp.history.canUndo);
        setCanRedo(vp.history.canRedo);
      });

      // Layer sync
      const syncLayers = () => {
        setLayers([...vp.layerManager.getLayers()]);
        setActiveLayerId(vp.layerManager.activeLayerId);
      };
      vp.layerManager.on('change', syncLayers);
      syncLayers();

      // Track selected element for DM-only toggle
      const syncSelection = () => {
        const selectTool = vp.toolManager.getTool<SelectTool>('select');
        if (!selectTool || vp.toolManager.activeTool?.name !== 'select') {
          setSelectedElementId(null);
          return;
        }
        const ids = selectTool.selectedIds.filter(id => vp.store.getById(id));
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
          setElementCount(vp.store.count);
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

  function _initializeBackground(
    vp: Viewport,
    mapImageUrl: string,
    mapImageSize: { w: number; h: number }
  ) {
    if (!mapImageUrl) return;
    // Pre-load the image so the SDK has it in the browser cache before rendering
    const setupCanvas = () => {
      vp.addImage(mapImageUrl, { x: 0, y: 0 }, mapImageSize);
      // Lock the image element itself so arrows won't bind to it
      const allElements = vp.store.getAll();
      const bgImage = allElements[allElements.length - 1];
      if (bgImage) {
        vp.store.update(bgImage.id, { locked: true });
      }
      // Lock the base layer so the background image stays in place
      const baseLayer = vp.layerManager.getLayers()[0];
      if (baseLayer) {
        baseLayer.name = 'Map Background';
        vp.layerManager.setLayerLocked(baseLayer.id, true);
      }
      // Create an annotation layer for the DM to draw on
      const annotationLayer = vp.layerManager.createLayer('Annotations');
      vp.layerManager.setActiveLayer(annotationLayer.id);
      setElementCount(vp.store.count);
      // Center camera on the map image — moveTo sets the top-left of
      // the viewport in world coords, so offset by half the screen size
      const screenW = vp.domLayer.clientWidth;
      const screenH = vp.domLayer.clientHeight;
      vp.camera.setZoom(1);
      vp.camera.moveTo(
        mapImageSize.w / 2 - screenW / 2,
        mapImageSize.h / 2 - screenH / 2
      );
      vp.requestRender();
    };

    const setupFallbackLayers = () => {
      const baseLayer = vp.layerManager.getLayers()[0];
      if (baseLayer) {
        baseLayer.name = 'Map Background';
      }
      const annotationLayer = vp.layerManager.createLayer('Annotations');
      vp.layerManager.setActiveLayer(annotationLayer.id);
    };

    // Try loading with CORS first so exportImage can access pixels.
    // If CORS fails, retry without — the image still displays on
    // the canvas, but PNG export will fall back to JSON sync.
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = setupCanvas;
    img.onerror = () => {
      const retry = new window.Image();
      retry.onload = setupCanvas;
      retry.onerror = setupFallbackLayers;
      retry.src = mapImageUrl;
    };
    img.src = mapImageUrl;
  }

  // Cleanup autosave on unmount
  useEffect(() => {
    return () => {
      autoSaveRef.current?.stop();
    };
  }, []);

  // Sync arrow color
  useEffect(() => {
    const vp = getVp();
    if (!vp) return;
    const arrow = vp.toolManager.getTool<ArrowTool>('arrow');
    arrow?.setOptions({ color: arrowColor });
  }, [arrowColor, getVp]);

  // Sync note options
  useEffect(() => {
    const vp = getVp();
    if (!vp) return;
    const note = vp.toolManager.getTool<NoteTool>('note');
    note?.setOptions({ backgroundColor: noteColor, textColor: noteTextColor });
  }, [noteColor, noteTextColor, getVp]);

  // Sync text tool options
  useEffect(() => {
    const vp = getVp();
    if (!vp) return;
    const text = vp.toolManager.getTool<TextTool>('text');
    text?.setOptions({ color: textColor, fontSize: textFontSize, textAlign });
  }, [textColor, textFontSize, textAlign, getVp]);

  // Sync shape tool options
  useEffect(() => {
    const vp = getVp();
    if (!vp) return;
    const shape = vp.toolManager.getTool<ShapeTool>('shape');
    shape?.setOptions({
      shape: shapeKind,
      strokeColor: shapeStrokeColor,
      strokeWidth: shapeStrokeWidth,
      fillColor: shapeFillColor,
    });
  }, [shapeKind, shapeStrokeColor, shapeStrokeWidth, shapeFillColor, getVp]);

  // ─── Handlers ────────────────────────────────────────────────

  const handleToolChange = useCallback(
    (name: string) => {
      const vp = getVp();
      if (!vp) return;
      if (name === 'image') {
        fileInputRef.current?.click();
        return;
      }
      vp.toolManager.setTool(name, vp.toolContext);
    },
    [getVp]
  );

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

  const handleUndo = useCallback(() => {
    getVp()?.undo();
  }, [getVp]);

  const handleRedo = useCallback(() => {
    getVp()?.redo();
  }, [getVp]);

  const handleDeleteSelected = useCallback(() => {
    const vp = getVp();
    if (!vp) return;
    if (vp.toolManager.activeTool?.name !== 'select') return;
    const selectTool = vp.toolManager.getTool<SelectTool>('select');
    if (!selectTool) return;
    const ids = selectTool.selectedIds.filter(id => vp.store.getById(id));
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
        blob = await vp.exportImage({
          scale: 2,
          padding: 0,
          filter: (el: { id: string }) => !currentDmOnly[el.id],
        });
      } catch (error) {
        console.warn('Failed to export image:', error);
        // exportImage can throw on tainted canvas (cross-origin images
        // without CORS). Fall through to JSON fallback.
      }

      if (blob) {
        // Upload PNG to S3
        const assetId = `location-${location.id}-${Date.now()}`;
        const formData = new FormData();
        formData.append('file', blob, `${assetId}.png`);
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

      const payload = {
        dmId,
        location: {
          id: location.id,
          name: location.name,
          mapImageUrl: location.mapImageUrl,
          mapImageSize: location.mapImageSize,
          snapshotUrl,
          canvasState: filteredState,
          gridEnabled,
          gridSettings: location.gridSettings,
          updatedAt: new Date().toISOString(),
        },
      };

      const res = await fetch(
        `/api/campaign/${campaignCode}/locations/${location.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

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
    storeGetLocation,
    onSyncToPlayers,
  ]);

  const handleDownloadExport = useCallback(async () => {
    const vp = getVp();
    if (!vp) return;
    const currentDmOnly =
      storeGetLocation(campaignCode, location.id)?.dmOnlyElements ?? {};
    try {
      const blob = await vp.exportImage({
        scale: 2,
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
  }, [getVp, campaignCode, location.id, location.name, storeGetLocation]);

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
        vp.addImage(
          src,
          { x: center.x - w / 2, y: center.y - h / 2 },
          { w, h }
        );
        setImageUploading(false);
      };
      img.onerror = () => setImageUploading(false);
      img.src = src;
    },
    [getVp]
  );

  return {
    canvasRef,
    fileInputRef,
    tools,
    activeTool,
    arrowColor,
    setArrowColor,
    noteColor,
    setNoteColor,
    noteTextColor,
    setNoteTextColor,
    textColor,
    setTextColor,
    textFontSize,
    setTextFontSize,
    textAlign,
    setTextAlign,
    shapeKind,
    setShapeKind,
    shapeStrokeColor,
    setShapeStrokeColor,
    shapeStrokeWidth,
    setShapeStrokeWidth,
    shapeFillColor,
    setShapeFillColor,
    layers,
    activeLayerId,
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
    canUndo,
    canRedo,
    elementCount,
    zoom,
    syncing,
    hasUnsyncedChanges,
    lastSyncedAt,
    imageUploading,
    setImageUploading,
    handleReady,
    handleToolChange,
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleClear,
    handleSyncToPlayers,
    handleDownloadExport,
    handleImageFileSelect,
  };
}
