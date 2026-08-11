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
    zIndex: input.zIndex,
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
 * Returns false when no record carries that id.
 */
export function editMarkerDetail(
  deps: MarkerWriteDeps,
  ref: string,
  patch: { title?: string; body?: string; dmNotes?: string }
): boolean {
  const markers = deps.getMarkers();
  let found = false;

  const next = markers.map(marker => {
    if (marker.id !== ref) return marker;
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
  // DmLocationEditor.hooks.ts handleToggleDmOnly / handleRevealAll.
  for (const id of elementIds) deps.store.update(id, {});

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
    zIndex: element.zIndex,
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
