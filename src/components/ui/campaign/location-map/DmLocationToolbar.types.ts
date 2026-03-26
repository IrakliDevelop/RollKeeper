import type { EditorMode } from './DmLocationEditor.types';

export interface DmLocationToolbarProps {
  activeTool: string;
  onToolChange: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onClear: () => void;
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
  onFitToMap?: () => void;
}
