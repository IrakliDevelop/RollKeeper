import type { StateStorage } from 'zustand/middleware';

import { createSafeStorage } from '@/lib/safeStorage';

import { MAGIC_ITEM_STORAGE_KEY } from './magicItemFamily';
import { magicItemUsesIndexedDbAuthority } from './magicItemLegacyAuthority';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function itemsByCampaign(value: unknown): Record<string, unknown> | null {
  if (
    !record(value) ||
    !record(value.state) ||
    !record(value.state.itemsByCampaign)
  )
    return null;
  return value.state.itemsByCampaign;
}

/**
 * Keeps the legacy magic item envelope authoritative for every campaign that is
 * still on legacy storage, while freezing the entry of any campaign whose family
 * authority moved to IndexedDB or Postgres. When no campaign is routed the
 * envelope is written byte-identically.
 */
export function createMagicItemAwareStorage(backing?: Storage): StateStorage {
  const safe = createSafeStorage(backing);
  const storage =
    backing ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  return {
    getItem: safe.getItem,
    removeItem: safe.removeItem,
    setItem(key, nextRaw) {
      if (key !== MAGIC_ITEM_STORAGE_KEY || !storage)
        return safe.setItem(key, nextRaw);
      const previousRaw = storage.getItem(key);
      if (!previousRaw) return safe.setItem(key, nextRaw);
      try {
        const next = JSON.parse(nextRaw) as unknown;
        const previousItems = itemsByCampaign(JSON.parse(previousRaw));
        const nextItems = itemsByCampaign(next);
        if (!previousItems || !nextItems) return safe.setItem(key, nextRaw);
        let routed = false;
        const codes = new Set([
          ...Object.keys(previousItems),
          ...Object.keys(nextItems),
        ]);
        for (const code of codes) {
          if (!magicItemUsesIndexedDbAuthority(storage, code)) continue;
          routed = true;
          if (code in previousItems)
            nextItems[code] = structuredClone(previousItems[code]);
          else delete nextItems[code];
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
