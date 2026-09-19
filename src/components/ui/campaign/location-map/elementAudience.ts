/**
 * The ONE seam that answers "who may see this canvas element?" for both DM
 * map surfaces.
 *
 * Security boundary. `DmLocationEditor` runs in two modes backed by two
 * different product-state stores. A resolver hardcoded to one store answers
 * `undefined` — meaning PUBLIC — for every element of a map that lives in the
 * other store, which would broadcast every DM-only element the moment a relay
 * connection opens for that map. So:
 *
 *  - the store is selected by `mode`, never assumed;
 *  - the read is LIVE through `getState()` (a captured snapshot goes stale
 *    after the first toggle);
 *  - an unreadable answer FAILS CLOSED: a missing record, or a record whose
 *    `dmOnlyElements` is not an object, resolves to the DM audience.
 *
 * Pure with respect to React: no hooks, safe to call from sync-client
 * callbacks and store listeners.
 */

import { DM_AUDIENCE } from './markerData';
import type { EditorMode } from './DmLocationEditor.types';

import { useBattleMapStore } from '@/store/battleMapStore';
import { useLocationStore } from '@/store/locationStore';

/** `null` means "cannot be read" — callers must treat it as DM-only. */
function readDmOnlyFlags(
  mode: EditorMode,
  campaignCode: string,
  mapId: string
): Readonly<Record<string, boolean>> | null {
  const record =
    mode === 'battlemap'
      ? useBattleMapStore.getState().battleMaps[campaignCode]?.[mapId]
      : useLocationStore.getState().locations[campaignCode]?.[mapId];
  if (!record) return null;
  const flags: unknown = record.dmOnlyElements;
  if (flags === null || typeof flags !== 'object') return null;
  return flags as Readonly<Record<string, boolean>>;
}

export function resolveElementAudience(
  mode: EditorMode,
  campaignCode: string,
  mapId: string,
  elementId: string
): typeof DM_AUDIENCE | undefined {
  const flags = readDmOnlyFlags(mode, campaignCode, mapId);
  if (flags === null) return DM_AUDIENCE;
  return flags[elementId] ? DM_AUDIENCE : undefined;
}

export function isElementDmOnly(
  mode: EditorMode,
  campaignCode: string,
  mapId: string,
  elementId: string
): boolean {
  return (
    resolveElementAudience(mode, campaignCode, mapId, elementId) === DM_AUDIENCE
  );
}

/** Mode-aware single-element audience write (same semantics as each store's
 *  own `setDmOnly`: `true` sets the key, `false` deletes it). */
export function setElementDmOnly(
  mode: EditorMode,
  campaignCode: string,
  mapId: string,
  elementId: string,
  dmOnly: boolean
): void {
  if (mode === 'battlemap') {
    useBattleMapStore
      .getState()
      .setDmOnly(campaignCode, mapId, elementId, dmOnly);
    return;
  }
  useLocationStore.getState().setDmOnly(campaignCode, mapId, elementId, dmOnly);
}
