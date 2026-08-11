/**
 * Marker write helpers — the CRUD layer that keeps the two marker stores
 * coherent: presentation (kind / label / colour / ref) on the canvas element,
 * and the detail record (title / body / dmNotes) in RollKeeper product state.
 *
 * Everything here is a free function over an injected `MarkerWriteDeps`, so it
 * carries no React, no Zustand and no `Viewport` — `useMarkerWrites` binds the
 * real stores to these signatures.
 *
 * The rules encoded here are the safety-critical ones from the spec:
 *  - §6.7 a new marker is DM-only in product state BEFORE its element enters
 *    the canvas store, so the first outbound upsert already carries the DM
 *    audience;
 *  - §6.8 deleting a pin never deletes its detail, editing a detail is
 *    observed by every sibling pin sharing the `ref`, and orphan GC runs only
 *    after a fully successful canvas parse and only ever soft-deletes;
 *  - §6.2 element `data` from the canvas is untrusted and re-validated through
 *    `parseMarkerData` before every use.
 */

import { createHtmlElement } from '@fieldnotes/core';
import type { CanvasElement, HtmlElement, Point, Size } from '@fieldnotes/core';

import {
  MARKER_BODY_MAX_CODE_POINTS,
  MARKER_DM_NOTES_MAX_CODE_POINTS,
  MARKER_HTML_TYPE,
  MARKER_TITLE_MAX_CODE_POINTS,
  buildMarkerData,
  capCodePoints,
  parseMarkerData,
} from './markerData';
import type { MarkerColorKey, MarkerKind } from './markerData';
import type { MarkerRemovalTracker } from './markerRemovalTracker';
import { MARKER_ELEMENT_ZINDEX } from './tokenSnap';

import type { MarkerDetail } from '@/types/battlemap';

/** The slice of `ElementStore` these helpers use. Narrow on purpose: tests
 *  need no `Viewport`, and nothing here can reach the rest of the store. */
export interface MarkerElementStoreLike {
  add(element: CanvasElement): void;
  remove(id: string): void;
  update(id: string, partial: Partial<CanvasElement>): void;
  getAll(): readonly CanvasElement[];
  getById(id: string): CanvasElement | undefined;
}

export interface MarkerWriteDeps {
  store: MarkerElementStoreLike;
  /** Wraps canvas mutations in one history transaction (one gesture = one
   *  undo step). Nested calls join the outer transaction. */
  transaction: <T>(operation: () => T) => T;
  getMarkers: () => readonly MarkerDetail[];
  /** Replaces this map's whole marker list in ONE product-state action. */
  setMarkers: (next: MarkerDetail[]) => void;
  getDmOnlyElements: () => Readonly<Record<string, boolean>>;
  /** Single-element audience write. */
  setDmOnly: (elementId: string, dmOnly: boolean) => void;
  /** Applies audience for MANY element ids in ONE product-state action. */
  setDmOnlyBulk: (updates: Readonly<Record<string, boolean>>) => void;
  /**
   * Whether an audience change re-emits each sibling through
   * `store.update(id, {})` so a live sync client re-stamps its audience.
   * Defaults to `true` (the battlemap behaviour). Surfaces with no relay —
   * location mode — pass `false`: the canvas write would only fire their
   * `store.on('update')` save listener and flip the sync indicator on a pure
   * visibility toggle. Same reasoning as the shipped per-element toggle in
   * `DmLocationEditor.hooks.ts` handleToggleDmOnly.
   */
  reemitAudience?: boolean;
  /**
   * Session memory of marker removals on THIS map, shared by
   * `noteMarkerRemoval` (writer) and `guardLocalMarkerAdd` (reader). It is
   * what lets the guard tell an undo of a delete from a duplicate. Optional:
   * with no tracker the guard simply never recognises an undo and every
   * unmarked local add takes the fail-closed duplicate path.
   */
  removalTracker?: MarkerRemovalTracker;
  /** Injected for determinism in tests. Defaults to `crypto.randomUUID()`. */
  newId?: () => string;
  /** Injected for determinism in tests. Defaults to an ISO timestamp. */
  now?: () => string;
}

