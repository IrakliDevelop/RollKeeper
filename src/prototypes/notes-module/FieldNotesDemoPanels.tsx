'use client';

import * as React from 'react';

import type { ShapeKind, AlignEdge, ArrowStrokeStyle } from '@fieldnotes/core';
import type {
  ArrowToolOptions,
  EraserToolOptions,
  NoteToolOptions,
  PencilToolOptions,
  ShapeToolOptions,
  TextToolOptions,
} from '@fieldnotes/core';
import {
  useActiveTool,
  useCamera,
  useElements,
  useHistory,
  useLayers,
  useSelection,
  useSelectionOps,
  useSelectionStyle,
  useToolOptions,
  useViewport,
} from '@fieldnotes/react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileCode2,
  Grid3X3,
  Group,
  Hand,
  Image as ImageIcon,
  Layers,
  Lock,
  Maximize2,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Redo2,
  Ruler,
  Scissors,
  Shapes,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Unlock,
  Upload,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const TOOL_DEFS: {
  name: string;
  icon: typeof Hand;
  label: string;
}[] = [
  { name: 'hand', icon: Hand, label: 'Pan' },
  { name: 'select', icon: MousePointer2, label: 'Select' },
  { name: 'pencil', icon: Pencil, label: 'Draw' },
  { name: 'eraser', icon: Eraser, label: 'Eraser' },
  { name: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { name: 'note', icon: StickyNote, label: 'Sticky Note' },
  { name: 'text', icon: Type, label: 'Text' },
  { name: 'shape', icon: Shapes, label: 'Shape' },
  { name: 'image', icon: ImageIcon, label: 'Image' },
  { name: 'laser', icon: Zap, label: 'Laser Pointer' },
];

/** Viewport exposes historyRecorder for batched deletes (same as keyboard). */
type ViewportHistoryAccess = {
  historyRecorder: { begin: () => void; commit: () => void };
};

const ALIGN_BUTTONS: {
  edge: AlignEdge;
  icon: typeof AlignStartHorizontal;
  label: string;
}[] = [
  { edge: 'left', icon: AlignStartHorizontal, label: 'Align left' },
  { edge: 'center-x', icon: AlignCenterHorizontal, label: 'Align center' },
  { edge: 'right', icon: AlignEndHorizontal, label: 'Align right' },
  { edge: 'top', icon: AlignStartVertical, label: 'Align top' },
  { edge: 'middle', icon: AlignCenterVertical, label: 'Align middle' },
  { edge: 'bottom', icon: AlignEndVertical, label: 'Align bottom' },
];

const ARROW_STYLES: { value: ArrowStrokeStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

function ToolbarIconButton({
  active,
  disabled,
  title,
  onClick,
  children,
  className = '',
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${className} ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:hover:bg-transparent disabled:hover:text-slate-500'
      }`}
    >
      {children}
    </button>
  );
}

export function FieldNotesDemoSelectionBar() {
  const viewport = useViewport();
  const {
    selectedCount,
    canGroup,
    canUngroup,
    canAlign,
    canDistribute,
    isLocked,
    group,
    ungroup,
    toggleLock,
    align,
    distribute,
  } = useSelectionOps();
  const selectedIds = useSelection();
  const [selectionStyle, applySelectionStyle] = useSelectionStyle();

  if (selectedCount === 0) return null;

  const handleZOrder = (action: 'front' | 'back' | 'forward' | 'backward') => {
    for (const id of selectedIds) {
      if (action === 'front') viewport.store.bringToFront(id);
      else if (action === 'back') viewport.store.sendToBack(id);
      else if (action === 'forward') viewport.store.bringForward(id);
      else viewport.store.sendBackward(id);
    }
    viewport.requestRender();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-indigo-100 bg-indigo-50/60 px-3 py-1.5">
      <span className="text-xs font-semibold text-indigo-800">
        {selectedCount} selected
      </span>

      <div className="mx-1 h-5 w-px bg-indigo-200" />

      <ToolbarIconButton
        title="Group (Ctrl+G)"
        disabled={!canGroup}
        onClick={group}
      >
        <Group size={15} />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="Ungroup (Ctrl+Shift+G)"
        disabled={!canUngroup}
        onClick={ungroup}
      >
        <Ungroup size={15} />
      </ToolbarIconButton>
      <ToolbarIconButton
        title={isLocked ? 'Unlock (Ctrl+Shift+L)' : 'Lock (Ctrl+Shift+L)'}
        active={isLocked === true}
        disabled={isLocked === null}
        onClick={toggleLock}
      >
        {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
      </ToolbarIconButton>

      <div className="mx-1 h-5 w-px bg-indigo-200" />

      {ALIGN_BUTTONS.map(({ edge, icon: Icon, label }) => (
        <ToolbarIconButton
          key={edge}
          title={label}
          disabled={!canAlign}
          onClick={() => align(edge)}
        >
          <Icon size={15} />
        </ToolbarIconButton>
      ))}

      <ToolbarIconButton
        title="Distribute horizontally"
        disabled={!canDistribute}
        onClick={() => distribute('horizontal')}
      >
        <MoveHorizontal size={15} />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="Distribute vertically"
        disabled={!canDistribute}
        onClick={() => distribute('vertical')}
      >
        <MoveVertical size={15} />
      </ToolbarIconButton>

      <div className="mx-1 h-5 w-px bg-indigo-200" />

      <ToolbarIconButton
        title="Bring to front"
        onClick={() => handleZOrder('front')}
      >
        <ChevronUp size={15} />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="Send to back"
        onClick={() => handleZOrder('back')}
      >
        <ChevronDown size={15} />
      </ToolbarIconButton>

      {selectionStyle && (
        <>
          <div className="mx-1 h-5 w-px bg-indigo-200" />
          <span className="text-xs font-medium text-slate-500">Style</span>
          <div className="flex items-center gap-1">
            {['#334155', '#ef4444', '#3b82f6', '#22c55e', '#eab308'].map(
              color => (
                <button
                  key={color}
                  type="button"
                  title={`Apply ${color}`}
                  onClick={() => applySelectionStyle({ color })}
                  className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-105 ${
                    selectionStyle.color === color
                      ? 'scale-110 border-indigo-500'
                      : 'border-slate-300'
                  }`}
                  style={{ backgroundColor: color }}
                />
              )
            )}
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
            {ARROW_STYLES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => applySelectionStyle({ strokeStyle: value })}
                className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                  selectionStyle.strokeStyle === value
                    ? 'bg-indigo-100 font-semibold text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FieldNotesDemoToolbar({
  sidebarOpen,
  setSidebarOpen,
  layersPanelOpen,
  setLayersPanelOpen,
  onPickImageTool,
  onClearExtras,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  layersPanelOpen: boolean;
  setLayersPanelOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  onPickImageTool: () => void;
  /** Clears React-only state (e.g. placed note cards) after canvas clear */
  onClearExtras?: () => void | Promise<void>;
}) {
  const [activeTool, setTool] = useActiveTool();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const { zoom } = useCamera();
  const elements = useElements();
  const viewport = useViewport();
  const gridEls = useElements('grid');
  const snapOn = viewport.snapToGrid;
  const { selectedCount, selectedIds } = useSelectionOps();
  const [smartGuidesOn, setSmartGuidesOn] = React.useState(true);

  const handleSwitchTool = (name: string) => {
    if (name === 'image') {
      onPickImageTool();
      return;
    }
    setTool(name);
  };

  const handleZoomOut = () => {
    viewport.camera.setZoom(Math.max(0.1, viewport.camera.zoom / 1.25));
    viewport.requestRender();
  };

  const handleZoomIn = () => {
    viewport.camera.setZoom(Math.min(5, viewport.camera.zoom * 1.25));
    viewport.requestRender();
  };

  const handleResetView = () => {
    viewport.camera.moveTo(0, 0);
    viewport.camera.setZoom(1);
    viewport.requestRender();
  };

  const handleFitToContent = () => {
    viewport.fitToContent(48);
    viewport.requestRender();
  };

  const toggleSmartGuides = () => {
    const next = !smartGuidesOn;
    viewport.setSmartGuides(next);
    setSmartGuidesOn(next);
    viewport.requestRender();
  };

  const toggleSnap = () => {
    viewport.setSnapToGrid(!viewport.snapToGrid);
    viewport.requestRender();
  };

  const toggleBattleGrid = () => {
    if (gridEls.length > 0) {
      viewport.removeGrid();
    } else {
      viewport.addGrid({
        gridType: 'square',
        cellSize: 70,
        strokeColor: 'rgba(100, 116, 139, 0.45)',
        strokeWidth: 1,
        opacity: 0.9,
      });
    }
    viewport.requestRender();
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const { historyRecorder } = viewport as unknown as ViewportHistoryAccess;
    historyRecorder.begin();
    for (const id of selectedIds) {
      viewport.store.remove(id);
    }
    historyRecorder.commit();
    viewport.requestRender();
  };

  const handleExport = () => {
    const json = viewport.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldnotes-canvas-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSvg = async () => {
    try {
      const svg = await viewport.exportSVG({ padding: 24 });
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fieldnotes-canvas-${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('SVG export failed');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        try {
          viewport.loadJSON(reader.result);
        } catch {
          alert('Invalid canvas file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClear = async () => {
    if (viewport.store.count === 0) return;
    if (!confirm('Clear all elements from the canvas?')) return;
    viewport.store.clear();
    await onClearExtras?.();
    viewport.requestRender();
  };

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-1.5">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setSidebarOpen(prev => !prev)}
          className={`rounded-md p-2 transition-colors ${
            sidebarOpen
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
          title={sidebarOpen ? 'Hide Notes' : 'Show Notes'}
        >
          {sidebarOpen ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>

        <div className="mx-2 h-6 w-px bg-slate-200" />

        {TOOL_DEFS.map(({ name, icon: Icon, label }) => (
          <button
            key={name}
            type="button"
            onClick={() => handleSwitchTool(name)}
            className={`rounded-md p-2 transition-colors ${
              activeTool === name
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title={label}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => undo()}
          disabled={!canUndo}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          title="Undo"
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          onClick={() => redo()}
          disabled={!canRedo}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          title="Redo"
        >
          <Redo2 size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleZoomOut}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          className="min-w-[52px] rounded-md px-2 py-1 text-center text-xs font-medium text-slate-600 hover:bg-slate-100"
          title="Reset View"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={handleFitToContent}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Fit to content (Shift+1)"
        >
          <Maximize2 size={16} />
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>

        <div className="mx-2 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={toggleSmartGuides}
          className={`rounded-md p-2 transition-colors ${
            smartGuidesOn
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
          title={smartGuidesOn ? 'Smart guides: On' : 'Smart guides: Off'}
        >
          <Ruler size={16} />
        </button>

        <span className="text-xs text-slate-400">
          {elements.length} elements
        </span>

        <div className="mx-2 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={toggleSnap}
          className={`rounded-md p-2 transition-colors ${
            snapOn
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
          title={snapOn ? 'Snap to Grid: On' : 'Snap to Grid: Off'}
        >
          <Grid3X3 size={16} />
        </button>

        <button
          type="button"
          onClick={toggleBattleGrid}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            gridEls.length > 0
              ? 'bg-emerald-100 text-emerald-800'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
          title="Toggle square battle grid overlay"
        >
          Grid
        </button>

        <div className="mx-2 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={() => setLayersPanelOpen(prev => !prev)}
          className={`rounded-md p-2 transition-colors ${
            layersPanelOpen
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
          title={layersPanelOpen ? 'Hide Layers' : 'Show Layers'}
        >
          <Layers size={16} />
        </button>

        <div className="mx-2 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={handleExport}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Export JSON"
        >
          <Download size={16} />
        </button>
        <button
          type="button"
          onClick={handleExportSvg}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Export SVG"
        >
          <FileCode2 size={16} />
        </button>
        <button
          type="button"
          onClick={handleImport}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Import JSON"
        >
          <Upload size={16} />
        </button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={handleDeleteSelected}
          disabled={selectedCount === 0}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
          title="Remove selected element(s)"
          aria-label="Remove selected canvas elements"
        >
          <Scissors size={16} />
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Clear entire canvas (all elements)"
          aria-label="Clear entire canvas"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export function FieldNotesDemoToolOptions() {
  const [activeTool] = useActiveTool();
  const [pencilOpts, setPencilOpts] = useToolOptions<
    PencilToolOptions & Record<string, unknown>
  >('pencil');
  const [eraserOpts, setEraserOpts] = useToolOptions<
    EraserToolOptions & Record<string, unknown>
  >('eraser');
  const [arrowOpts, setArrowOpts] = useToolOptions<
    ArrowToolOptions & Record<string, unknown>
  >('arrow');
  const [noteOpts, setNoteOpts] = useToolOptions<
    NoteToolOptions & Record<string, unknown>
  >('note');
  const [textOpts, setTextOpts] = useToolOptions<
    TextToolOptions & Record<string, unknown>
  >('text');
  const [shapeOpts, setShapeOpts] = useToolOptions<
    ShapeToolOptions & Record<string, unknown>
  >('shape');

  if (
    activeTool !== 'pencil' &&
    activeTool !== 'eraser' &&
    activeTool !== 'arrow' &&
    activeTool !== 'note' &&
    activeTool !== 'text' &&
    activeTool !== 'shape'
  ) {
    return null;
  }

  const shapeKind = (shapeOpts?.shape ?? 'rectangle') as ShapeKind;
  const isHighlighter = pencilOpts?.blendMode === 'multiply';

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-1.5">
      {activeTool === 'shape' && shapeOpts && (
        <>
          <span className="text-xs font-medium text-slate-500">Shape</span>
          <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
            {(
              [
                { value: 'rectangle' as const, label: 'Rectangle' },
                { value: 'ellipse' as const, label: 'Ellipse' },
                { value: 'line' as const, label: 'Line' },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setShapeOpts({ shape: value })}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  shapeKind === value
                    ? 'bg-indigo-100 font-semibold text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mx-1 h-6 w-px bg-slate-200" />
        </>
      )}

      <span className="text-xs font-medium text-slate-500">
        {activeTool === 'shape'
          ? 'Stroke'
          : activeTool === 'note'
            ? 'Background'
            : 'Color'}
      </span>
      <div className="flex items-center gap-1">
        {[
          '#334155',
          '#ef4444',
          '#f97316',
          '#eab308',
          '#22c55e',
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#ffffff',
        ].map(color => {
          const activeColor =
            activeTool === 'shape'
              ? shapeOpts?.strokeColor
              : activeTool === 'text'
                ? textOpts?.color
                : activeTool === 'note'
                  ? noteOpts?.backgroundColor
                  : activeTool === 'arrow'
                    ? arrowOpts?.color
                    : pencilOpts?.color;
          const isActive = activeColor === color;
          return (
            <button
              key={color}
              type="button"
              onClick={() => {
                if (activeTool === 'shape')
                  setShapeOpts({ strokeColor: color });
                else if (activeTool === 'text') setTextOpts({ color });
                else if (activeTool === 'pencil') setPencilOpts({ color });
                else if (activeTool === 'arrow') setArrowOpts({ color });
                else if (activeTool === 'note')
                  setNoteOpts({ backgroundColor: color });
              }}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${
                isActive
                  ? 'scale-110 border-indigo-500'
                  : 'border-slate-300 hover:scale-105'
              }`}
              style={{
                backgroundColor: color,
                boxShadow:
                  color === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none',
              }}
              title={color}
            />
          );
        })}
        <label className="relative h-6 w-6 cursor-pointer">
          <input
            type="color"
            value={
              activeTool === 'shape'
                ? (shapeOpts?.strokeColor ?? '#334155')
                : activeTool === 'text'
                  ? (textOpts?.color ?? '#334155')
                  : activeTool === 'note'
                    ? (noteOpts?.backgroundColor ?? '#fef08a')
                    : activeTool === 'arrow'
                      ? (arrowOpts?.color ?? '#334155')
                      : (pencilOpts?.color ?? '#334155')
            }
            onChange={e => {
              const v = e.target.value;
              if (activeTool === 'shape') setShapeOpts({ strokeColor: v });
              else if (activeTool === 'text') setTextOpts({ color: v });
              else if (activeTool === 'pencil') setPencilOpts({ color: v });
              else if (activeTool === 'arrow') setArrowOpts({ color: v });
              else if (activeTool === 'note')
                setNoteOpts({ backgroundColor: v });
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-slate-400">
            +
          </div>
        </label>
      </div>

      {activeTool === 'note' && noteOpts && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">Text</span>
          <div className="flex items-center gap-1">
            {[
              '#334155',
              '#1e293b',
              '#ef4444',
              '#16a34a',
              '#2563eb',
              '#7c3aed',
              '#ffffff',
            ].map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setNoteOpts({ textColor: color })}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  noteOpts.textColor === color
                    ? 'scale-110 border-indigo-500'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{
                  backgroundColor: color,
                  boxShadow:
                    color === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none',
                }}
                title={color}
              />
            ))}
            <label className="relative h-6 w-6 cursor-pointer">
              <input
                type="color"
                value={noteOpts.textColor ?? '#334155'}
                onChange={e => setNoteOpts({ textColor: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-slate-400">
                +
              </div>
            </label>
          </div>
        </>
      )}

      {activeTool === 'shape' && shapeOpts && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">Fill</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShapeOpts({ fillColor: 'transparent' })}
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform ${
                shapeOpts.fillColor === 'transparent'
                  ? 'scale-110 border-indigo-500'
                  : 'border-slate-300 hover:scale-105'
              }`}
              title="No fill"
            >
              <X size={10} className="text-slate-400" />
            </button>
            {[
              '#334155',
              '#fecaca',
              '#fed7aa',
              '#fef08a',
              '#bbf7d0',
              '#bfdbfe',
              '#ddd6fe',
              '#fbcfe8',
              '#ffffff',
            ].map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setShapeOpts({ fillColor: color })}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  shapeOpts.fillColor === color
                    ? 'scale-110 border-indigo-500'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{
                  backgroundColor: color,
                  boxShadow:
                    color === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none',
                }}
                title={color}
              />
            ))}
            <label className="relative h-6 w-6 cursor-pointer">
              <input
                type="color"
                value={
                  shapeOpts.fillColor === 'transparent'
                    ? '#ffffff'
                    : (shapeOpts.fillColor ?? '#ffffff')
                }
                onChange={e => setShapeOpts({ fillColor: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-slate-400">
                +
              </div>
            </label>
          </div>

          <div className="mx-1 h-6 w-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">Width</span>
          <input
            type="range"
            min={1}
            max={12}
            value={shapeOpts.strokeWidth ?? 2}
            onChange={e =>
              setShapeOpts({ strokeWidth: Number(e.target.value) })
            }
            className="h-1.5 w-20 cursor-pointer accent-indigo-600"
          />
          <span className="min-w-[28px] text-xs text-slate-500 tabular-nums">
            {shapeOpts.strokeWidth ?? 2}px
          </span>
        </>
      )}

      {activeTool === 'arrow' && arrowOpts && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">Stroke</span>
          <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
            {ARROW_STYLES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setArrowOpts({ strokeStyle: value })}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  (arrowOpts.strokeStyle ?? 'solid') === value
                    ? 'bg-indigo-100 font-semibold text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {activeTool === 'pencil' && pencilOpts && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() =>
              setPencilOpts(
                isHighlighter
                  ? {
                      blendMode: undefined,
                      opacity: undefined,
                      color: '#334155',
                    }
                  : {
                      blendMode: 'multiply',
                      opacity: 0.45,
                      color: '#eab308',
                      width: Math.max(pencilOpts.width ?? 2, 8),
                    }
              )
            }
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              isHighlighter
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {isHighlighter ? 'Highlighter on' : 'Highlighter off'}
          </button>
        </>
      )}

      {activeTool === 'eraser' && eraserOpts && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">Mode</span>
          <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
            {(
              [
                { value: 'stroke' as const, label: 'Stroke' },
                { value: 'partial' as const, label: 'Partial' },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEraserOpts({ mode: value })}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  (eraserOpts.mode ?? 'stroke') === value
                    ? 'bg-indigo-100 font-semibold text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {activeTool === 'pencil' && pencilOpts && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">Size</span>
          <input
            type="range"
            min={1}
            max={20}
            value={pencilOpts.width ?? 2}
            onChange={e => setPencilOpts({ width: Number(e.target.value) })}
            className="h-1.5 w-28 cursor-pointer accent-indigo-600"
          />
          <span className="min-w-[28px] text-xs text-slate-500 tabular-nums">
            {pencilOpts.width ?? 2}px
          </span>
          <div className="flex items-center gap-1">
            {[1, 3, 6, 12].map(size => (
              <button
                key={size}
                type="button"
                onClick={() => setPencilOpts({ width: size })}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  pencilOpts.width === size
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                }`}
                title={`${size}px`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{
                    width: Math.min(size + 2, 14),
                    height: Math.min(size + 2, 14),
                  }}
                />
              </button>
            ))}
          </div>
        </>
      )}

      {activeTool === 'text' && textOpts && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">Size</span>
          <input
            type="range"
            min={10}
            max={72}
            value={textOpts.fontSize ?? 16}
            onChange={e => setTextOpts({ fontSize: Number(e.target.value) })}
            className="h-1.5 w-24 cursor-pointer accent-indigo-600"
          />
          <span className="min-w-[32px] text-xs text-slate-500 tabular-nums">
            {textOpts.fontSize ?? 16}px
          </span>
          <div className="flex items-center gap-0.5">
            {[12, 16, 24, 36, 48].map(size => (
              <button
                key={size}
                type="button"
                onClick={() => setTextOpts({ fontSize: size })}
                className={`rounded-md px-1.5 py-0.5 text-xs transition-colors ${
                  textOpts.fontSize === size
                    ? 'bg-indigo-100 font-semibold text-indigo-700'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">Align</span>
          <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
            {(
              [
                { value: 'left' as const, label: 'Left' },
                { value: 'center' as const, label: 'Center' },
                { value: 'right' as const, label: 'Right' },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTextOpts({ textAlign: value })}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  textOpts.textAlign === value
                    ? 'bg-indigo-100 font-semibold text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
                title={label}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FieldNotesDemoLayersPanel({
  onRequestRender,
}: {
  onRequestRender?: () => void;
}) {
  const {
    layers,
    activeLayerId,
    createLayer,
    removeLayer,
    renameLayer,
    reorderLayer,
    setVisible,
    setLocked,
    setActiveLayer,
  } = useLayers();
  const viewport = useViewport();
  const [renamingLayerId, setRenamingLayerId] = React.useState<string | null>(
    null
  );
  const [renameValue, setRenameValue] = React.useState('');

  const requestRender = () => {
    viewport.requestRender();
    onRequestRender?.();
  };

  return (
    <div className="flex w-56 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
        <Layers size={16} className="text-indigo-600" />
        <h2 className="text-sm font-semibold text-slate-800">Layers</h2>
        <button
          type="button"
          onClick={() => {
            createLayer();
            requestRender();
          }}
          className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
          title="Add Layer"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {[...layers]
          .sort((a, b) => b.order - a.order)
          .map(layer => {
            const isActive = layer.id === activeLayerId;
            return (
              <div
                key={layer.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveLayer(layer.id);
                  requestRender();
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveLayer(layer.id);
                    requestRender();
                  }
                }}
                className={`group flex items-center gap-1.5 border-b border-slate-50 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'cursor-pointer text-slate-700 hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setVisible(layer.id, !layer.visible);
                    requestRender();
                  }}
                  className={`rounded p-0.5 ${
                    layer.visible
                      ? 'text-slate-400 hover:text-slate-600'
                      : 'text-slate-300 hover:text-slate-500'
                  }`}
                  title={layer.visible ? 'Hide' : 'Show'}
                >
                  {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setLocked(layer.id, !layer.locked);
                    requestRender();
                  }}
                  className={`rounded p-0.5 ${
                    layer.locked
                      ? 'text-amber-500 hover:text-amber-600'
                      : 'text-slate-300 hover:text-slate-500'
                  }`}
                  title={layer.locked ? 'Unlock' : 'Lock'}
                >
                  {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>

                {renamingLayerId === layer.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => {
                      if (renameValue.trim()) {
                        renameLayer(layer.id, renameValue.trim());
                      }
                      setRenamingLayerId(null);
                      requestRender();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setRenamingLayerId(null);
                      }
                    }}
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-indigo-300 px-1 py-0.5 text-xs focus:outline-none"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    onDoubleClick={e => {
                      e.stopPropagation();
                      setRenamingLayerId(layer.id);
                      setRenameValue(layer.name);
                    }}
                    className={`min-w-0 flex-1 truncate text-xs ${
                      isActive ? 'font-semibold' : ''
                    } ${!layer.visible ? 'italic opacity-50' : ''}`}
                    title={`${layer.name} (double-click to rename)`}
                  >
                    {layer.name}
                  </span>
                )}

                <div className="ml-auto flex opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      reorderLayer(layer.id, layer.order + 1);
                      requestRender();
                    }}
                    className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                    title="Move Up"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      reorderLayer(layer.id, layer.order - 1);
                      requestRender();
                    }}
                    className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                    title="Move Down"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>

                {layers.length > 1 && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                      requestRender();
                    }}
                    className="rounded p-0.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500"
                    title="Delete Layer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export function FieldNotesDemoGridControls() {
  const gridEls = useElements('grid');
  const viewport = useViewport();
  const firstGrid = gridEls[0];
  const cellSize =
    firstGrid && firstGrid.type === 'grid' ? firstGrid.cellSize : 70;

  if (gridEls.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-1.5 text-xs text-slate-600">
      <span className="font-medium text-slate-500">Battle grid</span>
      <label className="flex items-center gap-1.5">
        <span className="text-slate-500">Cell</span>
        <input
          type="range"
          min={20}
          max={200}
          value={cellSize}
          onChange={e => {
            viewport.updateGrid({ cellSize: Number(e.target.value) });
            viewport.requestRender();
          }}
          className="h-1 w-28 cursor-pointer accent-emerald-600"
        />
        <span className="text-slate-500 tabular-nums">
          {Math.round(cellSize)}px
        </span>
      </label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            viewport.updateGrid({ gridType: 'square' });
            viewport.requestRender();
          }}
          className={`rounded px-2 py-0.5 ${
            firstGrid?.type === 'grid' && firstGrid.gridType === 'square'
              ? 'bg-emerald-200 text-emerald-900'
              : 'bg-white text-slate-600 ring-1 ring-slate-200'
          }`}
        >
          Square
        </button>
        <button
          type="button"
          onClick={() => {
            viewport.updateGrid({ gridType: 'hex', hexOrientation: 'pointy' });
            viewport.requestRender();
          }}
          className={`rounded px-2 py-0.5 ${
            firstGrid?.type === 'grid' && firstGrid.gridType === 'hex'
              ? 'bg-emerald-200 text-emerald-900'
              : 'bg-white text-slate-600 ring-1 ring-slate-200'
          }`}
        >
          Hex
        </button>
      </div>
    </div>
  );
}
