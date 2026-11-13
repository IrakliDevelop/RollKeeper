'use client';

import {
  Undo2,
  Redo2,
  X,
  Check,
  AlertCircle,
  ExternalLink,
  Maximize,
  Map as MapIcon,
  Move,
  Eye,
  EyeOff,
  Loader2,
  CloudFog,
} from 'lucide-react';
import { useActiveTool, useHistory } from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import DmLocationGridPopover from './DmLocationGridPopover';
import { DisableableTooltip } from './ToolOptionControls';
import DmOnlyToggle from './DmOnlyToggle';
import { MARKER_TOOL_NAME } from './DmMarkerTool';
import { mapToolDefs } from './mapToolDefs';
import type { DmLocationToolbarProps } from './DmLocationToolbar.types';

const ICON_BUTTON_CLASS = 'w-9 shrink-0 px-0';

const BASE_TOOL_DEFS = mapToolDefs([
  'hand',
  'select',
  'text',
  'note',
  'shape',
  'image',
  'arrow',
  MARKER_TOOL_NAME,
]);

/** Battle maps only: grid-distance, movement and cleanup tools. */
const BATTLEMAP_ONLY_TOOL_DEFS = mapToolDefs([
  'measure',
  'path',
  'template',
  'eraser',
]);

/** Ephemeral "look here" tools: battle maps always, locations when live sync
 *  is configured (they broadcast as relay presence, never as canvas state). */
const PRESENCE_TOOL_DEFS = mapToolDefs(['laser', 'ping']);

export const DM_LOCATION_PRESENCE_TOOL_NAMES: readonly string[] =
  PRESENCE_TOOL_DEFS.map(def => def.name);

export const DM_LOCATION_BATTLEMAP_ONLY_TOOL_NAMES: readonly string[] =
  BATTLEMAP_ONLY_TOOL_DEFS.map(def => def.name);

/**
 * Every tool name this toolbar can activate, in both modes. Exported so tests
 * iterate the real list rather than a retyped copy — a newly added tool then
 * cannot skip the per-tool checks in `DmLocationToolOptions.test.tsx`.
 */
