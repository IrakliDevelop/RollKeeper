import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '@/store/playerStore';

function resetStore() {
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: { enableDeathAnimation: false, enableLevelUpAnimation: false },
    lastSelectedCharacterId: null,
  });
}

describe('playerStore', () => {
  beforeEach(resetStore);

  describe('createCharacter', () => {
    it('creates a character and returns its ID', () => {
      const id = usePlayerStore.getState().createCharacter('Test Hero');
      expect(id).toBeTruthy();
      expect(usePlayerStore.getState().characters).toHaveLength(1);
      expect(usePlayerStore.getState().characters[0].name).toBe('Test Hero');
    });

    it('sets timestamps on creation', () => {
      usePlayerStore.getState().createCharacter('New Hero');
      const char = usePlayerStore.getState().characters[0];
      expect(char.createdAt).toBeTruthy();
      expect(char.updatedAt).toBeTruthy();
    });

    it('creates character with custom data', () => {
      usePlayerStore.getState().createCharacter('Wizard', {
        class: {
          name: 'Wizard',
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
      });
      const char = usePlayerStore.getState().characters[0];
      expect(char.characterData.class.name).toBe('Wizard');
    });

    it('sets the new character as active', () => {
      const id = usePlayerStore.getState().createCharacter('Active Hero');
      expect(usePlayerStore.getState().activeCharacterId).toBe(id);
    });

    it('sets lastSelectedCharacterId to the new character', () => {
      const id = usePlayerStore.getState().createCharacter('New Hero');
      expect(usePlayerStore.getState().lastSelectedCharacterId).toBe(id);
    });
  });

  describe('deleteCharacter', () => {
    it('removes the character', () => {
      const id = usePlayerStore.getState().createCharacter('ToDelete');
      usePlayerStore.getState().deleteCharacter(id);
      expect(usePlayerStore.getState().characters).toHaveLength(0);
    });

    it('clears activeCharacterId if deleted', () => {
      const id = usePlayerStore.getState().createCharacter('Active');
      usePlayerStore.getState().setActiveCharacter(id);
      usePlayerStore.getState().deleteCharacter(id);
      expect(usePlayerStore.getState().activeCharacterId).toBeNull();
    });

    it('preserves activeCharacterId when deleting a different character', () => {
      const id1 = usePlayerStore.getState().createCharacter('Hero1');
      const id2 = usePlayerStore.getState().createCharacter('Hero2');
      usePlayerStore.getState().setActiveCharacter(id1);
      usePlayerStore.getState().deleteCharacter(id2);
      expect(usePlayerStore.getState().activeCharacterId).toBe(id1);
    });

    it('is a no-op for unknown ID', () => {
      usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().deleteCharacter('non-existent-id');
      expect(usePlayerStore.getState().characters).toHaveLength(1);
    });
  });

  describe('archiveCharacter / restoreCharacter', () => {
    it('archives a character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().archiveCharacter(id);
      expect(usePlayerStore.getState().getArchivedCharacters()).toHaveLength(1);
      expect(usePlayerStore.getState().getActiveCharacters()).toHaveLength(0);
    });

    it('clears activeCharacterId when archiving the active character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().setActiveCharacter(id);
      usePlayerStore.getState().archiveCharacter(id);
      expect(usePlayerStore.getState().activeCharacterId).toBeNull();
    });

    it('restores an archived character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().archiveCharacter(id);
      usePlayerStore.getState().restoreCharacter(id);
      expect(usePlayerStore.getState().getArchivedCharacters()).toHaveLength(0);
      expect(usePlayerStore.getState().getActiveCharacters()).toHaveLength(1);
    });

    it('does not clear activeCharacterId when archiving a different character', () => {
      const id1 = usePlayerStore.getState().createCharacter('Active');
      const id2 = usePlayerStore.getState().createCharacter('ToArchive');
      usePlayerStore.getState().setActiveCharacter(id1);
      usePlayerStore.getState().archiveCharacter(id2);
      expect(usePlayerStore.getState().activeCharacterId).toBe(id1);
    });
  });

  describe('duplicateCharacter', () => {
    it('creates a copy with a new name and ID', () => {
      const id = usePlayerStore.getState().createCharacter('Original');
      const newId = usePlayerStore.getState().duplicateCharacter(id, 'Clone');
      expect(newId).not.toBe(id);
      expect(usePlayerStore.getState().characters).toHaveLength(2);
      expect(usePlayerStore.getState().getCharacterById(newId)?.name).toBe(
        'Clone'
      );
    });

    it('adds the duplicate tag to the copy', () => {
      const id = usePlayerStore.getState().createCharacter('Original');
      const newId = usePlayerStore.getState().duplicateCharacter(id, 'Clone');
      expect(usePlayerStore.getState().getCharacterById(newId)?.tags).toContain(
        'duplicate'
      );
    });

    it('returns empty string for unknown ID', () => {
      const result = usePlayerStore
        .getState()
        .duplicateCharacter('non-existent', 'Clone');
      expect(result).toBe('');
    });
  });

  describe('setActiveCharacter', () => {
    it('sets the active character ID', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().setActiveCharacter(id);
      expect(usePlayerStore.getState().activeCharacterId).toBe(id);
    });

    it('can clear active character', () => {
      usePlayerStore.getState().setActiveCharacter(null);
      expect(usePlayerStore.getState().activeCharacterId).toBeNull();
    });

    it('updates lastSelectedCharacterId when setting to a valid ID', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().setActiveCharacter(null);
      usePlayerStore.getState().setActiveCharacter(id);
      expect(usePlayerStore.getState().lastSelectedCharacterId).toBe(id);
    });
  });

  describe('getActiveCharacter', () => {
    it('returns null when no active character', () => {
      expect(usePlayerStore.getState().getActiveCharacter()).toBeNull();
    });

    it('returns the active character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().setActiveCharacter(id);
      expect(usePlayerStore.getState().getActiveCharacter()?.id).toBe(id);
    });

    it('returns null when activeCharacterId is set but character does not exist', () => {
      usePlayerStore.setState({ activeCharacterId: 'ghost-id' });
      expect(usePlayerStore.getState().getActiveCharacter()).toBeNull();
    });
  });

  describe('getCharacterById', () => {
    it('returns the matching character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      const char = usePlayerStore.getState().getCharacterById(id);
      expect(char).not.toBeNull();
      expect(char?.name).toBe('Hero');
    });

    it('returns null for unknown ID', () => {
      expect(usePlayerStore.getState().getCharacterById('unknown')).toBeNull();
    });
  });

  describe('getActiveCharacters', () => {
    it('returns only non-archived characters', () => {
      const id1 = usePlayerStore.getState().createCharacter('Active1');
      const id2 = usePlayerStore.getState().createCharacter('Active2');
      usePlayerStore.getState().archiveCharacter(id1);
      const active = usePlayerStore.getState().getActiveCharacters();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(id2);
    });

    it('returns all characters when none are archived', () => {
      usePlayerStore.getState().createCharacter('Hero1');
      usePlayerStore.getState().createCharacter('Hero2');
      expect(usePlayerStore.getState().getActiveCharacters()).toHaveLength(2);
    });
  });

  describe('getArchivedCharacters', () => {
    it('returns empty when no archived characters', () => {
      usePlayerStore.getState().createCharacter('Hero');
      expect(usePlayerStore.getState().getArchivedCharacters()).toHaveLength(0);
    });

    it('returns only archived characters', () => {
      const id1 = usePlayerStore.getState().createCharacter('Hero1');
      usePlayerStore.getState().createCharacter('Hero2');
      usePlayerStore.getState().archiveCharacter(id1);
      const archived = usePlayerStore.getState().getArchivedCharacters();
      expect(archived).toHaveLength(1);
      expect(archived[0].id).toBe(id1);
    });
  });

  describe('updateCharacter', () => {
    it('updates top-level fields on a character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().updateCharacter(id, { name: 'Updated Hero' });
      expect(usePlayerStore.getState().getCharacterById(id)?.name).toBe(
        'Updated Hero'
      );
    });

    it('updates updatedAt timestamp to a recent date', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      const timeBefore = Date.now();
      usePlayerStore.getState().updateCharacter(id, { name: 'Updated' });
      const updatedAt = usePlayerStore
        .getState()
        .getCharacterById(id)!.updatedAt;
      expect(new Date(updatedAt).getTime()).toBeGreaterThanOrEqual(timeBefore);
    });

    it('is a no-op for unknown ID', () => {
      usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().updateCharacter('unknown', { name: 'Phantom' });
      expect(usePlayerStore.getState().characters[0].name).toBe('Hero');
    });
  });

  describe('updateCharacterData', () => {
    it('replaces the characterData on a character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      const original = usePlayerStore
        .getState()
        .getCharacterById(id)!.characterData;
      const updated = { ...original, name: 'Renamed Hero' };
      usePlayerStore.getState().updateCharacterData(id, updated);
      expect(
        usePlayerStore.getState().getCharacterById(id)?.characterData.name
      ).toBe('Renamed Hero');
    });

    it('syncs the top-level name from characterData', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      const original = usePlayerStore
        .getState()
        .getCharacterById(id)!.characterData;
      usePlayerStore
        .getState()
        .updateCharacterData(id, { ...original, name: 'Synced' });
      expect(usePlayerStore.getState().getCharacterById(id)?.name).toBe(
        'Synced'
      );
    });
  });

  describe('exportCharacter', () => {
    it('returns the full PlayerCharacter', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      const exported = usePlayerStore.getState().exportCharacter(id);
      expect(exported).not.toBeNull();
      expect(exported?.id).toBe(id);
      expect(exported?.name).toBe('Hero');
    });

    it('returns null for unknown ID', () => {
      expect(usePlayerStore.getState().exportCharacter('unknown')).toBeNull();
    });
  });

  describe('importCharacter', () => {
    it('imports a raw CharacterState', () => {
      const id = usePlayerStore.getState().createCharacter('Original');
      const charState = usePlayerStore
        .getState()
        .getCharacterById(id)!.characterData;
      usePlayerStore.getState().deleteCharacter(id);

      const importedId = usePlayerStore
        .getState()
        .importCharacter(charState, 'Imported');
      expect(usePlayerStore.getState().characters).toHaveLength(1);
      expect(usePlayerStore.getState().getCharacterById(importedId)?.name).toBe(
        'Imported'
      );
    });

    it('adds the imported tag to the imported character', () => {
      const id = usePlayerStore.getState().createCharacter('Original');
      const charState = usePlayerStore
        .getState()
        .getCharacterById(id)!.characterData;
      const importedId = usePlayerStore.getState().importCharacter(charState);
      expect(
        usePlayerStore.getState().getCharacterById(importedId)?.tags
      ).toContain('imported');
    });

    it('imports a PlayerCharacter export format', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      const playerChar = usePlayerStore.getState().exportCharacter(id)!;
      // Cast to CharacterExport-compatible to trigger the characterData branch
      const asExport = playerChar as unknown as Parameters<
        typeof usePlayerStore.getState.importCharacter
      >[0];
      const importedId = usePlayerStore
        .getState()
        .importCharacter(
          asExport as Parameters<
            ReturnType<typeof usePlayerStore.getState>['importCharacter']
          >[0],
          'Re-imported'
        );
      expect(usePlayerStore.getState().getCharacterById(importedId)?.name).toBe(
        'Re-imported'
      );
    });
  });

  describe('updateSettings', () => {
    it('merges settings', () => {
      usePlayerStore.getState().updateSettings({ enableDeathAnimation: true });
      expect(usePlayerStore.getState().settings.enableDeathAnimation).toBe(
        true
      );
      expect(usePlayerStore.getState().settings.enableLevelUpAnimation).toBe(
        false
      );
    });

    it('can enable both settings independently', () => {
      usePlayerStore.getState().updateSettings({ enableDeathAnimation: true });
      usePlayerStore
        .getState()
        .updateSettings({ enableLevelUpAnimation: true });
      expect(usePlayerStore.getState().settings.enableDeathAnimation).toBe(
        true
      );
      expect(usePlayerStore.getState().settings.enableLevelUpAnimation).toBe(
        true
      );
    });
  });

  describe('resetSettings', () => {
    it('resets to defaults', () => {
      usePlayerStore.getState().updateSettings({ enableDeathAnimation: true });
      usePlayerStore.getState().resetSettings();
      expect(usePlayerStore.getState().settings.enableDeathAnimation).toBe(
        false
      );
    });

    it('resets all settings fields', () => {
      usePlayerStore
        .getState()
        .updateSettings({
          enableDeathAnimation: true,
          enableLevelUpAnimation: true,
        });
      usePlayerStore.getState().resetSettings();
      expect(usePlayerStore.getState().settings).toEqual({
        enableDeathAnimation: false,
        enableLevelUpAnimation: false,
      });
    });
  });

  describe('resetStore', () => {
    it('clears all characters and resets to initial state', () => {
      usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().updateSettings({ enableDeathAnimation: true });
      usePlayerStore.getState().resetStore();

      const state = usePlayerStore.getState();
      expect(state.characters).toHaveLength(0);
      expect(state.activeCharacterId).toBeNull();
      expect(state.lastSelectedCharacterId).toBeNull();
      expect(state.settings).toEqual({
        enableDeathAnimation: false,
        enableLevelUpAnimation: false,
      });
    });
  });
});
