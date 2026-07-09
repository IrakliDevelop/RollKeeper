import { useEffect, useRef, useState } from 'react';

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

  // Load character data into store when component mounts or character changes
  useEffect(() => {
    if (playerCharacter && hasHydrated) {
      const currentCharacterId = playerCharacter.characterData.id;

      // Only load if we haven't loaded this character yet or if it's a different character
      if (lastLoadedCharacterRef.current !== currentCharacterId) {
        setIsInitialLoad(true);
        loadCharacterState(playerCharacter.characterData);
        lastLoadedCharacterRef.current = currentCharacterId;
        lastSyncedCharacterRef.current = playerCharacter.characterData;

        onLoad?.(playerCharacter.characterData);

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
        lastSyncedCharacterRef.current = characterCopy;
      }
    }
  }, [character, characterId, updateCharacterData, hasHydrated, isInitialLoad]);

  return { isInitialLoad };
}
