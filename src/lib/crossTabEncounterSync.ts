import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';

import type { Encounter } from '@/types/encounter';

interface EncounterStoreLike {
  getState: () => { encounters: Encounter[] };
  setState: (partial: { encounters: Encounter[] }) => void;
}

/**
 * Cross-tab encounter convergence (mirrors crossTabRosterSync). The DM
 * routinely keeps the encounter page and the battlemap open in separate
 * tabs; zustand persist writes localStorage but never listens for the
 * `storage` event, so without this each tab's in-memory store goes stale
 * until a reload. Merge per encounter by `updatedAt` — strictly newer
 * wins (every store mutation stamps it); unknown ids are adopted (created
 * in another tab); local-only encounters are kept (deletion sync is out
 * of scope, same as the roster). setState only on change, so the echo
 * event the other tab receives finds equal timestamps and terminates.
 * Same-timestamp concurrent edits are last-writer-wins.
 */
export function initCrossTabEncounterSync(
  store: EncounterStoreLike
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== ENCOUNTER_STORAGE_KEY || !event.newValue) return;
    let incoming: Encounter[] | undefined;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      incoming = (parsed as { state?: { encounters?: Encounter[] } } | null)
        ?.state?.encounters;
    } catch {
      return;
    }
    if (!Array.isArray(incoming)) return;

    const incomingById = new Map(
      incoming
        .filter(entry => entry && typeof entry.id === 'string')
        .map(entry => [entry.id, entry])
    );
    let changed = false;
    const merged = store.getState().encounters.map(entry => {
      const candidate = incomingById.get(entry.id);
      incomingById.delete(entry.id);
      if (!candidate) return entry;
      if ((candidate.updatedAt ?? '') > (entry.updatedAt ?? '')) {
        changed = true;
        return candidate;
      }
      return entry;
    });
    for (const adopted of incomingById.values()) {
      merged.push(adopted);
      changed = true;
    }
    if (changed) store.setState({ encounters: merged });
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
