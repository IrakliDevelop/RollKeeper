'use client';

import {
  Loader2,
  Layers,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  X,
} from 'lucide-react';
import { FieldNotesCanvas as Canvas } from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import DmLocationToolbar from './DmLocationToolbar';
import { useDmLocationEditor } from './DmLocationEditor.hooks';
import type { DmLocationEditorProps } from './DmLocationEditor.types';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';
import EncounterLinkingPanel from '../battle-map/EncounterLinkingPanel';

const COLOR_SWATCHES = [
  '#334155',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ffffff',
];

const NOTE_TEXT_COLORS = [
  '#334155',
  '#1e293b',
  '#ef4444',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#ffffff',
];

export default function DmLocationEditor(props: DmLocationEditorProps) {
  const linkEncounter = useBattleMapStore(s => s.linkEncounter);
  const unlinkEncounter = useBattleMapStore(s => s.unlinkEncounter);

  const {
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
    selectedElementId,
    isDmOnly,
    handleToggleDmOnly,
    canUndo,
    canRedo,
    elementCount,
    syncing,
    hasUnsyncedChanges,
    lastSyncedAt,
    imageUploading,
    handleReady,
    handleToolChange,
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleClear,
    handleSyncToPlayers,
    handleDownloadExport,
    handleImageFileSelect,
    mode,
    handleOpenTvDisplay,
  } = useDmLocationEditor(props);

  // Determine the active primary color for the contextual color picker
  const activeColor =
    activeTool === 'shape'
      ? shapeStrokeColor
      : activeTool === 'text'
        ? textColor
        : activeTool === 'note'
          ? noteColor
          : activeTool === 'arrow'
            ? arrowColor
            : '#334155';

  const handleColorChange = (color: string) => {
    if (activeTool === 'shape') setShapeStrokeColor(color);
    else if (activeTool === 'text') setTextColor(color);
    else if (activeTool === 'note') setNoteColor(color);
    else if (activeTool === 'arrow') setArrowColor(color);
  };

  const showOptionsBar =
    activeTool === 'arrow' ||
    activeTool === 'note' ||
    activeTool === 'text' ||
    activeTool === 'shape';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelect}
      />

      {/* Toolbar */}
      <DmLocationToolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDelete={handleDeleteSelected}
        onClear={handleClear}
        gridEnabled={gridEnabled}
        gridType={gridType}
        gridCellSize={gridCellSize}
        gridColor={gridColor}
        gridOpacity={gridOpacity}
        onSetGridType={handleSetGridType}
        onUpdateGridSettings={handleUpdateGridSettings}
        onSyncToPlayers={handleSyncToPlayers}
        onDownloadExport={handleDownloadExport}
        syncing={syncing}
        hasUnsyncedChanges={hasUnsyncedChanges}
        lastSyncedAt={lastSyncedAt}
        selectedElementId={selectedElementId}
        isDmOnly={isDmOnly}
        onToggleDmOnly={handleToggleDmOnly}
        mode={mode}
        onOpenTvDisplay={handleOpenTvDisplay}
      />

      {/* Contextual options bar */}
      {showOptionsBar && (
        <div className="border-divider bg-surface-secondary flex flex-wrap items-center gap-3 border-b px-4 py-1.5">
          {/* Shape kind toggle */}
          {activeTool === 'shape' && (
            <>
              <span className="text-muted text-xs font-medium">Shape</span>
              <div className="border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5">
                {(['rectangle', 'ellipse'] as const).map(value => (
                  <button
                    key={value}
                    onClick={() => setShapeKind(value)}
                    className={`rounded px-2 py-1 text-xs capitalize transition-colors ${
                      shapeKind === value
                        ? 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                        : 'text-muted hover:bg-surface-raised hover:text-body'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="bg-divider h-6 w-px" />
            </>
          )}

          {/* Primary color */}
          <span className="text-muted text-xs font-medium">
            {activeTool === 'shape'
              ? 'Stroke'
              : activeTool === 'note'
                ? 'Background'
                : 'Color'}
          </span>
          <div className="flex items-center gap-1">
            {COLOR_SWATCHES.map(color => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                title={color}
                className={`h-5 w-5 rounded-full border-2 transition-transform ${
                  activeColor === color
                    ? 'border-accent-blue-border scale-110'
                    : 'border-divider hover:scale-105'
                }`}
                style={{
                  backgroundColor: color,
                  boxShadow:
                    color === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none',
                }}
              />
            ))}
            {/* Custom color picker */}
            <label className="relative h-5 w-5 cursor-pointer">
              <input
                type="color"
                value={activeColor}
                onChange={e => handleColorChange(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="border-divider text-muted hover:border-body flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed text-xs">
                +
              </div>
            </label>
          </div>

          {/* Note text color */}
          {activeTool === 'note' && (
            <>
              <div className="bg-divider h-6 w-px" />
              <span className="text-muted text-xs font-medium">Text</span>
              <div className="flex items-center gap-1">
                {NOTE_TEXT_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNoteTextColor(color)}
                    title={color}
                    className={`h-5 w-5 rounded-full border-2 transition-transform ${
                      noteTextColor === color
                        ? 'border-accent-blue-border scale-110'
                        : 'border-divider hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: color,
                      boxShadow:
                        color === '#ffffff'
                          ? 'inset 0 0 0 1px #e2e8f0'
                          : 'none',
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Shape fill color */}
          {activeTool === 'shape' && (
            <>
              <div className="bg-divider h-6 w-px" />
              <span className="text-muted text-xs font-medium">Fill</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShapeFillColor('transparent')}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    shapeFillColor === 'transparent'
                      ? 'bg-accent-blue-bg text-accent-blue-text'
                      : 'text-muted hover:text-body'
                  }`}
                >
                  None
                </button>
                {COLOR_SWATCHES.slice(0, 8).map(color => (
                  <button
                    key={color}
                    onClick={() => setShapeFillColor(color)}
                    title={color}
                    className={`h-5 w-5 rounded-full border-2 transition-transform ${
                      shapeFillColor === color
                        ? 'border-accent-blue-border scale-110'
                        : 'border-divider hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="bg-divider h-6 w-px" />
              <span className="text-muted text-xs font-medium">Width</span>
              <input
                type="range"
                min={1}
                max={10}
                value={shapeStrokeWidth}
                onChange={e => setShapeStrokeWidth(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-muted text-xs">{shapeStrokeWidth}px</span>
            </>
          )}

          {/* Text options */}
          {activeTool === 'text' && (
            <>
              <div className="bg-divider h-6 w-px" />
              <span className="text-muted text-xs font-medium">Size</span>
              <input
                type="range"
                min={10}
                max={72}
                value={textFontSize}
                onChange={e => setTextFontSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-muted text-xs">{textFontSize}px</span>
              <div className="bg-divider h-6 w-px" />
              <div className="border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5">
                {(['left', 'center', 'right'] as const).map(align => (
                  <button
                    key={align}
                    onClick={() => setTextAlign(align)}
                    className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                      textAlign === align
                        ? 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                        : 'text-muted hover:bg-surface-raised hover:text-body'
                    }`}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Canvas + layers panel */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <Canvas
            ref={canvasRef}
            tools={tools}
            defaultTool="hand"
            options={{
              background: {
                pattern: 'dots',
                color: '#cbd5e1',
                spacing: 24,
                dotRadius: 1,
              },
              camera: { minZoom: 0.1, maxZoom: 5 },
            }}
            onReady={handleReady}
            className="h-full w-full"
            style={{ minHeight: 0 }}
          />
        </div>

        {/* Layers panel (collapsible right sidebar) */}
        {layersPanelOpen && (
          <div className="border-divider bg-surface-raised flex w-52 flex-col border-l">
            <div className="border-divider flex items-center justify-between border-b px-3 py-2">
              <span className="text-heading text-xs font-semibold">Layers</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    canvasRef.current?.viewport?.layerManager.createLayer();
                  }}
                  title="Add layer"
                >
                  <Plus size={12} />
                </Button>
                <Button
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => setLayersPanelOpen(false)}
                  title="Close layers"
                >
                  <X size={12} />
                </Button>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
              {[...layers].reverse().map(layer => {
                const vp = canvasRef.current?.viewport;
                const isActive = layer.id === activeLayerId;

                return (
                  <div
                    key={layer.id}
                    onClick={() => vp?.layerManager.setActiveLayer(layer.id)}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      isActive
                        ? 'bg-accent-blue-bg text-accent-blue-text'
                        : 'text-body hover:bg-surface-secondary'
                    }`}
                  >
                    {/* Visibility */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        vp?.layerManager.setLayerVisible(
                          layer.id,
                          !layer.visible
                        );
                      }}
                      title={layer.visible ? 'Hide layer' : 'Show layer'}
                      className="shrink-0"
                    >
                      {layer.visible ? (
                        <Eye size={11} />
                      ) : (
                        <EyeOff size={11} className="text-muted" />
                      )}
                    </button>

                    {/* Lock */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        vp?.layerManager.setLayerLocked(
                          layer.id,
                          !layer.locked
                        );
                      }}
                      title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                      className="shrink-0"
                    >
                      {layer.locked ? (
                        <Lock size={11} className="text-accent-amber-text" />
                      ) : (
                        <Unlock size={11} className="text-muted" />
                      )}
                    </button>

                    {/* Name */}
                    <span className="min-w-0 flex-1 truncate">
                      {layer.name}
                    </span>

                    {/* Delete layer (only if more than one layer) */}
                    {layers.length > 1 && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          vp?.layerManager.removeLayer(layer.id);
                        }}
                        className="text-muted hover:text-accent-red-text shrink-0"
                        title="Delete layer"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Element count footer */}
            <div className="border-divider text-muted border-t px-3 py-2 text-xs">
              {elementCount} element{elementCount !== 1 ? 's' : ''}
            </div>

            {mode === 'battlemap' && (
              <EncounterLinkingPanel
                campaignCode={props.campaignCode}
                linkedEncounterIds={
                  (props.location as BattleMap).linkedEncounterIds ?? []
                }
                onLink={id =>
                  linkEncounter(props.campaignCode, props.location.id, id)
                }
                onUnlink={id =>
                  unlinkEncounter(props.campaignCode, props.location.id, id)
                }
              />
            )}
          </div>
        )}

        {/* Layers toggle button (when panel is closed) */}
        {!layersPanelOpen && (
          <button
            onClick={() => setLayersPanelOpen(true)}
            title="Show layers"
            className="border-divider bg-surface-raised text-muted hover:text-body absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-md border shadow-sm"
          >
            <Layers size={15} />
          </button>
        )}

        {/* Image uploading overlay */}
        {imageUploading && (
          <div className="bg-surface/70 absolute inset-0 z-20 flex items-center justify-center">
            <div className="border-divider bg-surface flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg">
              <Loader2
                size={18}
                className="text-accent-blue-text animate-spin"
              />
              <span className="text-body text-sm">Uploading image…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
