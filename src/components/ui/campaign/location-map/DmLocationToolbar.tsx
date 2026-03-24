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
  onToggleGrid,
  onSyncToPlayers,
  syncing,
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

        <Button
          variant={gridEnabled ? 'secondary' : 'ghost'}
          onClick={onToggleGrid}
          title={gridEnabled ? 'Hide grid' : 'Show grid'}
          className="h-8 w-8 p-0"
        >
          <Grid3X3 size={15} />
        </Button>

        <Button
          variant="primary"
          onClick={onSyncToPlayers}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1 text-xs"
        >
          {syncing ? <Loader2 size={13} className="animate-spin" /> : null}
          Sync to Players
        </Button>
      </div>
    </div>
  );
}