export const DM_LOCATION_TOOL_NAMES: readonly string[] = [
  ...BASE_TOOL_DEFS,
  ...BATTLEMAP_ONLY_TOOL_DEFS,
  ...PRESENCE_TOOL_DEFS,
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

function LiveSyncChip({
  status,
}: {
  status: DmLocationToolbarProps['syncStatus'];
}) {
  if (status === 'disabled') {
    return (
      <span
        data-testid="live-sync-chip"
        className="type-small text-muted flex items-center gap-1.5"
      >
        Sync off
      </span>
    );
  }
  return (
    <span
      data-testid="live-sync-chip"
      className="type-small text-body flex items-center gap-1.5"
    >
      {status === 'connecting' ? (
        <Loader2 aria-hidden size={14} className="text-muted animate-spin" />
      ) : (
        <span
          aria-hidden
          className={`size-2 rounded-full ${
            status === 'live'
              ? 'bg-verdigris-fill'
              : status === 'denied'
                ? 'bg-blood-fill'
                : 'bg-divider-strong'
          }`}
        />
      )}
      {status === 'live'
        ? 'Live'
        : status === 'connecting'
          ? 'Connecting…'
          : status === 'offline'
            ? 'Offline'
            : 'Denied'}
    </span>
  );
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
  fogControls,
  liveSyncConfigured = false,
}: DmLocationToolbarProps) {
  const [activeTool, setTool] = useActiveTool();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const toolDefs =
    mode === 'battlemap'
      ? [...BASE_TOOL_DEFS, ...BATTLEMAP_ONLY_TOOL_DEFS, ...PRESENCE_TOOL_DEFS]
      : liveSyncConfigured
        ? [...BASE_TOOL_DEFS, ...PRESENCE_TOOL_DEFS]
        : BASE_TOOL_DEFS;

  // Live controls: always on battle maps; on locations only with a relay.
  const liveControls = mode === 'battlemap' || liveSyncConfigured;

  const handleToolClick = (name: string) => {
    if (name === 'image') {
      onPickImage();
      return;
    }
    setTool(name);
  };

  return (
    <TooltipProvider>
      <div className="border-divider bg-surface-raised flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-2 py-1">
        {/* Left group: Tool buttons */}
        <div className="flex items-center gap-0.5">
          {toolDefs.map(({ name, label, Icon }) => (
            <Tooltip key={name} content={label}>
              <Button
                variant="ghost"
                size="sm"
                selected={activeTool === name}
                // The image tool is an action (opens the picker), not a mode.
                aria-pressed={
                  name === 'image' ? undefined : activeTool === name
                }
                aria-label={label}
                onClick={() => handleToolClick(name)}
                className={ICON_BUTTON_CLASS}
              >
                <Icon size={16} />
              </Button>
            </Tooltip>
          ))}
          {fogControls && (
            <>
              <DisableableTooltip
                content={fogControls.disabledReason ?? 'Fog of war'}
                disabled={fogControls.disabled}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  selected={activeTool === 'fog'}
                  aria-pressed={activeTool === 'fog'}
                  onClick={fogControls.requestActivate}
                  disabled={fogControls.disabled}
                  aria-label="Fog of war"
                  className={ICON_BUTTON_CLASS}
                >
                  <CloudFog size={16} />
                </Button>
              </DisableableTooltip>
              {fogControls.diagnostic && (
                <span
                  role="alert"
                  className="type-small text-blood-text max-w-64"
                >
                  {fogControls.diagnostic}
                </span>
              )}
            </>
          )}
        </div>

        <div aria-hidden className="bg-divider mx-1 h-6 w-px" />

        {/* Center group: History + destructive actions */}
        <div className="flex items-center gap-0.5">
          <DisableableTooltip content="Undo" disabled={!canUndo}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => undo()}
              disabled={!canUndo}
              aria-label="Undo"
              className={ICON_BUTTON_CLASS}
            >
              <Undo2 size={16} />
            </Button>
          </DisableableTooltip>
          <DisableableTooltip content="Redo" disabled={!canRedo}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => redo()}
              disabled={!canRedo}
              aria-label="Redo"
              className={ICON_BUTTON_CLASS}
            >
              <Redo2 size={16} />
            </Button>
          </DisableableTooltip>
          <Tooltip content="Fit map to screen">
            <Button
              variant="ghost"
              size="sm"
              onClick={onFitToMap}
              aria-label="Fit map to screen"
              className={ICON_BUTTON_CLASS}
            >
              <Maximize size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Clear canvas">
            <Button
              variant="danger"
              size="sm"
              onClick={onClear}
              aria-label="Clear canvas"
              className={ICON_BUTTON_CLASS}
            >
              <X size={16} />
            </Button>
          </Tooltip>
        </div>

        {mode === 'battlemap' && onPickMapImage && (
          <>
            <div aria-hidden className="bg-divider mx-1 h-6 w-px" />
            <DisableableTooltip
              content="Add map image"
              disabled={arrangeMapsActive === true}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={onPickMapImage}
                disabled={arrangeMapsActive}
                leftIcon={<MapIcon size={16} />}
              >
                Add map
              </Button>
            </DisableableTooltip>
            {onToggleArrangeMaps && (
              <Tooltip
                content={
                  arrangeMapsActive
                    ? 'Finish arranging — re-locks map images'
                    : 'Arrange map images (unlocks the map layer)'
                }
              >
                <Button
                  variant="ghost"
                  size="sm"
                  selected={arrangeMapsActive}
                  onClick={onToggleArrangeMaps}
                  leftIcon={<Move size={16} />}
                >
                  {arrangeMapsActive ? 'Done arranging' : 'Arrange maps'}
                </Button>
              </Tooltip>
            )}
          </>
        )}

        {/* Right group */}
        <div className="ml-auto flex items-center gap-1">
          {liveControls && (
            <>
              <Tooltip
                content={
                  hiddenPlacementActive
                    ? 'New elements are hidden from players'
                    : 'New elements are visible to players'
                }
              >
                <Button
                  variant="ghost"
                  size="sm"
                  selected={hiddenPlacementActive}
                  onClick={onToggleHiddenPlacement}
                  aria-pressed={hiddenPlacementActive}
                  leftIcon={<EyeOff size={16} />}
                >
                  {hiddenPlacementActive ? 'Placing hidden' : 'Place hidden'}
                </Button>
              </Tooltip>
              <DisableableTooltip
                disabled={hiddenElementCount === 0}
                content={
                  hiddenElementCount === 0
                    ? 'No hidden elements to reveal'
                    : `Reveal all ${hiddenElementCount} hidden element${hiddenElementCount === 1 ? '' : 's'} to players`
                }
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRevealAll}
                  disabled={hiddenElementCount === 0}
                  leftIcon={<Eye size={16} />}
                >
                  Reveal all ({hiddenElementCount})
                </Button>
              </DisableableTooltip>
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
            <span role="status" className="type-small text-ember-text max-w-xs">
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
                hasUnsyncedChanges ? (
                  <span className="flex items-center gap-1">
                    <AlertCircle size={14} className="text-ember-text" />
                    <span className="type-small text-ember-text">
                      {`Unsynced · ${formatSyncTime(lastSyncedAt)}`}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Check size={14} className="text-verdigris-text" />
                    <span className="type-small text-muted">
                      {`Synced ${formatSyncTime(lastSyncedAt)}`}
                    </span>
                  </span>
                )
              ) : (
                <span className="type-small text-muted">Not synced yet</span>
              ))}

            {mode === 'battlemap' && onOpenTvDisplay && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenTvDisplay}
                leftIcon={<ExternalLink size={16} />}
              >
                Open TV display
              </Button>
            )}
            {mode === 'battlemap' && exportControl}
            {mode === 'battlemap' && viewsControl}
            {liveControls && presenceControl}
            {liveControls && <LiveSyncChip status={syncStatus} />}
            {mode === 'battlemap' && (
              <Tooltip
                content={
                  sharedWithPlayers
                    ? 'Players see the join banner — click to end'
                    : 'Show a join banner on player character sheets'
                }
              >
                <Button
                  variant="secondary"
                  size="sm"
                  selected={sharedWithPlayers}
                  onClick={onToggleShareWithPlayers}
                >
                  {sharedWithPlayers
                    ? 'Live for players'
                    : 'Share with players'}
                </Button>
              </Tooltip>
            )}
            {mode !== 'battlemap' && (
              <Button
                variant="primary"
                size="sm"
                onClick={onSyncToPlayers}
                loading={syncing}
              >
                Sync to players
              </Button>
            )}
            {mode !== 'battlemap' && exportControl}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
