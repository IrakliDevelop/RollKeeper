import type { StateStorage } from 'zustand/middleware';

import { createSafeStorage } from '@/lib/safeStorage';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';

import { encounterUsesIndexedDbAuthority } from './encounterLegacyAuthority';
import { isEncounterClientVisible } from './slice11eFlags';

interface EncounterSlice {
  state: Record<string, unknown>;
  encounters: unknown[];
  tombstones: Record<string, unknown>;
}

const EMPTY_SLICE: EncounterSlice = {
  state: {},
  encounters: [],
  tombstones: {},
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The routed campaign of an encounter entry, or `undefined` when unscoped. */
function encounterCampaign(entry: unknown): string | undefined {
  if (!record(entry) || typeof entry.campaignCode !== 'string')
    return undefined;
  return entry.campaignCode;
}

/** Tombstones carry their campaign on the before-image only (ruling 3). */
function tombstoneCampaign(entry: unknown): string | undefined {
  if (!record(entry) || !record(entry.beforeImage)) return undefined;
  const code = entry.beforeImage.campaignCode;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Merges a previous and next keyed record so that entries whose campaign is
 * routed are frozen at their previous value while everything else follows
 * the next envelope, and the result's key order matches the previous
 * envelope's own order (new keys, if any, are appended in the next
 * envelope's order). Rebuilding in `[unrouted, then routed]` order instead
 * would reorder the object's keys — and therefore its serialized bytes —
 * even when nothing routed actually changed, which is the exact defect this
 * ordering guards against.
 */
function mergeRoutedRecord(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  isRouted: Set<string>,
  campaignOf: (entry: unknown) => string | undefined
): Record<string, unknown> {
  const previousIds = Object.keys(previous);
  const previousIdSet = new Set(previousIds);
  const orderedIds = [
    ...previousIds,
    ...Object.keys(next).filter(id => !previousIdSet.has(id)),
  ];
  const merged: Record<string, unknown> = {};
  for (const id of orderedIds) {
    const nextEntry = next[id];
    const previousEntry = previous[id];
    const code = campaignOf(nextEntry) ?? campaignOf(previousEntry);
    if (code && isRouted.has(code)) {
      if (previousEntry !== undefined)
        merged[id] = structuredClone(previousEntry);
    } else if (nextEntry !== undefined) {
      merged[id] = nextEntry;
    }
  }
  return merged;
}

/**
 * Same ordering guarantee as `mergeRoutedRecord`, for `state.encounters`,
 * which is an array rather than a keyed record. This deliberately does not
 * match entries by an `id` field — a real encounter always has one, but
 * malformed data (no `id`, or a duplicate `id`) must still be reproduced
 * faithfully rather than reordered or collapsed, and the routed/unrouted
 * split never actually needs identity: a routed entry always freezes at its
 * previous value regardless of what `next` holds, and an unrouted entry
 * always follows `next` regardless of what `previous` held. So this walks
 * `previous` in its own order and, at each position, either freezes the
 * previous (routed) entry or pulls the next unconsumed unrouted entry from
 * `next`'s own queue (in `next`'s own order) — reproducing `previous`'s
 * exact arrangement whenever nothing routed or unrouted actually changed.
 * Entries newly added in `next` (beyond what `previous` had unrouted slots
 * for) are appended at the tail, in `next`'s own order.
 */
function mergeRoutedArray(
  previous: unknown[],
  next: unknown[],
  isRouted: Set<string>,
  campaignOf: (entry: unknown) => string | undefined
): unknown[] {
  const isEntryRouted = (entry: unknown) => {
    const code = campaignOf(entry);
    return code !== undefined && isRouted.has(code);
  };
  const nextUnroutedQueue = next.filter(entry => !isEntryRouted(entry));

  const merged: unknown[] = [];
  let unroutedIndex = 0;
  for (const entry of previous) {
    if (isEntryRouted(entry)) {
      merged.push(structuredClone(entry));
    } else if (unroutedIndex < nextUnroutedQueue.length) {
      merged.push(nextUnroutedQueue[unroutedIndex]);
      unroutedIndex += 1;
    }
    // else: this previous unrouted slot has nothing left in `next` — the
    // entry was removed.
  }
  merged.push(...nextUnroutedQueue.slice(unroutedIndex));
  return merged;
}

function encounterSlice(value: unknown): EncounterSlice | null {
  if (!record(value) || !record(value.state)) return null;
  const { state } = value;
  if (!Array.isArray(state.encounters)) return null;
  return {
    state,
    encounters: state.encounters,
    tombstones: record(state.encounterTombstones)
      ? state.encounterTombstones
      : {},
  };
}

/**
 * Keeps the legacy encounter envelope authoritative for every campaign that is
 * still on legacy storage, while freezing the encounters and tombstones of any
 * campaign whose family authority moved to IndexedDB or Postgres. Only
 * `state.encounters` and `state.encounterTombstones` are routed —
 * `combatConfig`, `activeEncounterId` and any foreign envelope field are passed
 * through exactly as the writer produced them (ruling 2), as are encounters
 * with no campaign or a campaign that is still on legacy storage (ruling 3).
 * When no campaign is routed the envelope is written byte-identically.
 */
export function createEncounterAwareStorage(backing?: Storage): StateStorage {
  const safe = createSafeStorage(backing);
  const storage =
    backing ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  return {
    getItem: safe.getItem,
    removeItem: safe.removeItem,
    setItem(key, nextRaw) {
      // While the client flag is off no campaign can be routed, so the write is
      // byte-identical to the legacy one and must not pay for a read or parse.
      if (
        key !== ENCOUNTER_STORAGE_KEY ||
        !storage ||
        !isEncounterClientVisible()
      )
        return safe.setItem(key, nextRaw);
      const previousRaw = storage.getItem(key);
      try {
        const next = JSON.parse(nextRaw) as unknown;
        const nextSlice = encounterSlice(next);
        // A freshly enrolled device can already carry an authority marker while
        // the legacy key has never been written. Treating that as an empty
        // previous envelope keeps cloud-hydrated encounters out of legacy
        // storage instead of leaking them on the first write.
        const previousSlice = previousRaw
          ? encounterSlice(JSON.parse(previousRaw))
          : EMPTY_SLICE;
        if (!nextSlice || !previousSlice) return safe.setItem(key, nextRaw);

        const codes = new Set<string>();
        for (const entry of previousSlice.encounters) {
          const code = encounterCampaign(entry);
          if (code) codes.add(code);
        }
        for (const entry of nextSlice.encounters) {
          const code = encounterCampaign(entry);
          if (code) codes.add(code);
        }
        for (const entry of Object.values(previousSlice.tombstones)) {
          const code = tombstoneCampaign(entry);
          if (code) codes.add(code);
        }
        for (const entry of Object.values(nextSlice.tombstones)) {
          const code = tombstoneCampaign(entry);
          if (code) codes.add(code);
        }
        const routed = [...codes].filter(code =>
          encounterUsesIndexedDbAuthority(storage, code)
        );
        if (routed.length === 0) return safe.setItem(key, nextRaw);
        const isRouted = new Set(routed);

        const encounters = mergeRoutedArray(
          previousSlice.encounters,
          nextSlice.encounters,
          isRouted,
          encounterCampaign
        );

        const tombstones = mergeRoutedRecord(
          previousSlice.tombstones,
          nextSlice.tombstones,
          isRouted,
          tombstoneCampaign
        );

        nextSlice.state.encounters = encounters;
        // Never introduce the key on an envelope that does not carry it.
        if (
          'encounterTombstones' in nextSlice.state ||
          Object.keys(tombstones).length > 0
        )
          nextSlice.state.encounterTombstones = tombstones;

        const routedRaw = JSON.stringify(next);
        if (routedRaw !== previousRaw) return safe.setItem(key, routedRaw);
      } catch {
        return safe.setItem(key, nextRaw);
      }
    },
  };
}
