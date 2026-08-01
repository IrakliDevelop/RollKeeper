import { useEffect, useRef, useState } from 'react';

import {
  pickFresherCharacter,
  readCharacterEnvelope,
} from '@/lib/characterCanonicalStorage';
import { isStrictlyFresher } from '@/lib/characterFreshness';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

/** Minimal roster-entry shape both callers need — avoids importing the full
 * `PlayerCharacter` type just for its `characterData` field. */
interface RosterCharacter {
  characterData: CharacterState;
}

interface UseCharacterRosterSyncOptions {
  /** The roster entry for this character, as looked up from `playerStore`. */
  playerCharacter: RosterCharacter | null | undefined;
  hasHydrated: boolean;
  characterId: string;
  /** Live character from `characterStore`. */
  character: CharacterState;
  loadCharacterState: (characterState: CharacterState) => void;
  updateCharacterData: (
    characterId: string,
    characterData: CharacterState
  ) => void;
  /**
   * Fired synchronously right after `loadCharacterState` runs for a newly
   * loaded character — mirrors where the sheet page hangs its trait-migration
   * side effect (`page.tsx:398-409`).
   */
  onLoad?: (loadedCharacterData: CharacterState) => void;
}

/**
 * Ports the sheet page's paired character-load / write-back effects
 * (`src/app/player/characters/[characterId]/page.tsx:387-442`) so both the
 * sheet and the VTT screen keep `characterStore` and the `playerStore`
 * roster blob in sync, with identical guards and timing.
 */
export function useCharacterRosterSync({
  playerCharacter,
  hasHydrated,
  characterId,
  character,
  loadCharacterState,
  updateCharacterData,
  onLoad,
}: UseCharacterRosterSyncOptions) {
  const lastLoadedCharacterRef = useRef<string | null>(null);
  const lastSyncedCharacterRef = useRef<CharacterState | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Latest-value ref for `character` — read (not reactively depended on) by
  // the load effect below. `character` is expected to change on nearly every
  // local mutation, and making the load effect depend on it directly would
  // re-run it (and cancel the in-flight initial-load timer) on every one of
  // those changes instead of only on character-switch.
  const characterRef = useRef(character);
  characterRef.current = character;

  // Load character data into store when component mounts or character changes
  useEffect(() => {
    if (playerCharacter && hasHydrated) {
      const currentCharacterId = playerCharacter.characterData.id;
      const liveCharacter = characterRef.current;

      // Only load if we haven't loaded this character yet or if it's a different character
      if (lastLoadedCharacterRef.current !== currentCharacterId) {
        // Canonical envelope (per-character key, legacy-slot fallback)
        // vs roster entry: strictly fresher wins, envelope wins ties
        // (spec §migration seed arbitration). The live characterStore
        // state may be fresher still (storage-event adoption) — never
        // clobber it with a stale candidate.
        const envelope = readCharacterEnvelope(currentCharacterId);
        const candidate =
          pickFresherCharacter(envelope, playerCharacter.characterData) ??
          playerCharacter.characterData;

        const isStaleCandidate =
          candidate.id === liveCharacter.id &&
          !isStrictlyFresher(candidate, liveCharacter);

        setIsInitialLoad(true);
        if (!isStaleCandidate) {
          loadCharacterState(candidate);
          if (envelope && candidate === envelope.character) {
            useCharacterStore.setState({
              intentWatermarks: envelope.intentWatermarks,
            });
          }
          onLoad?.(candidate);
        }
        lastLoadedCharacterRef.current = currentCharacterId;
        lastSyncedCharacterRef.current = candidate;

        // Mark initial load as complete after state has been set
        const timer = setTimeout(() => {
          setIsInitialLoad(false);
        }, 50);

        return () => clearTimeout(timer);
      }
    }
  }, [playerCharacter, hasHydrated, loadCharacterState, onLoad]);

  // Sync character data back to player store when it changes (skip during initial load)
  useEffect(() => {
    if (!isInitialLoad && hasHydrated && character.id === characterId) {
      // Deep comparison to prevent unnecessary updates and infinite loops
      const hasActualChanges =
        !lastSyncedCharacterRef.current ||
        JSON.stringify(lastSyncedCharacterRef.current) !==
          JSON.stringify(character);

      if (hasActualChanges) {
        // Create a deep copy to avoid reference issues
        const characterCopy = JSON.parse(JSON.stringify(character));
        updateCharacterData(characterId, characterCopy);
        // `updateCharacterData` may refuse a stale-revision write, so this
        // ref only records what THIS tab attempted, not confirmed roster
        // state. That's benign: the live characterStore state (which the
        // storage listener keeps fresh) is what other consumers converge
        // on, not this ref.
        lastSyncedCharacterRef.current = characterCopy;
      }
    }
  }, [character, characterId, updateCharacterData, hasHydrated, isInitialLoad]);

  return { isInitialLoad };
}
