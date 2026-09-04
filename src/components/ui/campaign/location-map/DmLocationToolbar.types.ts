import type { ReactNode } from 'react';
import type { EditorMode } from './DmLocationEditor.types';
import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';
import type { DmFogControls } from './fog';

export interface DmLocationToolbarProps {
  onPickImage: () => void;
  onClear: () => void;
  onFitToMap: () => void;
  gridEnabled: boolean;
  gridType: 'square' | 'hex';
  gridCellSize: number;
  gridColor: string;
  gridOpacity: number;
  onSetGridType: (type: 'square' | 'hex' | 'off') => void;
  onUpdateGridSettings: (settings: {
    cellSize?: number;
    strokeColor?: string;
    opacity?: number;
  }) => void;
  onSyncToPlayers: () => void;
  syncing: boolean;
  /** ID of the currently selected element, or null if none */
  selectedElementId: string | null;
  isDmOnly: boolean;
  onToggleDmOnly: () => void;
  /** The selected element is a marker — the toggle then moves every sibling
   *  pin sharing its ref, and its copy says what sharing publishes. */
  selectedElementIsMarker?: boolean;
  /** Explanation for a refused marker audience transition, or null. */
  markerAudienceNotice?: string | null;
  hiddenPlacementActive: boolean;
  onToggleHiddenPlacement: () => void;
  hiddenElementCount: number;
  onRevealAll: () => void;
  /** Whether canvas has changed since last sync */
  hasUnsyncedChanges: boolean;
  /** ISO timestamp of last successful sync, or null if never synced */
  lastSyncedAt: string | null;
  mode?: EditorMode;
  onOpenTvDisplay?: () => void;
  /** Live sync connection status (battlemap mode only); 'disabled' when the relay isn't configured. */
  syncStatus: BattleMapConnectionStatus | 'disabled';
  /** Whether the battle map is currently shared with players (battlemap mode only) */
  sharedWithPlayers?: boolean;
  onToggleShareWithPlayers?: () => void;
  /** Add a map image onto the locked map layer (battlemap mode only). */
  onPickMapImage?: () => void;
  /** Whether arrange-maps mode is active (battlemap mode only). */
  arrangeMapsActive?: boolean;
  /** Toggle arrange-maps mode, which temporarily unlocks the map layer. */
  onToggleArrangeMaps?: () => void;
  /** Battle-map export trigger + popover, rendered in both modes. */
  exportControl?: ReactNode;
  /** Saved-camera-views popover + focus-broadcast controls (battlemap mode only). */
  viewsControl?: ReactNode;
  /** Shared-presence "who is viewing" + cursor-sharing switches (battlemap mode only). */
  presenceControl?: ReactNode;
  /** Fog authoring controls for battle maps and campaign locations. */
  fogControls?: DmFogControls;
}
