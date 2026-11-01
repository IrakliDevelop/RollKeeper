'use client';

import { useCallback, useEffect } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterRosterSync } from '@/hooks/useCharacterRosterSync';
import { useHydration } from '@/hooks/useHydration';
import { useAutoSave } from '@/hooks/useAutoSave';
import { usePlayerSync } from '@/hooks/usePlayerSync';

/** Standalone character settings use the sheet's canonical load/save path. */
export function useCharacterSettings(characterId: string) {
  const hydrated = useHydration();
  const playerCharacter = usePlayerStore(state =>
    state.characters.find(character => character.id === characterId)
  );
  useEffect(() => {
    if (
      hydrated &&
      playerCharacter?.id === characterId &&
      usePlayerStore.getState().activeCharacterId !== characterId
    ) {
      usePlayerStore.getState().setActiveCharacter(characterId);
    }
  }, [hydrated, playerCharacter?.id, characterId]);
  const updateCharacterData = usePlayerStore(
    state => state.updateCharacterData
  );
  const state = useCharacterStore();
  const { character, loadCharacterState } = state;
  const { isInitialLoad } = useCharacterRosterSync({
    playerCharacter,
    hasHydrated: hydrated,
    characterId,
    character,
    loadCharacterState,
    updateCharacterData,
  });
  const { syncEnabled, autoSync, syncNow } = usePlayerSync({ characterId });
  const afterSave = useCallback(() => {
    if (character.id === characterId && syncEnabled && autoSync)
      void syncNow(character);
  }, [character, characterId, syncEnabled, autoSync, syncNow]);
  useAutoSave({
    enabled: hydrated && !isInitialLoad && character.id === characterId,
    onAfterSave: afterSave,
  });
  return {
    ...state,
    loading:
      !hydrated ||
      Boolean(
        playerCharacter && (isInitialLoad || character.id !== characterId)
      ),
    missing: !playerCharacter,
  };
}
