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
 * LAYER RULE (location mode only, `resolveElementAudienceWithLayer`): a
 * location element whose layer the DM has toggled invisible is DM-only ON THE
 * WIRE, flagged or not. Before live sync, locations reached players as an
 * exported JPEG that honoured layer visibility, so "hide the layer" has always
 * been a secrecy control there; delivering those elements and hiding them
 * presentationally on the player canvas (`layerSync.ts`) would leak them.
 * Battle maps keep the opposite, deliberate contract — layer visibility is
 * presentational only — so the layer lookup is never consulted in that mode.
 * An element with no layer, or one naming a layer that cannot be found, falls
 * through to the flag answer: a legacy element with `layerId: ''` must not be
 * blanked.
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

/**
 * `resolveElementAudience` plus the location-mode layer rule (see the header).
 * `isLayerHidden` answers `true` only for a layer that exists AND is invisible
 * — an unknown layer must answer `false` so the element falls through to the
 * flag resolver, which still fails closed on an unreadable record.
 */
export function resolveElementAudienceWithLayer(
  mode: EditorMode,
  campaignCode: string,
  mapId: string,
  element: { id: string; layerId?: string },
  isLayerHidden: (layerId: string) => boolean
): typeof DM_AUDIENCE | undefined {
  if (
    mode === 'location' &&
    element.layerId &&
    isLayerHidden(element.layerId)
  ) {
    return DM_AUDIENCE;
  }
  return resolveElementAudience(mode, campaignCode, mapId, element.id);
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
