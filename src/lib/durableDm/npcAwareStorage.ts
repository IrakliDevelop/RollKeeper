import type { StateStorage } from 'zustand/middleware';

import { createSafeStorage } from '@/lib/safeStorage';

import { NPC_STORAGE_KEY } from './npcFamily';
import { npcUsesIndexedDbAuthority } from './npcLegacyAuthority';
import { isNpcClientVisible } from './slice11dFlags';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function npcsByCampaign(value: unknown): Record<string, unknown> | null {
  if (
    !record(value) ||
    !record(value.state) ||
    !record(value.state.npcsByCampaign)
  )
    return null;
  return value.state.npcsByCampaign;
}

/**
 * Keeps the legacy NPC envelope authoritative for every campaign that is still
 * on legacy storage, while freezing the entry of any campaign whose family
 * authority moved to IndexedDB or Postgres. When no campaign is routed the
 * envelope is written byte-identically.
 */
export function createNpcAwareStorage(backing?: Storage): StateStorage {
  const safe = createSafeStorage(backing);
  const storage =
    backing ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  return {
    getItem: safe.getItem,
    removeItem: safe.removeItem,
    setItem(key, nextRaw) {
      // While the client flag is off no campaign can be routed, so the write is
      // byte-identical to the legacy one and must not pay for a read or parse.
      if (key !== NPC_STORAGE_KEY || !storage || !isNpcClientVisible())
        return safe.setItem(key, nextRaw);
      const previousRaw = storage.getItem(key);
      try {
        const next = JSON.parse(nextRaw) as unknown;
        const nextNpcs = npcsByCampaign(next);
        // A freshly enrolled device can already carry an authority marker while
        // the legacy key has never been written. Treating that as an empty
        // previous envelope keeps cloud-hydrated NPCs out of legacy storage.
        const previousNpcs = previousRaw
          ? npcsByCampaign(JSON.parse(previousRaw))
          : {};
        if (!previousNpcs || !nextNpcs) return safe.setItem(key, nextRaw);
        let routed = false;
        const codes = new Set([
          ...Object.keys(previousNpcs),
          ...Object.keys(nextNpcs),
        ]);
        for (const code of codes) {
          if (!npcUsesIndexedDbAuthority(storage, code)) continue;
          routed = true;
          if (code in previousNpcs)
            nextNpcs[code] = structuredClone(previousNpcs[code]);
          else delete nextNpcs[code];
        }
        if (!routed) return safe.setItem(key, nextRaw);
        const routedRaw = JSON.stringify(next);
        if (routedRaw !== previousRaw) return safe.setItem(key, routedRaw);
      } catch {
        return safe.setItem(key, nextRaw);
      }
    },
  };
}