function nextId(deps: MarkerWriteDeps): string {
  return deps.newId ? deps.newId() : crypto.randomUUID();
}

function timestamp(deps: MarkerWriteDeps): string {
  return deps.now ? deps.now() : new Date().toISOString();
}

/** Builds a detail record with every field capped at persist time (§6.2). */
function buildDetail(input: {
  id: string;
  title?: string;
  body?: string;
  dmNotes?: string;
}): MarkerDetail {
  return {
    id: input.id,
    title: capCodePoints(input.title ?? '', MARKER_TITLE_MAX_CODE_POINTS),
    body: capCodePoints(input.body ?? '', MARKER_BODY_MAX_CODE_POINTS),
    dmNotes: capCodePoints(
      input.dmNotes ?? '',
      MARKER_DM_NOTES_MAX_CODE_POINTS
    ),
  };
}

export interface CreateMarkerInput {
  kind: MarkerKind;
  color?: MarkerColorKey;
  label?: string;
  position: Point;
  size: Size;
  layerId: string;
  /** Escape hatch for a caller that needs a different band. Omit it: the
   *  default `MARKER_ELEMENT_ZINDEX` is what keeps a pin off the map floor. */
  zIndex?: number;
  title?: string;
  body?: string;
  dmNotes?: string;
}

export interface CreateMarkerResult {
  elementId: string;
  ref: string;
}

/**
 * Steps 2-5 of the §6.7 ordering, shared by `createMarker` and
 * `cloneMarkerToMap` so the ordering exists in exactly ONE place. The element
 * must already be built (step 1) and must not yet be in the store.
 *
 * Marking DM-only *before* `store.add` is the whole point: the add is what
 * triggers the first outbound upsert, and it can only be stamped with the DM
 * audience if the flag is already in product state. Reversing these two steps
 * leaks the marker to players for one frame.
 *
 * Between marking and adding, the mark is READ BACK and verified. Both
 * `battleMapStore.setDmOnly` and `locationStore.setDmOnly` silently no-op
 * (return the unchanged state) when the map is missing from the store — a
 * real failure mode if persist has not rehydrated yet, the map was removed,
 * or the wrong map id was passed in. Without this check, `store.add` would
 * still succeed and the element would land on the canvas with no
 * `dmOnlyElements` entry at all: the exact leak the ordering exists to
 * prevent, just moved one layer down. This is fail-closed, not defensive
 * programming — an unverified mark is treated as no mark.
 */
function insertMarkerRecord(
  deps: MarkerWriteDeps,
  element: HtmlElement,
  detail: MarkerDetail
): CreateMarkerResult {
  // 2. Persist the detail under the new ref.
  deps.setMarkers([...deps.getMarkers(), detail]);

  // 3. New markers are DM-only by default — BEFORE the element exists on the
  //    canvas. Do not reorder with step 4.
  deps.setDmOnly(element.id, true);

  // 3.5. Verify the mark actually landed before letting the element anywhere
  //      near the canvas. This throw is deliberately OUTSIDE the try/catch
  //      below: nothing has reached the canvas yet, so there is nothing for
  //      the catch's rollback to undo, and firing it here would call
  //      `setDmOnly(element.id, false)` against a store that just proved it
  //      cannot persist audience writes for this map in the first place.
  if (deps.getDmOnlyElements()[element.id] !== true) {
    throw new Error(
      `Refusing to add marker element ${element.id}: the DM-only mark did ` +
        'not land (the bound map is likely missing from the store). The ' +
        'detail record persists as a harmless recoverable orphan.'
    );
  }

  // 4. Only now does the element enter the canvas store.
  try {
    deps.transaction(() => {
      deps.store.add(element);
    });
  } catch (error) {
    // 5. Roll back the provisional audience entry and rethrow. The detail is
    //    deliberately NOT rolled back: it is a harmless recoverable orphan
    //    that the next successful GC pass will soft-delete.
    deps.setDmOnly(element.id, false);
    throw error;
  }

  return { elementId: element.id, ref: detail.id };
}

