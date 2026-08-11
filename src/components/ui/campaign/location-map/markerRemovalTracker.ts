/**
 * In-session memory of marker pins that left the canvas store, so the
 * `store.on('add')` audience guard can tell an UNDO of a delete from a
 * duplicate/paste.
 *
 * Both arrive at the same seam as a bare `store.add(element)` with no meta:
 * `insertClones` (`@fieldnotes/core/dist/index.js:1291-1340`) for a `mod+d` /
 * paste / context-menu clone, and `RemoveElementCommand.undo` (`:5538-5540`)
 * for an undo. The only thing that separates them is the ELEMENT ID: a clone
 * gets a fresh one, an undo re-adds the same one. That makes "did an element
 * with this id leave this map, still carrying this ref?" the discriminator,
 * and this module is where that question is answered.
 *
 * Bounded on purpose — a DM surface can stay mounted for a whole session:
 *  - at most `MARKER_REMOVAL_TRACKER_LIMIT` entries, oldest evicted first
 *    (`Map` iterates in insertion order, and `record` re-inserts so the order
 *    is always oldest-first);
 *  - each entry is consumed by the first `take` for its id, so the normal
 *    delete → undo round trip leaves nothing behind;
 *  - `useMarkerWrites` throws the whole tracker away when the bound map (or
 *    surface mode) changes, because a removal on one map can never be undone
 *    into another.
 *
 * Pure: no React, no Zustand, no viewport.
 */

/** What a removed marker pin was, at the moment it was removed. */
export interface MarkerRemovalRecord {
  /** Canvas element id — the discriminator itself. */
  readonly id: string;
  /** The `ref` its data carried when it left. */
  readonly ref: string;
  /** Its audience at removal time, read from product state. */
  readonly wasDmOnly: boolean;
}

/**
 * Eviction cap. Comfortably more than any plausible run of deletes a DM could
 * still want to undo in one sitting, and small enough that the memory cost is
 * irrelevant. Overflowing it is safe: a forgotten removal falls through to the
 * fail-closed duplicate path, never to "assume shared".
 */
export const MARKER_REMOVAL_TRACKER_LIMIT = 64;

export interface MarkerRemovalTracker {
  /** Remembers a removal, replacing any older entry for the same id. */
  record(entry: MarkerRemovalRecord): void;
  /**
   * Consumes and returns the entry for `id`, or `undefined`.
   *
   * Consumed on ANY id hit, including one whose `ref` the caller then rejects:
   * the id is back in the store either way, so a later add reusing it is a new
   * event and must not be able to read this stale entry as an undo.
   */
  take(id: string): MarkerRemovalRecord | undefined;
  /** Entries currently remembered. Exposed for the bound's test. */
  size(): number;
}

export function createMarkerRemovalTracker(
  limit: number = MARKER_REMOVAL_TRACKER_LIMIT
): MarkerRemovalTracker {
  const entries = new Map<string, MarkerRemovalRecord>();

  return {
    record(entry: MarkerRemovalRecord): void {
      // Delete first so a re-recorded id moves to the END of the insertion
      // order: eviction must drop the least recently removed, not the id that
      // happens to have been seen first.
      entries.delete(entry.id);
      entries.set(entry.id, entry);
      while (entries.size > limit) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },
    take(id: string): MarkerRemovalRecord | undefined {
      const entry = entries.get(id);
      if (entry !== undefined) entries.delete(id);
      return entry;
    },
    size: (): number => entries.size,
  };
}
