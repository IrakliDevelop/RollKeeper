export interface GridSettings {
  gridType: 'square' | 'hex';
  hexOrientation?: 'pointy' | 'flat';
  cellSize: number;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

export interface LocationMap {
  id: string;
  campaignCode: string;
  name: string;
  mapImageUrl: string;
  mapImageSize: { w: number; h: number };
  canvasState: string;
  dmOnlyElements: Record<string, boolean>;
  gridEnabled: boolean;
  gridSettings?: GridSettings;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight metadata for list views and Redis sync */
export interface LocationMetadata {
  id: string;
  name: string;
  mapImageUrl: string;
  updatedAt: string;
}

/** Payload sent to Redis when DM syncs to players */
export interface SyncedLocation {
  id: string;
  name: string;
  mapImageUrl: string;
  mapImageSize: { w: number; h: number };
  snapshotUrl?: string; // Rendered PNG of the canvas (no dmOnly elements)
  canvasState: string; // filtered — no dmOnly elements (legacy, empty when snapshot used)
  gridEnabled: boolean;
  gridSettings?: GridSettings;
  updatedAt: string;
}
