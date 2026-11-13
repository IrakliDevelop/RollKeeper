'use client';

import { Scissors, Eye, Minus, EyeOff, CloudFog } from 'lucide-react';
import { useActiveTool } from '@fieldnotes/react';

import { Button } from '@/components/ui/forms/button';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import DmLocationToolOptions, {
  type MarkerToolControls,
  type MeasureSharingControl,
  type MovementControls,
} from '@/components/ui/campaign/location-map/DmLocationToolOptions';
import type {
  DmFogControls,
  FogPresetControls,
} from '@/components/ui/campaign/location-map/fog';
import { MARKER_TOOL_NAME } from '@/components/ui/campaign/location-map/DmMarkerTool';
import { DisableableTooltip } from '@/components/ui/campaign/location-map/ToolOptionControls';
import { mapToolDefs } from '@/components/ui/campaign/location-map/mapToolDefs';
import { markerAudienceToggleTitle } from '@/components/ui/campaign/location-map/markerAudienceCopy';

import { useEffect, useRef, type ReactNode } from 'react';

import type { TokenInfoMode } from '@/components/ui/campaign/token-overlay';

const ICON_BUTTON_CLASS = 'w-9 shrink-0 px-0';

const DM_TOOLS = mapToolDefs([
  'hand',
  'select',
  'pencil',
  'arrow',
  'shape',
  'text',
  'note',
  'measure',
  'path',
  'template',
  'eraser',
  'laser',
  'ping',
  MARKER_TOOL_NAME,
]);

/**
 * Every tool name this toolbar can activate. Exported so tests iterate the
 * real list rather than a retyped copy — a newly added tool then cannot skip
 * the per-tool checks in `DmLocationToolOptions.test.tsx`.
 */
export const DM_VTT_TOOL_NAMES: readonly string[] = DM_TOOLS.map(
  def => def.name
);

export interface DmVttToolbarProps {
  sessionControls?: ReactNode;
  onClearDrawings: () => void;
  tokenInfoToggle: { mode: TokenInfoMode | null; onCycle: () => void };
  hiddenPlacementActive: boolean;
  onToggleHiddenPlacement: () => void;
  hiddenElementCount: number;
  onRevealAll: () => void;
  selectedElementId: string | null;
  selectedElementIsDmOnly: boolean;
  onToggleSelectedDmOnly: () => void;
  /** The selected element is a marker — the toggle then moves every sibling
   *  pin sharing its ref, and its copy says what sharing publishes. */
  selectedElementIsMarker?: boolean;
  /** Explanation for a refused marker audience transition, or null. */
  markerAudienceNotice?: string | null;
  /** Kind + colour for the marker tool; threaded to the shared options bar. */
  markerControls?: MarkerToolControls;
  measureSharing?: MeasureSharingControl;
  movementControls?: MovementControls;
  exportControl?: ReactNode;
  viewsControl?: ReactNode;
  /** Shared-presence "who is viewing" + cursor-sharing switches. */
  presenceControl?: ReactNode;
  fogControls?: DmFogControls;
  fogPresetControls?: FogPresetControls;
}

const TOKEN_INFO_ICON: Record<TokenInfoMode, typeof Eye> = {
  full: Eye,
  compact: Minus,
  off: EyeOff,
};

const TOKEN_INFO_LABEL: Record<TokenInfoMode, string> = {
  full: 'Token info: full',
  compact: 'Token info: compact',
  off: 'Token info: hidden',
};

/** Unified DM command dock. Session controls, canvas tools, and contextual
 * tool options share one self-sizing surface so responsive rows cannot
 * collide. The player toolbar deliberately remains independent.
 *
 * The canvas tools structurally mirror
 * `PlayerBattleMapCanvas`'s `PlayerToolbar`, minus the token tool (placed via
 * the roster in Task 8, never through this toolbar) plus a Clear-drawings
 * action. The connection-status chip lives solely in `DmVttTopBar` now (see
 * P7c) — this toolbar no longer duplicates it. */
