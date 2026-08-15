import { isStrictlyFresher } from '@/lib/characterFreshness';
import { PLAYER_STORAGE_KEY } from '@/utils/constants';
import type {
  CharacterDeletionTombstone,
  PlayerCharacter,
} from '@/store/playerStore';

type RosterEntryLike = PlayerCharacter;
interface PlayerStoreLike {
  getState: () => {
    characters: RosterEntryLike[];
    characterTombstones: Record<string, CharacterDeletionTombstone>;
  };
  setState: (partial: {
    characters: RosterEntryLike[];
    characterTombstones: Record<string, CharacterDeletionTombstone>;
  }) => void;
}

/**
 * Cross-tab roster convergence. Each tab persists its WHOLE roster, so a tab
 * holding character B used to write back a stale copy of character A over
 * A's fresh entry (multi-tab clobber). Merge per entry by (revision,
 * lastMutatedAt, lastMutatedBy) — strictly fresher wins; unknown ids are
 * adopted (created elsewhere); local-only entries are kept (deletion sync is
 * out of scope). setState only on change, so the echo event the other tab
 * receives finds equal revisions and terminates.
 */
export function initCrossTabRosterSync(store: PlayerStoreLike): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== PLAYER_STORAGE_KEY || !event.newValue) return;
    let incoming: RosterEntryLike[] | undefined;
    let incomingTombstones: Record<string, CharacterDeletionTombstone> = {};
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      const incomingState = (
        parsed as {
          state?: {
            characters?: RosterEntryLike[];
            characterTombstones?: Record<string, CharacterDeletionTombstone>;
          };
        } | null
      )?.state;
      incoming = incomingState?.characters;
      incomingTombstones = incomingState?.characterTombstones ?? {};
    } catch {
      return;
    }
    if (!Array.isArray(incoming)) return;

    const current = store.getState();
    const characterTombstones = { ...current.characterTombstones };
    let changed = false;
    for (const [id, tombstone] of Object.entries(incomingTombstones)) {
      const local = characterTombstones[id];
      if (!local || tombstone.deletedAt > local.deletedAt) {
        characterTombstones[id] = tombstone;
        changed = true;
      }
    }
    const incomingById = new Map(
      incoming
        .filter(entry => entry && typeof entry.id === 'string')
        .filter(entry => !characterTombstones[entry.id])
        .map(entry => [entry.id, entry])
    );
    const merged = current.characters
      .filter(entry => {
        const keep = !characterTombstones[entry.id];
        if (!keep) changed = true;
        return keep;
      })
      .map(entry => {
        const candidate = incomingById.get(entry.id);
        incomingById.delete(entry.id);
        if (!candidate) return entry;
        if (
          isStrictlyFresher(
            candidate.characterData ?? {},
            entry.characterData ?? {}
          )
        ) {
          changed = true;
          return candidate;
        }
        return entry;
      });
    for (const adopted of incomingById.values()) {
      merged.push(adopted);
      changed = true;
    }
    if (changed) store.setState({ characters: merged, characterTombstones });
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
