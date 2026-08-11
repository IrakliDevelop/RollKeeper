/**
 * The public marker projection — spec §6.4.
 *
 * This module is the security boundary of the marker feature. The DM-only
 * toggle in the UI is convenience; THIS is the enforcement. Two properties
 * matter and both are structural, not procedural:
 *
 *  1. `dmNotes` is unreachable **by construction**. The output is built by an
 *     explicit three-field pick (`{ id, title, body }`) from a detail record —
 *     never a spread, never the caller's object — so a field added to
 *     `MarkerDetail` later cannot ride through to players by omission.
 *  2. A ref is public **only if every** pin referencing it is shared. `every`,
 *     never `some`: one hidden sibling hides the record. A mixed sibling set is
 *     dropped and reported rather than resolved in either direction.
 *
 * Authority is the CANVAS, post-deserialization: refs come from marker element
 * `data` re-validated through `parseMarkerData` (§6.2 — persisted and remote
 * data is untrusted before every use), and are matched only against THIS map's
 * marker collection. A map id inside marker `data` is never read or trusted.
 *
 * Pure data: no React, no Zustand, no viewport.
 */

import { MARKER_HTML_TYPE, parseMarkerData } from './markerData';

import type { MarkerDetail, PublicMarkerDetail } from '@/types/battlemap';

export interface MarkerPublicationInput {
  /** The map's serialized canvas — `viewport.exportJSON()` output or the
   *  persisted `canvasState`. */
  canvasState: string | null | undefined;
  /** THIS map's marker details. Never another map's. */
  markers: readonly MarkerDetail[];
  dmOnlyElements: Readonly<Record<string, boolean>>;
  /** §6.4: the projection independently drops mixed refs and logs. */
  onDroppedRef?: (info: { ref: string; reason: 'mixed-audience' }) => void;
}

/**
 * Returns the canvas element list, or `null` when the canvas cannot be read.
 *
 * FAIL-CLOSED DIRECTION — read this before "harmonising" it with
 * `gcOrphanMarkerDetails` in `markerWrites.ts`, which takes the SAME inputs and
 * makes the OPPOSITE decision on purpose. There, failing closed means doing
 * nothing (skip: never destroy details we cannot prove are orphaned). Here,
 * failing closed means publishing nothing (return `[]`: never expose a record
 * whose audience we cannot prove). Each is the safe direction for its own
 * operation; making them agree would break one of them.
 */
function readCanvasElements(
  canvasState: string | null | undefined
): unknown[] | null {
  if (
    canvasState === null ||
    canvasState === undefined ||
    canvasState.trim() === ''
  ) {
    return null;
  }

  let parsedState: unknown;
  try {
    parsedState = JSON.parse(canvasState);
  } catch {
    return null;
  }

  if (
    typeof parsedState !== 'object' ||
    parsedState === null ||
    Array.isArray(parsedState)
  ) {
    return null;
  }

  const elements = (parsedState as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return null;
  return elements;
}

/**
 * Groups the element ids of every VALID marker pin by the `ref` it carries.
 *
 * A pin whose data parses `invalid` or `unsupported` contributes no ref at all,
 * so a detail reachable only through such a pin is never published — and,
 * unlike the GC (which refuses to run at all when it meets one), an unreadable
 * pin does not suppress its unrelated siblings.
 */
function pinIdsByRef(elements: readonly unknown[]): Map<string, string[]> {
  const byRef = new Map<string, string[]>();

  for (const element of elements) {
    if (typeof element !== 'object' || element === null) continue;
    const candidate = element as {
      id?: unknown;
      type?: unknown;
      htmlType?: unknown;
      data?: unknown;
    };
    if (candidate.type !== 'html') continue;
    if (candidate.htmlType !== MARKER_HTML_TYPE) continue;
    // Without an id we cannot look the pin's audience up, and an unknown
    // audience must never resolve to "shared".
    if (typeof candidate.id !== 'string' || candidate.id === '') continue;

    const parsed = parseMarkerData(candidate.data);
    if (parsed.status !== 'valid') continue;

    const existing = byRef.get(parsed.data.ref);
    if (existing) {
      existing.push(candidate.id);
    } else {
      byRef.set(parsed.data.ref, [candidate.id]);
    }
  }

  return byRef;
}

/**
 * Derives the public marker list for one map from its canvas and its own
 * detail records. Returns `[]` for any canvas it cannot fully read.
 */
export function buildPublicMarkerDetails(
  input: MarkerPublicationInput
): PublicMarkerDetail[] {
  const elements = readCanvasElements(input.canvasState);
  if (elements === null) return [];

  const byRef = pinIdsByRef(elements);

  const publicRefs = new Set<string>();
  for (const [ref, elementIds] of byRef) {
    const isShared = (id: string): boolean => !input.dmOnlyElements[id];
    if (elementIds.every(isShared)) {
      publicRefs.add(ref);
    } else if (elementIds.some(isShared)) {
      // Some pins shared, some hidden: the DM's intent is ambiguous, so the
      // record stays private and the caller is told why.
      input.onDroppedRef?.({ ref, reason: 'mixed-audience' });
    }
  }

  const published: PublicMarkerDetail[] = [];
  for (const detail of input.markers) {
    if (detail.deletedAt) continue;
    if (!publicRefs.has(detail.id)) continue;
    // Explicit field pick. Never `{ ...detail }`, never `detail` itself.
    published.push({ id: detail.id, title: detail.title, body: detail.body });
  }

  return published;
}
