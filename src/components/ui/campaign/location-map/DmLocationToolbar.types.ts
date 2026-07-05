import type { EditorMode } from './DmLocationEditor.types';
import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';

export interface DmLocationToolbarProps {
  onPickImage: () => void;
  onDelete: () => void;
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
  onDownloadExport: () => void;
  syncing: boolean;
  /** ID of the currently selected element, or null if none */
  selectedElementId: string | null;
  isDmOnly: boolean;
  onToggleDmOnly: () => void;
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
}