/** Creates a marker: one detail record plus one DM-only pin. Throws whatever
 *  `store.add` throws, after rolling the audience entry back. */
export function createMarker(
  deps: MarkerWriteDeps,
  input: CreateMarkerInput
): CreateMarkerResult {
  // 1. Build the element with the PURE factory — no store write yet, but
  //    `element.id` already exists so the audience entry can be written first.
  const ref = nextId(deps);
  const element = createHtmlElement({
    position: input.position,
    size: input.size,
    layerId: input.layerId,
    // Never the `createHtmlElement` default of 0: at 0 a pin ties with every
    // map background element and the SDK breaks (layerOrder, zIndex) ties by
    // arrival order, so after a resync the pin can paint BENEATH the map.
    // Same hazard, same remedy as tokens — see tokenSnap.ts's band table.
    zIndex: input.zIndex ?? MARKER_ELEMENT_ZINDEX,
    htmlType: MARKER_HTML_TYPE,
    data: {
      ...buildMarkerData({
        kind: input.kind,
        ref,
        label: input.label,
        color: input.color,
      }),
    },
  });

  return insertMarkerRecord(
    deps,
    element,
    buildDetail({
      id: ref,
      title: input.title,
      body: input.body,
      dmNotes: input.dmNotes,
    })
  );
}

/**
 * Removes the pin from the canvas and nothing else.
 *
 * It deliberately does NOT touch `markers` (§6.8: undo would otherwise restore
 * a pin whose record is gone), and deliberately does NOT clear the
 * `dmOnlyElements` entry — fail closed, so an undo restores the pin still
 * DM-only rather than silently shared.
 */
export function deleteMarker(deps: MarkerWriteDeps, elementId: string): void {
  deps.transaction(() => {
    deps.store.remove(elementId);
  });
}

/**
 * Patches one detail record. There is no canvas write: every sibling pin
 * sharing the `ref` reads this same record, so they all observe the edit.
 * Returns false when no LIVE record carries that id — a soft-deleted record
 * counts as absent here, matching `findMarkerDetail`. Patching a tombstone
 * would write somewhere no reader (`findMarkerDetail` filters `deletedAt`)
 * can ever surface it again: a silently lost edit. Fail closed instead.
 */
export function editMarkerDetail(
  deps: MarkerWriteDeps,
  ref: string,
  patch: { title?: string; body?: string; dmNotes?: string }
): boolean {
  const markers = deps.getMarkers();
  let found = false;

  const next = markers.map(marker => {
    if (marker.id !== ref || marker.deletedAt) return marker;
    found = true;
    const updated: MarkerDetail = { ...marker };
    if (patch.title !== undefined) {
      updated.title = capCodePoints(patch.title, MARKER_TITLE_MAX_CODE_POINTS);
    }
    if (patch.body !== undefined) {
      updated.body = capCodePoints(patch.body, MARKER_BODY_MAX_CODE_POINTS);
    }
    if (patch.dmNotes !== undefined) {
      updated.dmNotes = capCodePoints(
        patch.dmNotes,
        MARKER_DM_NOTES_MAX_CODE_POINTS
      );
    }
    return updated;
  });

  if (!found) return false;
  deps.setMarkers(next);
  return true;
}

/** Looks a detail record up by `ref`, ignoring soft-deleted entries. */
export function findMarkerDetail(
  markers: readonly MarkerDetail[],
  ref: string
): MarkerDetail | undefined {
  return markers.find(marker => marker.id === ref && !marker.deletedAt);
}

/** True when this element is an html marker element (says nothing about
 *  whether its `data` is trustworthy — that is `parseMarkerData`'s job). */
function isMarkerElement(
  element: Readonly<CanvasElement>
): element is HtmlElement {
  return element.type === 'html' && element.htmlType === MARKER_HTML_TYPE;
}