export function DmVttToolbar({
  sessionControls,
  onClearDrawings,
  tokenInfoToggle,
  hiddenPlacementActive,
  onToggleHiddenPlacement,
  hiddenElementCount,
  onRevealAll,
  selectedElementId,
  selectedElementIsDmOnly,
  onToggleSelectedDmOnly,
  selectedElementIsMarker,
  markerAudienceNotice,
  markerControls,
  measureSharing,
  movementControls,
  exportControl,
  viewsControl,
  presenceControl,
  fogControls,
  fogPresetControls,
}: DmVttToolbarProps) {
  const [activeTool, setTool] = useActiveTool();
  const TokenInfoIcon = TOKEN_INFO_ICON[tokenInfoToggle.mode ?? 'compact'];
  const dockRef = useRef<HTMLDivElement>(null);
  const toolRefs = useRef(new Map<string, HTMLButtonElement>());

  const setToolRef = (name: string) => (node: HTMLButtonElement | null) => {
    if (node) toolRefs.current.set(name, node);
    else toolRefs.current.delete(name);
  };

  // The tool row scrolls sideways on narrow docks; keep the active tool on
  // screen without moving the page.
  useEffect(() => {
    toolRefs.current.get(activeTool)?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeTool]);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;

    const updatePanelTop = () => {
      const bottom = Math.ceil(dock.getBoundingClientRect().bottom + 12);
      document.documentElement.style.setProperty(
        '--dm-vtt-panel-top',
        `${bottom}px`
      );
    };
    updatePanelTop();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updatePanelTop);
    observer?.observe(dock);
    window.addEventListener('resize', updatePanelTop);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updatePanelTop);
      document.documentElement.style.removeProperty('--dm-vtt-panel-top');
    };
  }, []);

  const hiddenPlacementLabel = hiddenPlacementActive
    ? 'New elements are hidden from players'
    : 'New elements are visible to players';
  const revealAllLabel =
    hiddenElementCount === 0
      ? 'No hidden elements to reveal'
      : `Reveal all ${hiddenElementCount} hidden element${hiddenElementCount === 1 ? '' : 's'}`;
  // A marker's audience moves every sibling pin sharing its ref, and sharing
  // one also publishes its kind, label and colour (spec §7.4) — both stated
  // on the control that does it.
  const dmOnlyLabel = selectedElementIsMarker
    ? markerAudienceToggleTitle(selectedElementIsDmOnly)
    : selectedElementIsDmOnly
      ? 'Reveal selected element'
      : 'Hide selected element';
  const dmOnlyTooltip = selectedElementIsMarker
    ? dmOnlyLabel
    : selectedElementIsDmOnly
      ? 'Reveal selected element to players'
      : 'Hide selected element from players';
  const tokenInfoLabel = TOKEN_INFO_LABEL[tokenInfoToggle.mode ?? 'compact'];

  return (
    <TooltipProvider>
      <div
        ref={dockRef}
        className="bg-surface-raised border-divider pointer-events-auto fixed inset-x-0 top-0 z-20 flex w-full flex-col overflow-hidden border-b 2xl:flex-row 2xl:flex-wrap"
        data-testid="dm-vtt-command-dock"
      >
        {sessionControls && (
          <div className="border-divider min-w-0 shrink-0 border-b 2xl:border-r 2xl:border-b-0">
            {sessionControls}
          </div>
        )}
        <div className="scrollbar-thin flex min-w-0 flex-1 items-center gap-3 overflow-x-auto overscroll-x-contain px-2 py-1">
          <div className="flex shrink-0 items-center gap-1">
            {DM_TOOLS.map(({ name, label, Icon }) => (
              <Tooltip key={name} content={label}>
                <Button
                  ref={setToolRef(name)}
                  variant="ghost"
                  size="sm"
                  selected={activeTool === name}
                  aria-pressed={activeTool === name}
                  onClick={() => setTool(name)}
                  className={ICON_BUTTON_CLASS}
                  aria-label={label}
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
                    ref={setToolRef('fog')}
                    variant="ghost"
                    size="sm"
                    selected={activeTool === 'fog'}
                    aria-pressed={activeTool === 'fog'}
                    onClick={fogControls.requestActivate}
                    disabled={fogControls.disabled}
                    className={ICON_BUTTON_CLASS}
                    aria-label="Fog of war"
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
          <div className="border-divider flex shrink-0 items-center gap-1 border-l pl-3">
            <Tooltip content={hiddenPlacementLabel}>
              <Button
                variant="ghost"
                size="sm"
                selected={hiddenPlacementActive}
                onClick={onToggleHiddenPlacement}
                className="px-2"
                aria-label="Place hidden elements"
                aria-pressed={hiddenPlacementActive}
              >
                <EyeOff size={16} />
                <span className="type-small ml-1.5 hidden xl:inline">
                  {hiddenPlacementActive ? 'Placing hidden' : 'Place hidden'}
                </span>
              </Button>
            </Tooltip>
            <DisableableTooltip
              content={revealAllLabel}
              disabled={hiddenElementCount === 0}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={onRevealAll}
                disabled={hiddenElementCount === 0}
                className="px-2"
                aria-label={`Reveal all hidden elements (${hiddenElementCount})`}
              >
                <Eye size={16} />
                <span className="type-small ml-1.5 hidden xl:inline">
                  Reveal all ({hiddenElementCount})
                </span>
              </Button>
            </DisableableTooltip>
            {selectedElementId && (
              <Tooltip content={dmOnlyTooltip}>
                <Button
                  data-testid="dm-vtt-dm-only-toggle"
                  variant="ghost"
                  size="sm"
                  selected={selectedElementIsDmOnly}
                  onClick={onToggleSelectedDmOnly}
                  className={ICON_BUTTON_CLASS}
                  aria-label={dmOnlyLabel}
                >
                  {selectedElementIsDmOnly ? (
                    <Eye size={16} />
                  ) : (
                    <EyeOff size={16} />
                  )}
                </Button>
              </Tooltip>
            )}
            {markerAudienceNotice != null && (
              <span
                role="status"
                className="type-small text-ember-text max-w-xs"
              >
                {markerAudienceNotice}
              </span>
            )}
            <Tooltip content="Clear drawings">
              <Button
                variant="danger"
                size="sm"
                onClick={onClearDrawings}
                className={ICON_BUTTON_CLASS}
                aria-label="Clear drawings"
              >
                <Scissors size={16} />
              </Button>
            </Tooltip>
            <Tooltip content={tokenInfoLabel}>
              <Button
                variant="ghost"
                size="sm"
                onClick={tokenInfoToggle.onCycle}
                className={ICON_BUTTON_CLASS}
                aria-label={tokenInfoLabel}
              >
                <TokenInfoIcon size={16} />
              </Button>
            </Tooltip>
            {exportControl}
            {viewsControl}
            {presenceControl}
          </div>
        </div>
        <div className="border-divider w-full border-t empty:hidden">
          <DmLocationToolOptions
            mode="battlemap"
            selectionControls
            measureSharing={measureSharing}
            markerControls={markerControls}
            movementControls={movementControls}
            fogControls={fogControls}
            fogPresetControls={fogPresetControls}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
