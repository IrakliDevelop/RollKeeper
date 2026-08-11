import type { CameraView } from '@fieldnotes/core';

import type { GridSettings } from './location';

/** A DM-named camera view saved against one map. DM data — never synced to players. */
export interface SavedCameraView {
  id: string;
  name: string;
  view: CameraView;
}

/**
 * The product-state record behind a map marker pin. Lives in DM product state
 * only — it is NEVER part of the canvas element payload and therefore never
 * travels the canvas wire (spec §6.3). `id` equals the `ref` carried in the
 * marker element's `data`; several pins may share one `ref`, and they all read
 * this single record.
 *
 * `title` / `body` / `dmNotes` are PLAIN TEXT — rendered as text nodes, never
 * `innerHTML`. `dmNotes` never leaves the DM. Deletion is soft (`deletedAt`)
 * so that undoing a pin deletion can still find its record (spec §6.8).
 */
export interface MarkerDetail {
  id: string;
  title: string;
  body: string;
  dmNotes: string;
  deletedAt?: string;
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
  /** Marker detail records keyed by their `ref` (see `MarkerDetail.id`).
   * DM product state — the public projection is added separately in B8. */
  markers?: MarkerDetail[];
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
