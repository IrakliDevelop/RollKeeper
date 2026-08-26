import type React from 'react';
import type { LocationMap } from '@/types/location';
import type { BattleMap } from '@/types/battlemap';

export type EditorMode = 'location' | 'battlemap';

export interface DmLocationEditorProps {
  location: LocationMap | BattleMap;
  campaignCode: string;
  dmId: string;
  mode?: EditorMode;
  onSave: (canvasState: string) => void;
  onSyncToPlayers: () => void;
}

export interface ToolDef {
  name: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}