/**
 * The `ref` of `element` when it is a marker whose data is currently VALID,
 * else null. Re-validates through `parseMarkerData` rather than trusting a
 * previously-computed result (§6.2), so a pin whose data has gone `invalid`
 * or `unsupported` is treated as a non-marker by every audience decision that
 * would otherwise move its siblings.
 */
export function markerRefForElement(
  element: Readonly<CanvasElement> | null | undefined
): string | null {
  if (!element || !isMarkerElement(element)) return null;
  const parsed = parseMarkerData(element.data);
  return parsed.status === 'valid' ? parsed.data.ref : null;
}

/**
 * Ids of every canvas element that is a VALID marker pointing at `ref`.
 * Element data is re-validated here rather than trusted (§6.2), and a map id
 * inside marker `data` is never read or trusted.
 */
export function markerSiblingIds(
  store: MarkerElementStoreLike,
  ref: string
): string[] {
  const ids: string[] = [];
  for (const element of store.getAll()) {
    if (!isMarkerElement(element)) continue;
    const parsed = parseMarkerData(element.data);
    if (parsed.status !== 'valid') continue;
    if (parsed.data.ref !== ref) continue;
    ids.push(element.id);
  }
  return ids;
}

export type MarkerAudienceTransition =
  | { status: 'applied'; elementIds: string[]; dmOnly: boolean }
  | { status: 'refused'; reason: 'mixed-audience'; elementIds: string[] }
  | { status: 'refused'; reason: 'no-siblings'; elementIds: [] };

/**
 * Applies one audience to every pin sharing `ref`.
 *
 * Publication is `every`, not `some` (§6.4): a ref is public only if every pin
 * referencing it is shared. Rather than let the UI produce a half-applied
 * state, a sibling set that is already mixed is REFUSED outright with no
 * writes — the caller surfaces it instead of silently picking a winner.
 */
export function setMarkerAudienceForRef(
  deps: MarkerWriteDeps,
  ref: string,
  dmOnly: boolean
): MarkerAudienceTransition {
  const elementIds = markerSiblingIds(deps.store, ref);
  if (elementIds.length === 0) {
    return { status: 'refused', reason: 'no-siblings', elementIds: [] };
  }

  const dmOnlyElements = deps.getDmOnlyElements();
  const audiences = elementIds.map(id => dmOnlyElements[id] === true);
  const first = audiences[0];
  if (!audiences.every(audience => audience === first)) {
    return { status: 'refused', reason: 'mixed-audience', elementIds };
  }

  // Exactly one product-state action for the whole sibling set, never one per
  // sibling: a per-sibling write would publish intermediate mixed states.
  const updates: Record<string, boolean> = {};
  for (const id of elementIds) updates[id] = dmOnly;
  deps.setDmOnlyBulk(updates);

  // Re-emit each sibling so the sync client re-stamps its audience (hide ⇒ the
  // relay sends a remove, reveal ⇒ an upsert). Shipped precedent:
  // DmLocationEditor.hooks.ts handleToggleDmOnly / handleRevealAll. Gated for
  // relay-less surfaces (see `reemitAudience`); the bulk product-state write
  // above is deliberately OUTSIDE the gate — the audience itself always lands.
  if (deps.reemitAudience !== false) {
    for (const id of elementIds) deps.store.update(id, {});
  }

  return { status: 'applied', elementIds, dmOnly };
}

export type OrphanGcResult =
  | {
      status: 'skipped';
      reason:
        | 'absent'
        | 'unparseable'
        | 'unexpected-shape'
        | 'unreadable-markers';
    }
  | { status: 'ran'; softDeleted: string[] };

/**
 * Soft-deletes detail records no pin references any more.
 *
 * §6.8: GC runs ONLY after a fully successful canvas deserialization with
 * refs extracted — never when canvas state is absent, malformed, unexpectedly
 * shaped, or contains a marker this client cannot parse. An older persisted
 * revision, a recovery workflow, or a future marker version must never be able
 * to destroy valid details. Deletion is always soft; nothing is ever dropped
 * from the list.
 */
