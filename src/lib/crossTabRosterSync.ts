import { PLAYER_STORAGE_KEY } from '@/utils/constants';
import type { PlayerCharacter } from '@/store/playerStore';

type RosterEntryLike = PlayerCharacter;
interface PlayerStoreLike {
  getState: () => { characters: RosterEntryLike[] };
  setState: (partial: { characters: RosterEntryLike[] }) => void;
}

/**
 * Cross-tab roster convergence. Each tab persists its WHOLE roster, so a tab
 * holding character B used to write back a stale copy of character A over
 * A's fresh entry (multi-tab clobber). Merge per entry by
 * characterData.revision — strictly newer wins; unknown ids are adopted
 * (created elsewhere); local-only entries are kept (deletion sync is out of
 * scope). setState only on change, so the echo event the other tab receives
 * finds equal revisions and terminates.
 */
export function initCrossTabRosterSync(store: PlayerStoreLike): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== PLAYER_STORAGE_KEY || !event.newValue) return;
    let incoming: RosterEntryLike[] | undefined;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      incoming = (
        parsed as { state?: { characters?: RosterEntryLike[] } } | null
      )?.state?.characters;
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
    const merged = store.getState().characters.map(entry => {
      const candidate = incomingById.get(entry.id);
      incomingById.delete(entry.id);
      if (!candidate) return entry;
      const incomingRevision = candidate.characterData?.revision ?? 0;
      const localRevision = entry.characterData?.revision ?? 0;
      if (incomingRevision > localRevision) {
        changed = true;
        return candidate;
      }
      return entry;
    });
    for (const adopted of incomingById.values()) {
      merged.push(adopted);
      changed = true;
    }
    if (changed) store.setState({ characters: merged });
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
