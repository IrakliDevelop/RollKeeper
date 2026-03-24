'use client';

import {
  Hand,
  MousePointer2,
  Type,
  StickyNote,
  Shapes,
  Image as ImageIcon,
  ArrowRight,
  Undo2,
  Redo2,
  Trash2,
  Grid3X3,
  Loader2,
  Upload,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import DmOnlyToggle from './DmOnlyToggle';
import type { DmLocationToolbarProps } from './DmLocationToolbar.types';

const TOOL_DEFS = [
  { name: 'hand', icon: Hand, label: 'Pan' },
  { name: 'select', icon: MousePointer2, label: 'Select' },
  { name: 'text', icon: Type, label: 'Text' },
  { name: 'note', icon: StickyNote, label: 'Sticky Note' },
  { name: 'shape', icon: Shapes, label: 'Shape' },
  { name: 'image', icon: ImageIcon, label: 'Image' },
  { name: 'arrow', icon: ArrowRight, label: 'Arrow' },
] as const;

function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString();
}

export default function DmLocationToolbar({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDelete,
  onClear,
  gridEnabled,
  gridType,
  gridCellSize,
  gridColor,
  gridOpacity,
  onSetGridType,
  onUpdateGridSettings,
  onSyncToPlayers,
  onDownloadExport,
  syncing,
  hasUnsyncedChanges,
  lastSyncedAt,
  selectedElementId,
  isDmOnly,
  onToggleDmOnly,
}: DmLocationToolbarProps) {
  return (
    <div className="border-divider bg-surface-raised flex items-center gap-1 border-b px-2 py-1">
      {/* Left group: Tool buttons */}
      <div className="flex items-center gap-0.5">
        {TOOL_DEFS.map(({ name, icon: Icon, label }) => (
          <Button
            key={name}
            variant={activeTool === name ? 'primary' : 'ghost'}
            onClick={() => onToolChange(name)}
            title={label}
            className="h-8 w-8 p-0"
          >
            <Icon size={15} />
          </Button>
        ))}
      </div>

      <div className="bg-divider mx-1 h-6 w-px" />

      {/* Center group: History + destructive actions */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          className="h-8 w-8 p-0"
        >
          <Undo2 size={15} />
        </Button>
        <Button
          variant="ghost"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          className="h-8 w-8 p-0"
        >
          <Redo2 size={15} />
        </Button>
        <Button
          variant="ghost"
          onClick={onDelete}
          title="Delete selected"
          className="h-8 w-8 p-0"
        >
          <Trash2 size={15} />
        </Button>
        <Button
          variant="ghost"
          onClick={onClear}
          title="Clear canvas"
          className="text-accent-red-text h-8 w-8 p-0"
        >
          <Upload size={15} className="rotate-180" />
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right group */}
      <div className="flex items-center gap-1">
        {/* DM-only toggle — only shown when a single element is selected */}
        {selectedElementId != null && (
          <DmOnlyToggle isDmOnly={isDmOnly} onToggle={onToggleDmOnly} />
        )}

        {/* Grid type selector */}
        <div className="border-divider bg-surface flex items-center gap-0.5 rounded-md border p-0.5">
          <button
            onClick={() => onSetGridType('off')}
            title="No grid"
            className={`rounded px-2 py-1 text-xs transition-colors ${
              !gridEnabled
                ? 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                : 'text-muted hover:bg-surface-raised hover:text-body'
            }`}
          >
            Off
          </button>
          <button
            onClick={() => onSetGridType('hex')}
            title="Hex grid"
            className={`rounded px-2 py-1 text-xs transition-colors ${
              gridEnabled && gridType === 'hex'
                ? 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                : 'text-muted hover:bg-surface-raised hover:text-body'
            }`}
          >
            Hex
          </button>
          <button
            onClick={() => onSetGridType('square')}
            title="Square grid"
            className={`rounded px-2 py-1 text-xs transition-colors ${
              gridEnabled && gridType === 'square'
                ? 'bg-accent-blue-bg text-accent-blue-text font-semibold'
                : 'text-muted hover:bg-surface-raised hover:text-body'
            }`}
          >
            Square
          </button>
        </div>

        {/* Grid settings — visible when grid is enabled */}
        {gridEnabled && (
          <div className="flex items-center gap-2">
            <div className="bg-divider h-6 w-px" />

            {/* Grid color */}
            <label
              className="relative h-6 w-6 cursor-pointer"
              title="Grid color"
            >
              <input
                type="color"
                value={gridColor}
                onChange={e =>
                  onUpdateGridSettings({ strokeColor: e.target.value })
                }
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div
                className="border-divider h-6 w-6 rounded border"
                style={{ backgroundColor: gridColor }}
              />
            </label>

            {/* Cell size */}
            <span className="text-muted text-xs">Size</span>
            <input
              type="range"
              min={20}
              max={150}
              value={gridCellSize}
              onChange={e =>
                onUpdateGridSettings({ cellSize: Number(e.target.value) })
              }
              className="w-16"
            />
            <span className="text-muted w-7 text-xs">{gridCellSize}</span>

            {/* Opacity */}
            <span className="text-muted text-xs">Opacity</span>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(gridOpacity * 100)}
              onChange={e =>
                onUpdateGridSettings({ opacity: Number(e.target.value) / 100 })
              }
              className="w-16"
            />
            <span className="text-muted w-8 text-xs">
              {Math.round(gridOpacity * 100)}%
            </span>
          </div>
        )}

        {/* Sync status indicator */}
        <div className="flex items-center gap-1.5">
          {lastSyncedAt ? (
            <div
              className={`flex items-center gap-1 text-xs ${
                hasUnsyncedChanges
                  ? 'text-accent-amber-text'
                  : 'text-accent-emerald-text'
              }`}
              title={
                hasUnsyncedChanges
                  ? `Unsynced changes · Last synced ${formatSyncTime(lastSyncedAt)}`
                  : `Synced ${formatSyncTime(lastSyncedAt)}`
              }
            >
              {hasUnsyncedChanges ? (
                <AlertCircle size={12} />
              ) : (
                <Check size={12} />
              )}
              <span className="hidden sm:inline">
                {hasUnsyncedChanges
                  ? `Unsynced · ${formatSyncTime(lastSyncedAt)}`
                  : `Synced ${formatSyncTime(lastSyncedAt)}`}
              </span>
            </div>
          ) : (
            <span className="text-muted hidden text-xs sm:inline">
              Not synced yet
            </span>
          )}

          <Button
            variant="primary"
            onClick={onSyncToPlayers}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1 text-xs"
          >
            {syncing ? <Loader2 size={13} className="animate-spin" /> : null}
            Sync to Players
          </Button>
          <Button
            variant="ghost"
            onClick={onDownloadExport}
            title="Download PNG export (debug)"
            className="h-8 w-8 p-0"
          >
            <Upload size={15} className="rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}