export function gcOrphanMarkerDetails(
  deps: MarkerWriteDeps,
  canvasState: string | null | undefined
): OrphanGcResult {
  if (
    canvasState === null ||
    canvasState === undefined ||
    canvasState.trim() === ''
  ) {
    return { status: 'skipped', reason: 'absent' };
  }

  let parsedState: unknown;
  try {
    parsedState = JSON.parse(canvasState);
  } catch {
    return { status: 'skipped', reason: 'unparseable' };
  }

  if (
    typeof parsedState !== 'object' ||
    parsedState === null ||
    Array.isArray(parsedState)
  ) {
    return { status: 'skipped', reason: 'unexpected-shape' };
  }
  const elements = (parsedState as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) {
    return { status: 'skipped', reason: 'unexpected-shape' };
  }

  const refs = new Set<string>();
  for (const element of elements) {
    if (typeof element !== 'object' || element === null) continue;
    const candidate = element as {
      type?: unknown;
      htmlType?: unknown;
      data?: unknown;
    };
    if (candidate.type !== 'html') continue;
    if (candidate.htmlType !== MARKER_HTML_TYPE) continue;
    const parsed = parseMarkerData(candidate.data);
    if (parsed.status !== 'valid') {
      // We cannot read this marker's ref, so we cannot conclude that any ref
      // is unreferenced. Refuse to collect anything at all.
      return { status: 'skipped', reason: 'unreadable-markers' };
    }
    refs.add(parsed.data.ref);
  }

  const markers = deps.getMarkers();
  const softDeleted: string[] = [];
  const next = markers.map(marker => {
    if (marker.deletedAt) return marker;
    if (refs.has(marker.id)) return marker;
    softDeleted.push(marker.id);
    return { ...marker, deletedAt: timestamp(deps) };
  });

  if (softDeleted.length > 0) deps.setMarkers(next);
  return { status: 'ran', softDeleted };
}

export interface ClonedMarker {
  element: HtmlElement;
  detail: MarkerDetail;
}

/**
 * Clones a marker for a DIFFERENT map: new element id, NEW ref, cloned detail
 * content, `deletedAt` cleared (§6.8 — a copy is a fresh record, never a
 * resurrected tombstone).
 *
 * A missing source detail is not an error: the clone gets empty content under
 * the new ref so the pin keeps working. Only element data that does not parse
 * as a valid marker returns null.
 */
export function cloneMarkerForMap(
  element: Readonly<CanvasElement>,
  sourceMarkers: readonly MarkerDetail[],
  newId: () => string,
  overrides?: { position?: Point; size?: Size; layerId?: string }
): ClonedMarker | null {
  if (!isMarkerElement(element)) return null;
  const parsed = parseMarkerData(element.data);
  if (parsed.status !== 'valid') return null;

  const source = findMarkerDetail(sourceMarkers, parsed.data.ref);
  const ref = newId();

  const cloned = createHtmlElement({
    position: overrides?.position ?? element.position,
    size: overrides?.size ?? element.size,
    layerId: overrides?.layerId ?? element.layerId,
    // The marker band, not `element.zIndex`: a source pin persisted before
    // the band existed sits at 0, and a clone must not inherit the "paints
    // under the map after a resync" hazard from it.
    zIndex: MARKER_ELEMENT_ZINDEX,
    htmlType: MARKER_HTML_TYPE,
    data: {
      ...buildMarkerData({
        kind: parsed.data.kind,
        ref,
        label: parsed.data.label,
        color: parsed.data.color,
      }),
    },
  });

  return {
    element: cloned,
    // Explicit field pick, never a spread of the source record: `deletedAt`
    // must not ride along and neither may any unknown persisted field.
    detail: buildDetail({
      id: ref,
      title: source?.title,
      body: source?.body,
      dmNotes: source?.dmNotes,
    }),
  };
}

