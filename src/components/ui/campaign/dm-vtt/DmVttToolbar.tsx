'use client';

import {
  Hand,
  MousePointer2,
  Pencil,
  MoveUpRight,
  Ruler,
  Circle,
  Type,
  StickyNote,
  Shapes,
  Eraser,
  Scissors,
  Eye,
  Minus,
  EyeOff,
  Zap,
  MapPin,
  Flag,
} from 'lucide-react';
import { useActiveTool } from '@fieldnotes/react';

import { Button } from '@/components/ui/forms/button';
import DmLocationToolOptions, {
  type MarkerToolControls,
  type MeasureSharingControl,
} from '@/components/ui/campaign/location-map/DmLocationToolOptions';
import { MARKER_TOOL_NAME } from '@/components/ui/campaign/location-map/DmMarkerTool';
import { markerAudienceToggleTitle } from '@/components/ui/campaign/location-map/markerAudienceCopy';

import { useEffect, useRef, type ReactNode } from 'react';

import type { TokenInfoMode } from '@/components/ui/campaign/token-overlay';

const DM_TOOLS: { name: string; label: string; Icon: typeof Hand }[] = [
  { name: 'hand', label: 'Pan', Icon: Hand },
  { name: 'select', label: 'Select', Icon: MousePointer2 },
  { name: 'pencil', label: 'Draw', Icon: Pencil },
  { name: 'arrow', label: 'Arrow', Icon: MoveUpRight },
  { name: 'shape', label: 'Shape', Icon: Shapes },
  { name: 'text', label: 'Text', Icon: Type },
  { name: 'note', label: 'Sticky Note', Icon: StickyNote },
  { name: 'measure', label: 'Measure', Icon: Ruler },
  { name: 'template', label: 'Template', Icon: Circle },
  { name: 'eraser', label: 'Eraser', Icon: Eraser },
  { name: 'laser', label: 'Laser pointer', Icon: Zap },
  { name: 'ping', label: 'Ping (look here)', Icon: MapPin },
  { name: MARKER_TOOL_NAME, label: 'Marker', Icon: Flag },
];

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
  exportControl?: ReactNode;
  viewsControl?: ReactNode;
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
  exportControl,
  viewsControl,
}: DmVttToolbarProps) {
  const [activeTool, setTool] = useActiveTool();
  const TokenInfoIcon = TOKEN_INFO_ICON[tokenInfoToggle.mode ?? 'compact'];
  const dockRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={dockRef}
      className="bg-surface-raised border-divider pointer-events-auto fixed inset-x-0 top-0 z-20 flex w-full flex-col overflow-hidden border-b shadow-xl 2xl:flex-row 2xl:flex-wrap"
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
            <Button
              key={name}
              variant={activeTool === name ? 'primary' : 'ghost'}
              onClick={() => setTool(name)}
              className="min-h-[44px] min-w-[44px] p-0"
              title={label}
              aria-label={label}
            >
              <Icon size={16} />
            </Button>
          ))}
        </div>
        <div className="border-divider flex shrink-0 items-center gap-1 border-l pl-3">
          <Button
            variant={hiddenPlacementActive ? 'warning' : 'ghost'}
            onClick={onToggleHiddenPlacement}
            className="min-h-[44px] px-2"
            title={
              hiddenPlacementActive
                ? 'New elements are hidden from players'
                : 'New elements are visible to players'
            }
            aria-label="Place hidden elements"
            aria-pressed={hiddenPlacementActive}
          >
            <EyeOff size={16} />
            <span className="ml-1.5 hidden text-xs xl:inline">
              {hiddenPlacementActive ? 'Placing hidden' : 'Place hidden'}
            </span>
          </Button>
          <Button
            variant="ghost"
            onClick={onRevealAll}
            disabled={hiddenElementCount === 0}
            className="min-h-[44px] px-2"
            title={
              hiddenElementCount === 0
                ? 'No hidden elements to reveal'
                : `Reveal all ${hiddenElementCount} hidden element${hiddenElementCount === 1 ? '' : 's'}`
            }
            aria-label={`Reveal all hidden elements (${hiddenElementCount})`}
          >
            <Eye size={16} />
            <span className="ml-1.5 hidden text-xs xl:inline">
              Reveal all ({hiddenElementCount})
            </span>
          </Button>
          {selectedElementId && (
            <Button
              data-testid="dm-vtt-dm-only-toggle"
              variant={selectedElementIsDmOnly ? 'warning' : 'ghost'}
              onClick={onToggleSelectedDmOnly}
              className="min-h-[44px] px-2"
              // A marker's audience moves every sibling pin sharing its ref,
              // and sharing one also publishes its kind, label and colour
              // (spec §7.4) — both stated on the control that does it.
              title={
                selectedElementIsMarker
                  ? markerAudienceToggleTitle(selectedElementIsDmOnly)
                  : selectedElementIsDmOnly
                    ? 'Reveal selected element to players'
                    : 'Hide selected element from players'
              }
              aria-label={
                selectedElementIsMarker
                  ? markerAudienceToggleTitle(selectedElementIsDmOnly)
                  : selectedElementIsDmOnly
                    ? 'Reveal selected element'
                    : 'Hide selected element'
              }
            >
              {selectedElementIsDmOnly ? (
                <Eye size={16} />
              ) : (
                <EyeOff size={16} />
              )}
            </Button>
          )}
          {markerAudienceNotice != null && (
            <span
              role="status"
              className="text-accent-amber-text bg-accent-amber-bg border-accent-amber-border max-w-xs rounded border px-2 py-1 text-xs"
            >
              {markerAudienceNotice}
            </span>
          )}
          <Button
            variant="ghost"
            onClick={onClearDrawings}
            className="min-h-[44px] min-w-[44px] p-0"
            title="Clear drawings"
            aria-label="Clear drawings"
          >
            <Scissors size={16} />
          </Button>
          <Button
            variant="ghost"
            onClick={tokenInfoToggle.onCycle}
            className="min-h-[44px] min-w-[44px] p-0"
            title={TOKEN_INFO_LABEL[tokenInfoToggle.mode ?? 'compact']}
            aria-label={TOKEN_INFO_LABEL[tokenInfoToggle.mode ?? 'compact']}
          >
            <TokenInfoIcon size={16} />
          </Button>
          {exportControl}
          {viewsControl}
        </div>
      </div>
      <div className="border-divider w-full border-t empty:hidden">
        <DmLocationToolOptions
          mode="battlemap"
          selectionControls
          measureSharing={measureSharing}
          markerControls={markerControls}
        />
      </div>
    </div>
  );
}
