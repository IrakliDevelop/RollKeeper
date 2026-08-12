import type { CameraView } from '@fieldnotes/core';
import type { InventoryItem, MagicItem } from './character';

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
  status?: MarkerStatus;
  /** Private discovery mechanics. Never included in PublicMarkerDetail. */
  discovery?: MarkerDiscovery;
  /** Private trap mechanics. Never included in PublicMarkerDetail. */
  trap?: MarkerTrapMechanics;
  /** Copied loot definitions. Library edits never rewrite prepared markers. */
  loot?: MarkerLootEntry[];
  deletedAt?: string;
}

export interface MarkerLootEntry {
  id: string;
  itemKind: 'inventory' | 'magic';
  item: InventoryItem | MagicItem;
  quantity: number;
  claimedQuantity: number;
}

export interface PublicMarkerLootEntry {
  id: string;
  name: string;
  itemKind: 'inventory' | 'magic';
  quantity: number;
  remainingQuantity: number;
  description?: string;
  rarity?: string;
}

export type MarkerDiscoverySkill = 'perception' | 'investigation';

export interface MarkerDiscovery {
  dc?: number;
  skill: MarkerDiscoverySkill;
}

export type MarkerDisarmMethod =
  | 'thieves-tools'
  | 'sleight-of-hand'
  | 'arcana'
  | 'other';

export interface MarkerTrapMechanics {
  disarmDc?: number;
  disarmMethod: MarkerDisarmMethod;
  trigger: string;
  effect: string;
  damage: string;
}

/** Operational state shown in the marker panel. Applicable choices are
 * narrowed by marker kind (a trap cannot be "claimed", for example). */
export type MarkerStatus =
  | 'closed'
  | 'open'
  | 'locked'
  | 'armed'
  | 'triggered'
  | 'disarmed'
  | 'available'
  | 'claimed'
  | 'active'
  | 'defeated'
  | 'hidden'
  | 'revealed'
  | 'resolved';

/**
 * The PUBLIC projection of a `MarkerDetail` — the only marker shape that ever
 * leaves the DM (spec §6.4). It is deliberately a separate interface rather
 * than an `Omit<MarkerDetail, 'dmNotes' | 'deletedAt'>`: the projection is
 * built by an explicit safe-field pick in
 * `location-map/markerPublication.ts`, so a field added to `MarkerDetail`
 * later is structurally unable to ride through to players.
 */
export interface PublicMarkerDetail {
  id: string;
  title: string;
  body: string;
  status?: MarkerStatus;
  loot?: PublicMarkerLootEntry[];
  /**
   * Structural refusal, not documentation. Without it a `MarkerDetail` is
   * assignable to `PublicMarkerDetail` (extra properties survive anything but
   * a fresh object literal), so `markers: storedLocation.markers` in a sync
   * payload builder would type-check and ship every `dmNotes` to the players.
   * `dmNotes?: never` makes that a compile error. Do NOT widen this back:
   * fix the call site instead, with an explicit field pick.
   */
  dmNotes?: never;
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
  /** Public marker projection — `dmNotes` is unreachable by construction.
   * Built only by `buildPublicMarkerDetails`; never assign a `MarkerDetail`
   * here. No battle-map payload builder is live today (battle maps sync via
   * the relay), but the field is part of the synced contract. */
  markers?: PublicMarkerDetail[];
  updatedAt: string;
}
