import type { StateStorage } from 'zustand/middleware';

/** Window event fired when a localStorage write fails because the quota is full. */
export const STORAGE_QUOTA_EVENT = 'rollkeeper:storage-quota-exceeded';

/** True for the various browser representations of a storage-quota error. */
export function isQuotaExceeded(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || // Firefox
    e.code === 22 ||
    e.code === 1014
  );
}

/**
 * A localStorage-backed Zustand storage that fails loudly, not silently. When a
 * write exceeds the quota it dispatches `STORAGE_QUOTA_EVENT` (so the UI can warn
 * the user to export) instead of throwing — the app keeps running. Non-quota
 * errors still propagate. Pass a backing store for tests; defaults to
 * `localStorage` on the client.
 */
export function createSafeStorage(backing?: Storage): StateStorage {
  const store =
    backing ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);

  return {
    getItem: key => (store ? store.getItem(key) : null),
    setItem: (key, value) => {
      if (!store) return;
      try {
        store.setItem(key, value);
      } catch (e) {
        if (isQuotaExceeded(e)) {
          console.error(
            `localStorage quota exceeded while saving "${key}". Data was not persisted.`,
            e
          );
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent(STORAGE_QUOTA_EVENT, { detail: { key } })
            );
          }
        } else {
          throw e;
        }
      }
    },
    removeItem: key => {
      if (store) store.removeItem(key);
    },
  };
}
