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
        // Sorted so the reconstruction is a fixpoint: re-writing an already
        // routed envelope reproduces the very same bytes.
        const routed = [...codes]
          .filter(code => encounterUsesIndexedDbAuthority(storage, code))
          .sort();
        if (routed.length === 0) return safe.setItem(key, nextRaw);
        const isRouted = new Set(routed);

        const encounters = nextSlice.encounters.filter(entry => {
          const code = encounterCampaign(entry);
          return !code || !isRouted.has(code);
        });
        for (const code of routed) {
          for (const entry of previousSlice.encounters) {
            if (encounterCampaign(entry) === code)
              encounters.push(structuredClone(entry));
          }
        }

        const tombstones: Record<string, unknown> = {};
        for (const [id, entry] of Object.entries(nextSlice.tombstones)) {
          const code = tombstoneCampaign(entry);
          if (!code || !isRouted.has(code)) tombstones[id] = entry;
        }
        for (const [id, entry] of Object.entries(previousSlice.tombstones)) {
          const code = tombstoneCampaign(entry);
          if (code && isRouted.has(code))
            tombstones[id] = structuredClone(entry);
        }

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
