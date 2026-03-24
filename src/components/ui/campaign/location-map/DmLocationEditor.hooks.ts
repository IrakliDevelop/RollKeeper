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
  handleToggleGrid: () => void;
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

  // Handlers
  handleReady: (vp: Viewport) => void;
  handleToolChange: (name: string) => void;
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
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);

  // Grid state
  const [gridEnabled, setGridEnabled] = useState(location.gridEnabled);

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
      vp.store.on('add', () => {
        const json = vp.exportJSON();
        onSave(json);
      });
      vp.store.on('remove', () => {
        const json = vp.exportJSON();
        onSave(json);
      });
      vp.store.on('update', () => {
        const json = vp.exportJSON();
        onSave(json);
      });
    },
    [location, onSave]
  );

  function _initializeBackground(
    vp: Viewport,
    mapImageUrl: string,
    mapImageSize: { w: number; h: number }
  ) {
    if (!mapImageUrl) return;
    vp.addImage(mapImageUrl, { x: 0, y: 0 }, mapImageSize);
    // Lock the base layer so the background image stays in place
    const baseLayer = vp.layerManager.getLayers()[0];
    if (baseLayer) {
      vp.layerManager.setLayerLocked(baseLayer.id, true);
    }
    setElementCount(vp.store.count);
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

  const handleToggleGrid = useCallback(() => {
    const vp = getVp();
    if (!vp) return;

    if (gridEnabled) {
      vp.removeGrid();
      setGridEnabled(false);
      storeUpdateLocation(campaignCode, location.id, { gridEnabled: false });
    } else {
      const gs = location.gridSettings;
      vp.addGrid({
        gridType: gs?.gridType ?? 'square',
        hexOrientation: gs?.hexOrientation,
        cellSize: gs?.cellSize ?? 50,
        strokeColor: gs?.strokeColor ?? '#94a3b8',
        strokeWidth: gs?.strokeWidth ?? 1,
        opacity: gs?.opacity ?? 0.5,
      });
      setGridEnabled(true);
      storeUpdateLocation(campaignCode, location.id, { gridEnabled: true });
    }
  }, [
    gridEnabled,
    getVp,
    campaignCode,
    location.id,
    location.gridSettings,
    storeUpdateLocation,
  ]);

  const handleUpdateGridSettings = useCallback(
    (settings: Partial<GridSettings>) => {
      const vp = getVp();
      if (!vp || !gridEnabled) return;

      const currentGs = location.gridSettings ?? {
        gridType: 'square',
        cellSize: 50,
        strokeColor: '#94a3b8',
        strokeWidth: 1,
        opacity: 0.5,
      };

      const updatedSettings = { ...currentGs, ...settings };
      vp.updateGrid(updatedSettings);
      storeUpdateLocation(campaignCode, location.id, {
        gridSettings: updatedSettings,
      });
    },
    [
      getVp,
      gridEnabled,
      location.gridSettings,
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
      const json = vp.exportJSON();
      const parsed = JSON.parse(json) as {
        elements: Array<{ id: string }>;
        [key: string]: unknown;
      };

      // Filter out DM-only elements
      const currentDmOnly =
        storeGetLocation(campaignCode, location.id)?.dmOnlyElements ?? {};
      const filteredElements = parsed.elements.filter(
        (el: { id: string }) => !currentDmOnly[el.id]
      );

      const filteredState = JSON.stringify({
        ...parsed,
        elements: filteredElements,
      });

      const payload = {
        dmId,
        location: {
          id: location.id,
          name: location.name,
          mapImageUrl: location.mapImageUrl,
          mapImageSize: location.mapImageSize,
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
    handleToggleGrid,
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
    imageUploading,
    setImageUploading,
    handleReady,
    handleToolChange,
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleClear,
    handleSyncToPlayers,
    handleImageFileSelect,
  };
}
