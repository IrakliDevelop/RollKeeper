'use client';

/**
 * Binds the pure marker write helpers (`markerWrites.ts`) to the two real
 * product-state stores and to the canvas element store of whichever surface
 * mounted the hook.
 *
 * Two rules shape this file:
 *  - every write reads its map through `useXStore.getState()` INSIDE the
 *    callback, never from a render-time snapshot, so a write issued after the
 *    map was replaced still operates on the current map;
 *  - the viewport arrives asynchronously (`onReady`), so it is reached through
 *    a `getViewport()` accessor and every canvas-touching operation degrades
 *    to a harmless no-op while it is null.
 *
 * The hook touches no connection and reads no relay configuration: placing and
 * editing markers must work with no relay URL configured.
 */

import { useCallback, useMemo } from 'react';

import type { ElementStore } from '@fieldnotes/core';

import {
  createMarker as createMarkerWrite,
  deleteMarker as deleteMarkerWrite,
  editMarkerDetail as editMarkerDetailWrite,
  findMarkerDetail as findMarkerDetailPure,
  gcOrphanMarkerDetails as gcOrphanMarkerDetailsWrite,
  setMarkerAudienceForRef as setMarkerAudienceForRefWrite,
} from './markerWrites';
import type {
  CreateMarkerInput,
  CreateMarkerResult,
  MarkerAudienceTransition,
  MarkerElementStoreLike,
  MarkerWriteDeps,
  OrphanGcResult,
} from './markerWrites';

import { useBattleMapStore } from '@/store/battleMapStore';
import { useLocationStore } from '@/store/locationStore';
import type { MarkerDetail } from '@/types/battlemap';

/** The slice of `Viewport` the marker writes need. */
export interface MarkerWritesViewport {
  store: ElementStore;
  transaction: <T>(operation: () => T) => T;
}

export interface UseMarkerWritesArgs {
  mode: 'battlemap' | 'location';
  campaignCode: string;
  mapId: string;
  getViewport: () => MarkerWritesViewport | null;
}

export interface MarkerWrites {
  /** Null when no viewport is mounted yet — a detail is never persisted for a
   *  pin that cannot be placed. */
  createMarker(input: CreateMarkerInput): CreateMarkerResult | null;
  deleteMarker(elementId: string): void;
  editMarkerDetail(
    ref: string,
    patch: { title?: string; body?: string; dmNotes?: string }
  ): boolean;
  setMarkerAudienceForRef(
    ref: string,
    dmOnly: boolean
  ): MarkerAudienceTransition;
  gcOrphanMarkerDetails(canvasState: string | null | undefined): OrphanGcResult;
  findMarkerDetail(ref: string): MarkerDetail | undefined;
  markers: readonly MarkerDetail[];
}

/** Stable identity so a map with no markers never re-renders its consumers. */
const EMPTY_MARKERS: readonly MarkerDetail[] = [];

const NO_SIBLINGS: MarkerAudienceTransition = {
  status: 'refused',
  reason: 'no-siblings',
  elementIds: [],
};

/** Stand-in canvas store for the product-state-only operations (detail edit,
 *  orphan GC, detail lookup), which must keep working before the viewport
 *  arrives. Canvas-touching operations never see it — they bail on a null
 *  viewport first. */
const NO_CANVAS_STORE: MarkerElementStoreLike = {
  add: () => {},
  remove: () => {},
  update: () => {},
  getAll: () => [],
  getById: () => undefined,
};

/** True when the bound map is present in its product-state store. Reading
 *  this before delegating to `createMarker` mirrors the existing no-viewport
 *  degradation: a pin is never placed for a map that cannot record its
 *  DM-only mark, rather than relying on `insertMarkerRecord`'s throw to stop
 *  it after the fact. */
function mapExists(
  mode: 'battlemap' | 'location',
  campaignCode: string,
  mapId: string
): boolean {
  if (mode === 'battlemap') {
    return (
      useBattleMapStore.getState().getBattleMap(campaignCode, mapId) !==
      undefined
    );
  }
  return (
    useLocationStore.getState().getLocation(campaignCode, mapId) !== undefined
  );
}

/** Applies a bulk audience patch with the same semantics as the stores'
 *  single-element `setDmOnly`: true sets the key, false DELETES it. */
function mergeDmOnly(
  current: Readonly<Record<string, boolean>>,
  updates: Readonly<Record<string, boolean>>
): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...current };
  for (const [elementId, dmOnly] of Object.entries(updates)) {
    if (dmOnly) merged[elementId] = true;
    else delete merged[elementId];
  }
  return merged;
}

