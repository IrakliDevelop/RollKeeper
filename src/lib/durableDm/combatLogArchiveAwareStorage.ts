import type { StateStorage } from 'zustand/middleware';

import { createSafeStorage } from '@/lib/safeStorage';
import { COMBAT_LOG_STORAGE_KEY } from '@/utils/constants';

import { combatLogArchiveUsesIndexedDbAuthority } from './combatLogArchiveLegacyAuthority';
import { isCombatLogArchiveClientVisible } from './slice11fFlags';

interface CombatLogArchiveSlice {
  state: Record<string, unknown>;
  /** `state.encounters`, keyed by `archiveId` (ruling 6) — not an array. */
  archives: Record<string, unknown>;
  tombstones: Record<string, unknown>;
}

const EMPTY_SLICE: CombatLogArchiveSlice = {
  state: {},
  archives: {},
  tombstones: {},
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The routed campaign of an archive, or `undefined` when unscoped (ruling 1). */
function archiveCampaign(entry: unknown): string | undefined {
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

function combatLogArchiveSlice(value: unknown): CombatLogArchiveSlice | null {
  if (!record(value) || !record(value.state)) return null;
  const { state } = value;
  if (!record(state.encounters)) return null;
  return {
    state,
    archives: state.encounters,
    tombstones: record(state.combatLogTombstones)
      ? state.combatLogTombstones
      : {},
  };
}

/**
 * Keeps the legacy combat log envelope authoritative for every campaign that is
 * still on legacy storage, while freezing the archives and tombstones of any
 * campaign whose family authority moved to IndexedDB or Postgres. Only
 * `state.encounters` and `state.combatLogTombstones` are routed —
 * `activeArchiveId` is device-local (ruling 9) and any foreign envelope field is
 * passed through exactly as the writer produced them, as are archives with no
 * campaign (ruling 1) or a campaign that is still on legacy storage.
 * `lastAdmissionError` is session state that the store never persists, so it
 * appears in neither envelope. When no campaign is routed the envelope is
 * written byte-identically.
 */
export function createCombatLogArchiveAwareStorage(
  backing?: Storage
): StateStorage {
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
        key !== COMBAT_LOG_STORAGE_KEY ||
        !storage ||
        !isCombatLogArchiveClientVisible()
      )
        return safe.setItem(key, nextRaw);
      const previousRaw = storage.getItem(key);
      try {
        const next = JSON.parse(nextRaw) as unknown;
        const nextSlice = combatLogArchiveSlice(next);
        // A freshly enrolled device can already carry an authority marker while
        // the legacy key has never been written. Treating that as an empty
        // previous envelope keeps cloud-hydrated archives out of legacy storage
        // instead of leaking them on the first write.
        const previousSlice = previousRaw
          ? combatLogArchiveSlice(JSON.parse(previousRaw))
          : EMPTY_SLICE;
        if (!nextSlice || !previousSlice) return safe.setItem(key, nextRaw);

        const codes = new Set<string>();
        for (const entry of Object.values(previousSlice.archives)) {
          const code = archiveCampaign(entry);
          if (code) codes.add(code);
        }
        for (const entry of Object.values(nextSlice.archives)) {
          const code = archiveCampaign(entry);
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
        // Sorted so the reconstruction is a fixpoint: the routed archives are
        // rebuilt in one deterministic key order — campaign code ascending,
        // then the previous envelope's own key order — so re-writing an already
        // routed envelope reproduces the very same bytes.
        const routed = [...codes]
          .filter(code => combatLogArchiveUsesIndexedDbAuthority(storage, code))
          .sort();
        if (routed.length === 0) return safe.setItem(key, nextRaw);
        const isRouted = new Set(routed);

        const archives: Record<string, unknown> = {};
        for (const [id, entry] of Object.entries(nextSlice.archives)) {
          const code = archiveCampaign(entry);
          if (!code || !isRouted.has(code)) archives[id] = entry;
        }
        for (const code of routed) {
          for (const [id, entry] of Object.entries(previousSlice.archives)) {
            if (archiveCampaign(entry) === code)
              archives[id] = structuredClone(entry);
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

        nextSlice.state.encounters = archives;
        // Never introduce the key on an envelope that does not carry it.
        if (
          'combatLogTombstones' in nextSlice.state ||
          Object.keys(tombstones).length > 0
        )
          nextSlice.state.combatLogTombstones = tombstones;

        const routedRaw = JSON.stringify(next);
        if (routedRaw !== previousRaw) return safe.setItem(key, routedRaw);
      } catch {
        return safe.setItem(key, nextRaw);
      }
    },
  };
}
