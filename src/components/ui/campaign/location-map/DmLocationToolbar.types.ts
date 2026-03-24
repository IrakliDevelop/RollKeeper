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
  onToggleGrid: () => void;
  onSyncToPlayers: () => void;
  syncing: boolean;
  /** ID of the currently selected element, or null if none */
  selectedElementId: string | null;
  isDmOnly: boolean;
  onToggleDmOnly: () => void;
}