function makeDeps(
  mode: 'battlemap' | 'location',
  campaignCode: string,
  mapId: string,
  viewport: MarkerWritesViewport | null
): MarkerWriteDeps {
  const store: MarkerElementStoreLike = viewport?.store ?? NO_CANVAS_STORE;
  const transaction = <T>(operation: () => T): T =>
    viewport ? viewport.transaction(operation) : operation();

  if (mode === 'battlemap') {
    const readMap = () =>
      useBattleMapStore.getState().getBattleMap(campaignCode, mapId);
    return {
      store,
      transaction,
      getMarkers: () => readMap()?.markers ?? EMPTY_MARKERS,
      setMarkers: next =>
        useBattleMapStore
          .getState()
          .updateBattleMap(campaignCode, mapId, { markers: next }),
      getDmOnlyElements: () => readMap()?.dmOnlyElements ?? {},
      setDmOnly: (elementId, dmOnly) =>
        useBattleMapStore
          .getState()
          .setDmOnly(campaignCode, mapId, elementId, dmOnly),
      setDmOnlyBulk: updates => {
        const state = useBattleMapStore.getState();
        const current =
          state.getBattleMap(campaignCode, mapId)?.dmOnlyElements ?? {};
        state.updateBattleMap(campaignCode, mapId, {
          dmOnlyElements: mergeDmOnly(current, updates),
        });
      },
    };
  }

  const readMap = () =>
    useLocationStore.getState().getLocation(campaignCode, mapId);
  return {
    store,
    transaction,
    getMarkers: () => readMap()?.markers ?? EMPTY_MARKERS,
    setMarkers: next =>
      useLocationStore
        .getState()
        .updateLocation(campaignCode, mapId, { markers: next }),
    getDmOnlyElements: () => readMap()?.dmOnlyElements ?? {},
    setDmOnly: (elementId, dmOnly) =>
      useLocationStore
        .getState()
        .setDmOnly(campaignCode, mapId, elementId, dmOnly),
    setDmOnlyBulk: updates => {
      const state = useLocationStore.getState();
      const current =
        state.getLocation(campaignCode, mapId)?.dmOnlyElements ?? {};
      state.updateLocation(campaignCode, mapId, {
        dmOnlyElements: mergeDmOnly(current, updates),
      });
    },
  };
}

export function useMarkerWrites(args: UseMarkerWritesArgs): MarkerWrites {
  const { mode, campaignCode, mapId, getViewport } = args;

  // Subscribe for the returned value only. Both stores are subscribed because
  // hooks cannot be called conditionally; the unselected one yields undefined
  // and never re-renders.
  const battleMapMarkers = useBattleMapStore(
    state => state.battleMaps[campaignCode]?.[mapId]?.markers
  );
  const locationMarkers = useLocationStore(
    state => state.locations[campaignCode]?.[mapId]?.markers
  );
  const markers =
    (mode === 'battlemap' ? battleMapMarkers : locationMarkers) ??
    EMPTY_MARKERS;

  const depsFor = useCallback(
    (viewport: MarkerWritesViewport | null) =>
      makeDeps(mode, campaignCode, mapId, viewport),
    [mode, campaignCode, mapId]
  );

  const createMarker = useCallback(
    (input: CreateMarkerInput): CreateMarkerResult | null => {
      const viewport = getViewport();
      if (!viewport) return null;
      // Fail closed, same as the no-viewport case: if the bound map is not
      // in the store (persist not yet rehydrated, map removed, wrong mapId),
      // `setDmOnly`/`setMarkers` would no-op and the DM-only mark could never
      // land. Checked here so nothing is attempted, rather than relying on
      // `insertMarkerRecord`'s throw after a detail write already happened.
      if (!mapExists(mode, campaignCode, mapId)) return null;
      return createMarkerWrite(depsFor(viewport), input);
    },
    [getViewport, depsFor, mode, campaignCode, mapId]
  );

  const deleteMarker = useCallback(
    (elementId: string): void => {
      const viewport = getViewport();
      if (!viewport) return;
      deleteMarkerWrite(depsFor(viewport), elementId);
    },
    [getViewport, depsFor]
  );

  const editMarkerDetail = useCallback(
    (
      ref: string,
      patch: { title?: string; body?: string; dmNotes?: string }
    ): boolean => editMarkerDetailWrite(depsFor(null), ref, patch),
    [depsFor]
  );

  const setMarkerAudienceForRef = useCallback(
    (ref: string, dmOnly: boolean): MarkerAudienceTransition => {
      const viewport = getViewport();
      if (!viewport) return NO_SIBLINGS;
      return setMarkerAudienceForRefWrite(depsFor(viewport), ref, dmOnly);
    },
    [getViewport, depsFor]
  );

  const gcOrphanMarkerDetails = useCallback(
    (canvasState: string | null | undefined): OrphanGcResult =>
      gcOrphanMarkerDetailsWrite(depsFor(null), canvasState),
    [depsFor]
  );

  const findMarkerDetail = useCallback(
    (ref: string): MarkerDetail | undefined =>
      findMarkerDetailPure(depsFor(null).getMarkers(), ref),
    [depsFor]
  );

  return useMemo(
    () => ({
      createMarker,
      deleteMarker,
      editMarkerDetail,
      setMarkerAudienceForRef,
      gcOrphanMarkerDetails,
      findMarkerDetail,
      markers,
    }),
    [
      createMarker,
      deleteMarker,
      editMarkerDetail,
      setMarkerAudienceForRef,
      gcOrphanMarkerDetails,
      findMarkerDetail,
      markers,
    ]
  );
}
