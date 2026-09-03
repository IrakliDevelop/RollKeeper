'use client';

import {
  Hand,
  MousePointer2,
  Type,
  StickyNote,
  Shapes,
  Image as ImageIcon,
  ArrowRight,
  Ruler,
  Sparkles,
  Undo2,
  Redo2,
  Eraser,
  X,
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  Maximize,
  Map as MapIcon,
  Move,
  Footprints,
  Eye,
  EyeOff,
  Zap,
  MapPin,
  Flag,
} from 'lucide-react';
import { useActiveTool, useHistory } from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import DmLocationGridPopover from './DmLocationGridPopover';
import DmOnlyToggle from './DmOnlyToggle';
import { MARKER_TOOL_NAME } from './DmMarkerTool';
import type { DmLocationToolbarProps } from './DmLocationToolbar.types';

const BASE_TOOL_DEFS = [
  { name: 'hand', icon: Hand, label: 'Pan' },
  { name: 'select', icon: MousePointer2, label: 'Select' },
  { name: 'text', icon: Type, label: 'Text' },
  { name: 'note', icon: StickyNote, label: 'Sticky Note' },
  { name: 'shape', icon: Shapes, label: 'Shape' },
  { name: 'image', icon: ImageIcon, label: 'Image' },
  { name: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { name: MARKER_TOOL_NAME, icon: Flag, label: 'Marker' },
] as const;

const BATTLEMAP_TOOL_DEFS = [
  { name: 'measure', icon: Ruler, label: 'Measure' },
  { name: 'path', icon: Footprints, label: 'Move' },
  { name: 'template', icon: Sparkles, label: 'Template' },
  { name: 'eraser', icon: Eraser, label: 'Eraser' },
  { name: 'laser', icon: Zap, label: 'Laser pointer' },
  { name: 'ping', icon: MapPin, label: 'Ping (look here)' },
] as const;

/**
 * Every tool name this toolbar can activate, in both modes. Exported so tests
 * iterate the real list rather than a retyped copy — a newly added tool then
 * cannot skip the per-tool checks in `DmLocationToolOptions.test.tsx`.
 */
export const DM_LOCATION_TOOL_NAMES: readonly string[] = [
  ...BASE_TOOL_DEFS,
  ...BATTLEMAP_TOOL_DEFS,
].map(def => def.name);

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
  onPickImage,
  onPickMapImage,
  onClear,
  onFitToMap,
  gridEnabled,
  gridType,
  gridCellSize,
  gridColor,
  gridOpacity,
  onSetGridType,
  onUpdateGridSettings,
  onSyncToPlayers,
  syncing,
  hasUnsyncedChanges,
  lastSyncedAt,
  selectedElementId,
  isDmOnly,
  onToggleDmOnly,
  selectedElementIsMarker,
  markerAudienceNotice,
  hiddenPlacementActive,
  onToggleHiddenPlacement,
  hiddenElementCount,
  onRevealAll,
  mode,
  onOpenTvDisplay,
  syncStatus,
  sharedWithPlayers,
  onToggleShareWithPlayers,
  arrangeMapsActive,
  onToggleArrangeMaps,
  exportControl,
  viewsControl,
  presenceControl,
}: DmLocationToolbarProps) {
  const [activeTool, setTool] = useActiveTool();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const toolDefs =
    mode === 'battlemap'
      ? [...BASE_TOOL_DEFS, ...BATTLEMAP_TOOL_DEFS]
      : BASE_TOOL_DEFS;

  const handleToolClick = (name: string) => {
    if (name === 'image') {
      onPickImage();
      return;
    }
    setTool(name);
  };

  return (
    <div className="border-divider bg-surface-raised flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-2 py-1">
      {/* Left group: Tool buttons */}
      <div className="flex items-center gap-0.5">
        {toolDefs.map(({ name, icon: Icon, label }) => (
          <Button
            key={name}
            variant={activeTool === name ? 'primary' : 'ghost'}
            onClick={() => handleToolClick(name)}
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
          onClick={() => undo()}
          disabled={!canUndo}
          title="Undo"
          className="h-8 w-8 p-0"
        >
          <Undo2 size={15} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => redo()}
          disabled={!canRedo}
          title="Redo"
          className="h-8 w-8 p-0"
        >
          <Redo2 size={15} />
        </Button>
        <Button
          variant="ghost"
          onClick={onFitToMap}
          title="Fit map to screen"
          className="h-8 w-8 p-0"
        >
          <Maximize size={15} />
        </Button>
        <Button
          variant="ghost"
          onClick={onClear}
          title="Clear canvas"
          className="text-accent-red-text h-8 w-8 p-0"
        >
          <X size={15} />
        </Button>
      </div>

      {mode === 'battlemap' && onPickMapImage && (
        <>
          <div className="bg-divider mx-1 h-6 w-px" />
          <Button
            variant="ghost"
            onClick={onPickMapImage}
            disabled={arrangeMapsActive}
            title="Add map image"
            className="flex items-center gap-1.5 px-2 py-1 text-xs"
          >
            <MapIcon size={15} />
            Add map
          </Button>
          {onToggleArrangeMaps && (
            <Button
              variant={arrangeMapsActive ? 'warning' : 'ghost'}
              onClick={onToggleArrangeMaps}
              title={
                arrangeMapsActive
                  ? 'Finish arranging — re-locks map images'
                  : 'Arrange map images (unlocks the map layer)'
              }
              className="flex items-center gap-1.5 px-2 py-1 text-xs"
            >
              <Move size={15} />
              {arrangeMapsActive ? 'Done arranging' : 'Arrange maps'}
            </Button>
          )}
        </>
      )}

      {/* Right group */}
      <div className="ml-auto flex items-center gap-1">
        {mode === 'battlemap' && (
          <>
            <Button
              variant={hiddenPlacementActive ? 'warning' : 'ghost'}
              onClick={onToggleHiddenPlacement}
              title={
                hiddenPlacementActive
                  ? 'New elements are hidden from players'
                  : 'New elements are visible to players'
              }
              aria-pressed={hiddenPlacementActive}
              className="flex items-center gap-1.5 px-2 py-1 text-xs"
            >
              <EyeOff size={14} />
              {hiddenPlacementActive ? 'Placing hidden' : 'Place hidden'}
            </Button>
            <Button
              variant="ghost"
              onClick={onRevealAll}
              disabled={hiddenElementCount === 0}
              title={
                hiddenElementCount === 0
                  ? 'No hidden elements to reveal'
                  : `Reveal all ${hiddenElementCount} hidden element${hiddenElementCount === 1 ? '' : 's'} to players`
              }
              className="flex items-center gap-1.5 px-2 py-1 text-xs"
            >
              <Eye size={14} />
              Reveal all ({hiddenElementCount})
            </Button>
          </>
        )}

        {/* DM-only toggle — only shown when a single element is selected */}
        {selectedElementId != null && (
          <DmOnlyToggle
            isDmOnly={isDmOnly}
            onToggle={onToggleDmOnly}
            isMarker={selectedElementIsMarker === true}
          />
        )}

        {/* A refused audience transition is explained right where it was
            attempted. `role="status"` so it is announced without stealing
            focus — the DM is mid-toggle, not mid-dialog. */}
        {markerAudienceNotice != null && (
          <span
            role="status"
            className="text-accent-amber-text bg-accent-amber-bg border-accent-amber-border max-w-xs rounded border px-2 py-1 text-xs"
          >
            {markerAudienceNotice}
          </span>
        )}

        <DmLocationGridPopover
          gridEnabled={gridEnabled}
          gridType={gridType}
          gridCellSize={gridCellSize}
          gridColor={gridColor}
          gridOpacity={gridOpacity}
          onSetGridType={onSetGridType}
          onUpdateGridSettings={onUpdateGridSettings}
        />

        {/* Sync status indicator */}
        <div className="flex items-center gap-1.5">
          {mode !== 'battlemap' &&
            (lastSyncedAt ? (
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
            ))}

          {mode === 'battlemap' && onOpenTvDisplay && (
            <Button
              variant="outline"
              onClick={onOpenTvDisplay}
              className="flex items-center gap-1.5 px-3 py-1 text-xs"
            >
              <ExternalLink size={13} />
              Open TV Display
            </Button>
          )}
          {mode === 'battlemap' && exportControl}
          {mode === 'battlemap' && viewsControl}
          {mode === 'battlemap' && presenceControl}
          {mode === 'battlemap' && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                syncStatus === 'live'
                  ? 'bg-accent-emerald-bg text-accent-emerald-text'
                  : syncStatus === 'connecting'
                    ? 'bg-accent-amber-bg text-accent-amber-text'
                    : syncStatus === 'denied' || syncStatus === 'offline'
                      ? 'bg-accent-red-bg text-accent-red-text'
                      : 'text-muted'
              }`}
              title={
                syncStatus === 'disabled'
                  ? 'Live sync not configured (NEXT_PUBLIC_BATTLEMAP_RELAY_URL)'
                  : `Live sync: ${syncStatus}`
              }
            >
              {syncStatus === 'live'
                ? 'Live'
                : syncStatus === 'connecting'
                  ? 'Connecting…'
                  : syncStatus === 'offline'
                    ? 'Offline'
                    : syncStatus === 'denied'
                      ? 'Denied'
                      : 'Sync off'}
            </span>
          )}
          {mode === 'battlemap' && (
            <Button
              variant={sharedWithPlayers ? 'success' : 'outline'}
              onClick={onToggleShareWithPlayers}
              className="flex items-center gap-1.5 px-3 py-1 text-xs"
              title={
                sharedWithPlayers
                  ? 'Players see the join banner — click to end'
                  : 'Show a join banner on player character sheets'
              }
            >
              {sharedWithPlayers ? 'Live for players' : 'Share with players'}
            </Button>
          )}
          {mode !== 'battlemap' && (
            <Button
              variant="primary"
              onClick={onSyncToPlayers}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1 text-xs"
            >
              {syncing ? <Loader2 size={13} className="animate-spin" /> : null}
              Sync to Players
            </Button>
          )}
          {mode !== 'battlemap' && exportControl}
        </div>
      </div>
    </div>
  );
}