/**
 * Records that a marker pin left the canvas store, so a later re-add of the
 * SAME id carrying the SAME ref can be recognised as the undo of this delete
 * rather than treated as a duplicate. Wire it to `store.on('remove')` on every
 * surface that wires `guardLocalMarkerAdd` to `store.on('add')`.
 *
 * The audience is read from product state HERE, at removal time, because that
 * is the last moment it is knowable: nothing in the re-added element says
 * whether the pin was shared or DM-only.
 *
 * Remote-origin removals are not tracked, for the same reason the guard
 * ignores remote-origin adds: a peer's element is not this client's business,
 * and remembering it would give a hostile peer a way to have a later local add
 * of that id treated as "restore to shared".
 *
 * Returns whether anything was remembered.
 */
export function noteMarkerRemoval(
  deps: MarkerWriteDeps,
  element: Readonly<CanvasElement>,
  meta?: { origin?: string }
): boolean {
  if (meta?.origin !== undefined && meta.origin !== 'local') return false;
  if (deps.removalTracker === undefined) return false;
  // Null for a non-marker or for data that no longer parses — with no
  // trustworthy ref there is nothing to match a later add against, and an
  // unmatched add is exactly the fail-closed case.
  const ref = markerRefForElement(element);
  if (ref === null) return false;

  deps.removalTracker.record({
    id: element.id,
    ref,
    wasDmOnly: deps.getDmOnlyElements()[element.id] === true,
  });
  return true;
}

export type MarkerAddGuardResult =
  | {
      status: 'ignored';
      reason: 'remote-origin' | 'not-a-marker' | 'already-marked';
    }
  /** Recognised as the UNDO of a delete: the audience the pin had when it was
   *  removed was restored (or was already in place) and its `ref` was left
   *  exactly as it arrived. */
  | { status: 'restored'; wasDmOnly: boolean }
  /** Marked DM-only. `rewrittenRef` is the fresh ref the pin now carries, or
   *  `null` when the data could not be parsed and was left untouched. */
  | { status: 'marked'; rewrittenRef: string | null }
  /** The audience write did not land (map missing from product state), so
   *  nothing further was attempted. The pin is on the canvas UNMARKED. */
  | { status: 'mark-failed' };

/**
 * Fail-closed guard for markers that enter the canvas store by any route other
 * than `createMarker`.
 *
 * `createMarker` owns the §6.7 ordering, but it is not the only way a marker
 * element can reach the store. `@fieldnotes/core`'s own canvas actions —
 * `duplicate` (`mod+d`), `copy`/`paste` (`mod+c` / `mod+v`) and the canvas
 * context menu, all enabled by default — `structuredClone` the selected
 * element, assign it a new id and call `store.add` directly. The clone has no
 * `dmOnlyElements` entry, so `resolveAudience` returns `undefined` and the
 * very first outbound upsert fans a `secret` or `trap` pin out to every player
 * and the TV display. A hostile peer can inject the same shape.
 *
 * So the invariant this enforces is deliberately stronger than "the create
 * function orders its writes correctly": NO element with
 * `htmlType === MARKER_HTML_TYPE` may enter the store from a local origin
 * without a DM-only mark.
 *
 * Two writes, in this order and no other:
 *  1. `setDmOnly(id, true)` — synchronously, before any later `store.on('add')`
 *     listener (the sync client's) can resolve this element's audience;
 *  2. the ref rewrite — the clone gets its OWN ref and its own copy of the
 *     original's detail content, so it is a fresh POI rather than a
 *     mixed-audience sibling of the original. Without it, the shared ref is
 *     permanently wedged: `setMarkerAudienceForRef` refuses every toggle on a
 *     mixed sibling set and `buildPublicMarkerDetails` drops it, with no
 *     repair affordance anywhere in the UI.
 *
 * Remote-origin adds are left completely alone — exactly as the hidden
 * placement listener does — because a remote marker's audience is the
 * originating DM's business, not this client's.
 *
 * Data that does not parse `valid` is still marked DM-only (fail closed) but
 * its data is left alone: there is no trustworthy `ref` to rewrite.
 *
 * The one local add this must NOT treat as a duplicate is the undo of a
 * delete — see the `removalTracker` branch below and `noteMarkerRemoval`.
 */
