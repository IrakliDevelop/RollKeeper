import type { CameraView } from '@fieldnotes/core';

import type { GridSettings } from './location';

/** A DM-named camera view saved against one map. DM data — never synced to players. */
export interface SavedCameraView {
  id: string;
  name: string;
  view: CameraView;
}

export interface BattleMap {
  id: string;
  campaignCode: string;
  name: string;
  mapImageUrl: string;
  mapImageSize: { w: number; h: number };
  canvasState: string;
  dmOnlyElements: Record<string, boolean>;
  gridEnabled: boolean;
  gridSettings?: GridSettings;
  linkedEncounterIds: string[];
  cameraViews?: SavedCameraView[];
  createdAt: string;
  updatedAt: string;
}

export interface BattleMapMetadata {
  id: string;
  name: string;
  mapImageUrl: string;
  updatedAt: string;
}

export interface SyncedBattleMap {
  id: string;
  name: string;
  mapImageUrl: string;
  mapImageSize: { w: number; h: number };
  snapshotUrl?: string;
  canvasState: string;
  gridEnabled: boolean;
  gridSettings?: GridSettings;
  updatedAt: string;
}
