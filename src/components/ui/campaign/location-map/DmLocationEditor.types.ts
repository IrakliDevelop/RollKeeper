import type { LocationMap } from '@/types/location';

export interface DmLocationEditorProps {
  location: LocationMap;
  campaignCode: string;
  dmId: string;
  onSave: (canvasState: string) => void;
  onSyncToPlayers: () => void;
}

export interface ToolDef {
  name: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}
