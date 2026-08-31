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

function markerVersion(marker: CharacterDeletionTombstone | undefined): number {
  if (!marker) return 0;
  return Math.max(marker.deletedAt, marker.resolvedAt ?? 0);
}

function isActiveTombstone(
  marker: CharacterDeletionTombstone | undefined
): boolean {
  return Boolean(marker && marker.deletedAt >= (marker.resolvedAt ?? 0));
}

/**
 * Cross-tab roster convergence. Each tab persists its WHOLE roster, so a tab
 * holding character B used to write back a stale copy of character A over
 * A's fresh entry (multi-tab clobber). Merge per entry by (revision,
 * lastMutatedAt, lastMutatedBy) — strictly fresher wins; unknown ids are
 * adopted (created elsewhere). Ordered tombstone markers override ordinary
 * freshness for explicit deletion, restore, and account-switch rollback;
 * candidates coupled to an older marker cannot resurrect stale data. setState
 * only on change, so the echo event the other tab receives terminates.
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
    const authoritativeResolutions = new Set<string>();
    let changed = false;
    for (const [id, tombstone] of Object.entries(incomingTombstones)) {
      const local = characterTombstones[id];
      if (markerVersion(tombstone) > markerVersion(local)) {
        characterTombstones[id] = tombstone;
        if (!isActiveTombstone(tombstone)) {
          authoritativeResolutions.add(id);
        }
        changed = true;
      }
    }
    const incomingById = new Map(
      incoming
        .filter(entry => entry && typeof entry.id === 'string')
        .filter(entry => !isActiveTombstone(characterTombstones[entry.id]))
        .filter(entry => {
          const localMarker = current.characterTombstones[entry.id];
          if (!localMarker) return true;
          return (
            markerVersion(incomingTombstones[entry.id]) >=
            markerVersion(localMarker)
          );
        })
        .map(entry => [entry.id, entry])
    );
    const merged = current.characters
      .filter(entry => {
        const keep = !isActiveTombstone(characterTombstones[entry.id]);
        if (!keep) changed = true;
        return keep;
      })
      .map(entry => {
        const candidate = incomingById.get(entry.id);
        incomingById.delete(entry.id);
        if (!candidate) return entry;
        if (authoritativeResolutions.has(entry.id)) {
          changed = true;
          return candidate;
        }
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
