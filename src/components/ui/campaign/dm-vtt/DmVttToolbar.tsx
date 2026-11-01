'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { TokenInfoMode } from '@/components/ui/campaign/token-overlay';
import type {
  MarkerToolControls,
  MeasureSharingControl,
  MovementControls,
} from '@/components/ui/campaign/location-map/DmLocationToolOptions';
import type {
  DmFogControls,
  FogPresetControls,
} from '@/components/ui/campaign/location-map/fog';
import { DmVttToolStrip } from './DmVttToolStrip';
import { DmVttMapControls } from './DmVttMapControls';
import { DmVttToolContext } from './DmVttToolContext';

export { DM_VTT_TOOL_NAMES } from './DmVttToolStrip';

export interface DmVttToolbarProps {
  sessionControls?: ReactNode;
  /** Setup uses a flowing dock below its page header. */
  position?: 'fixed' | 'flow';
  onPickImage?: () => void;
  buildActions?: ReactNode;
  utilityExtras?: ReactNode;
  clearLabel?: string;
  onClearDrawings: () => void;
  tokenInfoToggle?: { mode: TokenInfoMode | null; onCycle: () => void };
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
  /** Tool names not offered on this surface (the private editor, CC4). */
  hiddenTools?: readonly string[];
  measureSharing?: MeasureSharingControl;
  movementControls?: MovementControls;
  exportControl?: ReactNode;
  viewsControl?: ReactNode;
  /** Shared-presence "who is viewing" + cursor-sharing switches. */
  presenceControl?: ReactNode;
  /** PR06 W10: the Table "Edit map" tool group (absent on legacy maps). */
  editMapControl?: ReactNode;
  /** Retained for callers; session controls now always stack above tools. */
  sideBySide?: '2xl' | 'never';
  fogControls?: DmFogControls;
  fogPresetControls?: FogPresetControls;
}

/** A measured dock shared by the private editor and Table. Session commands
 * remain above canvas tools; only the tool picker row scrolls horizontally. */
export function DmVttToolbar(props: DmVttToolbarProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const updatePanelTop = () => {
      document.documentElement.style.setProperty(
        '--dm-vtt-panel-top',
        `${Math.ceil(dock.getBoundingClientRect().bottom + 12)}px`
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
      data-testid="dm-vtt-command-dock"
      className={`bg-surface-raised border-divider pointer-events-auto z-20 flex w-full min-w-0 flex-col border-b ${props.position === 'flow' ? 'relative' : 'fixed inset-x-0 top-0'}`}
    >
      {props.sessionControls && (
        <div className="border-divider min-w-0 border-b">
          {props.sessionControls}
        </div>
      )}
      <div className="flex min-w-0 flex-col lg:flex-row lg:flex-wrap lg:items-center">
        <DmVttToolStrip
          onPickImage={props.onPickImage}
          hiddenTools={props.hiddenTools}
          fogControls={props.fogControls}
        />
        <DmVttMapControls {...props} />
      </div>
      <DmVttToolContext {...props} />
    </div>
  );
}