export function guardLocalMarkerAdd(
  deps: MarkerWriteDeps,
  element: Readonly<CanvasElement>,
  meta?: { origin?: string }
): MarkerAddGuardResult {
  if (meta?.origin !== undefined && meta.origin !== 'local') {
    return { status: 'ignored', reason: 'remote-origin' };
  }
  if (!isMarkerElement(element)) {
    return { status: 'ignored', reason: 'not-a-marker' };
  }

  // UNDO OF A DELETE, not a duplicate. `RemoveElementCommand.undo`
  // (`@fieldnotes/core/dist/index.js:5538-5540`) re-adds the very same element
  // with no meta, so it reaches this seam in exactly the shape a `mod+d` clone
  // does — except for the id, which `insertClones` makes fresh and history
  // keeps. The id, together with the `ref` the element carried when it left,
  // is therefore the discriminator.
  //
  // Restoring means: put back the audience it had at removal time, and leave
  // the `ref` ALONE. Rewriting it would silently un-share a shared pin and
  // decouple it from every sibling that shared that ref — lossy in a way undo
  // must never be.
  //
  // No entry (never removed, evicted, or removed on another map) or a stale
  // one (id reused with a different ref) falls THROUGH to the fail-closed
  // duplicate path below. Never to "assume shared".
  const remembered = deps.removalTracker?.take(element.id);
  if (
    remembered !== undefined &&
    remembered.ref === markerRefForElement(element)
  ) {
    // `deleteMarker` leaves the `dmOnlyElements` entry in place, so a DM-only
    // pin is usually still marked here; only write when it actually needs it.
    if (remembered.wasDmOnly && deps.getDmOnlyElements()[element.id] !== true) {
      deps.setDmOnly(element.id, true);
    }
    return { status: 'restored', wasDmOnly: remembered.wasDmOnly };
  }

  // The `createMarker` path already marked this id in step 3 of §6.7.
  // Re-marking would fire a second, redundant product-state write.
  if (deps.getDmOnlyElements()[element.id] === true) {
    return { status: 'ignored', reason: 'already-marked' };
  }

  deps.setDmOnly(element.id, true);

  // Read the mark back for the same reason `insertMarkerRecord` does: both
  // stores' `setDmOnly` silently no-op when the map is missing, and an
  // unverified mark is treated as no mark. Rewriting the ref against product
  // state that cannot record anything would only orphan the detail.
  if (deps.getDmOnlyElements()[element.id] !== true) {
    return { status: 'mark-failed' };
  }

  const cloned = cloneMarkerForMap(element, deps.getMarkers(), () =>
    nextId(deps)
  );
  if (!cloned) return { status: 'marked', rewrittenRef: null };

  deps.setMarkers([...deps.getMarkers(), cloned.detail]);
  // Only the DATA moves across: the element is already in the store under its
  // own id, position and layer — `cloned.element` exists purely to carry the
  // freshly-built, ref-rewritten payload.
  deps.store.update(element.id, { data: cloned.element.data });
  return { status: 'marked', rewrittenRef: cloned.detail.id };
}

/** Writes a clone into the TARGET map using the same §6.7 ordering as
 *  `createMarker` (the shared `insertMarkerRecord`). */
export function cloneMarkerToMap(
  target: MarkerWriteDeps,
  element: Readonly<CanvasElement>,
  sourceMarkers: readonly MarkerDetail[],
  overrides?: { position?: Point; size?: Size; layerId?: string }
): CreateMarkerResult | null {
  const cloned = cloneMarkerForMap(
    element,
    sourceMarkers,
    () => nextId(target),
    overrides
  );
  if (!cloned) return null;
  return insertMarkerRecord(target, cloned.element, cloned.detail);
}
