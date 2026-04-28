import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function resetStore(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: { enableDeathAnimation: false, enableLevelUpAnimation: false },
    lastSelectedCharacterId: null,
  });
}

describe('characterStore — persistence actions', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('saveCharacter', () => {
    it('sets saveStatus to "saved"', () => {
      useCharacterStore.setState({
        saveStatus: 'saving',
        hasUnsavedChanges: true,
      });
      useCharacterStore.getState().saveCharacter();
      expect(useCharacterStore.getState().saveStatus).toBe('saved');
    });

    it('sets hasUnsavedChanges to false', () => {
      useCharacterStore.setState({ hasUnsavedChanges: true });
      useCharacterStore.getState().saveCharacter();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(false);
    });

    it('updates lastSaved to a recent date', () => {
      const before = Date.now();
      useCharacterStore.getState().saveCharacter();
      const { lastSaved } = useCharacterStore.getState();
      expect(lastSaved).not.toBeNull();
      const savedTime = new Date(lastSaved as Date | string).getTime();
      expect(savedTime).toBeGreaterThanOrEqual(before);
      expect(savedTime).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('loadCharacter', () => {
    it('replaces the character in state', () => {
      const newChar = makeCharacter({ name: 'Loaded Hero', id: 'loaded-1' });
      useCharacterStore.getState().loadCharacter(newChar);
      expect(useCharacterStore.getState().character.name).toBe('Loaded Hero');
      expect(useCharacterStore.getState().character.id).toBe('loaded-1');
    });

    it('resets save state after loading', () => {
      useCharacterStore.setState({
        hasUnsavedChanges: true,
        saveStatus: 'error',
      });
      const newChar = makeCharacter({ name: 'New Char' });
      useCharacterStore.getState().loadCharacter(newChar);
      expect(useCharacterStore.getState().saveStatus).toBe('saved');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(false);
    });

    it('updates lastSaved', () => {
      const before = Date.now();
      useCharacterStore.getState().loadCharacter(makeCharacter());
      const { lastSaved } = useCharacterStore.getState();
      expect(lastSaved).not.toBeNull();
      expect(
        new Date(lastSaved as Date | string).getTime()
      ).toBeGreaterThanOrEqual(before);
    });
  });

  describe('resetCharacter', () => {
    it('generates a new unique ID', () => {
      const oldId = useCharacterStore.getState().character.id;
      useCharacterStore.getState().resetCharacter();
      const newId = useCharacterStore.getState().character.id;
      expect(newId).not.toBe(oldId);
    });

    it('resets character to default state values', () => {
      useCharacterStore.setState({
        character: makeCharacter({ name: 'Veteran', level: 20 }),
      });
      useCharacterStore.getState().resetCharacter();
      const { character } = useCharacterStore.getState();
      expect(character.name).toBe('');
      expect(character.level).toBe(1);
    });

    it('sets saveStatus to "saved" and clears unsaved flag', () => {
      useCharacterStore.setState({
        hasUnsavedChanges: true,
        saveStatus: 'saving',
      });
      useCharacterStore.getState().resetCharacter();
      expect(useCharacterStore.getState().saveStatus).toBe('saved');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(false);
    });

    it('updates lastSaved after reset', () => {
      const before = Date.now();
      useCharacterStore.getState().resetCharacter();
      const { lastSaved } = useCharacterStore.getState();
      expect(lastSaved).not.toBeNull();
      expect(
        new Date(lastSaved as Date | string).getTime()
      ).toBeGreaterThanOrEqual(before);
    });
  });

  describe('exportCharacter', () => {
    it('returns an object with version and character', () => {
      const exported = useCharacterStore.getState().exportCharacter();
      expect(exported).toHaveProperty('version');
      expect(exported).toHaveProperty('character');
    });

    it('exported character matches current character state', () => {
      const char = makeCharacter({ name: 'Export Hero', id: 'export-1' });
      useCharacterStore.setState({ character: char });
      const exported = useCharacterStore.getState().exportCharacter();
      expect(exported.character.name).toBe('Export Hero');
      expect(exported.character.id).toBe('export-1');
    });

    it('includes exportDate as an ISO string', () => {
      const exported = useCharacterStore.getState().exportCharacter();
      expect(exported).toHaveProperty('exportDate');
      expect(() => new Date(exported.exportDate)).not.toThrow();
      expect(new Date(exported.exportDate).toISOString()).toBe(
        exported.exportDate
      );
    });

    it('version is a non-empty string', () => {
      const exported = useCharacterStore.getState().exportCharacter();
      expect(typeof exported.version).toBe('string');
      expect(exported.version.length).toBeGreaterThan(0);
    });
  });

  describe('importCharacter', () => {
    it('returns true on success', () => {
      const exported = useCharacterStore.getState().exportCharacter();
      const result = useCharacterStore.getState().importCharacter(exported);
      expect(result).toBe(true);
    });

    it('loads the imported character into state', () => {
      const char = makeCharacter({ name: 'Imported Hero', id: 'import-1' });
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        character: char,
      };
      useCharacterStore.getState().importCharacter(exportData);
      expect(useCharacterStore.getState().character.name).toBe('Imported Hero');
      expect(useCharacterStore.getState().character.id).toBe('import-1');
    });

    it('sets saveStatus to "saved" and clears unsaved flag after import', () => {
      useCharacterStore.setState({
        hasUnsavedChanges: true,
        saveStatus: 'saving',
      });
      const exported = useCharacterStore.getState().exportCharacter();
      useCharacterStore.getState().importCharacter(exported);
      expect(useCharacterStore.getState().saveStatus).toBe('saved');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(false);
    });

    it('returns false and sets error status when character data is invalid', () => {
      const invalidExport = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        character:
          null as unknown as import('@/types/character').CharacterState,
      };
      const result = useCharacterStore
        .getState()
        .importCharacter(invalidExport);
      expect(result).toBe(false);
      expect(useCharacterStore.getState().saveStatus).toBe('error');
    });

    it('accepts a raw CharacterState wrapped in CharacterExport', () => {
      const char = makeCharacter({ name: 'Raw Import', level: 10 });
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        character: char,
      };
      const result = useCharacterStore.getState().importCharacter(exportData);
      expect(result).toBe(true);
      expect(useCharacterStore.getState().character.level).toBe(10);
    });
  });

  describe('loadCharacterState (migration)', () => {
    it('loads and migrates a character', () => {
      const char = makeCharacter({ name: 'Migrated Hero' });
      useCharacterStore.getState().loadCharacterState(char);
      expect(useCharacterStore.getState().character.name).toBe('Migrated Hero');
    });

    it('migrates weapon damage from object format to array format', () => {
      const oldCharacter = {
        ...makeCharacter(),
        weapons: [
          {
            id: 'w1',
            name: 'Sword',
            damage: { dice: '1d8', type: 'slashing' }, // OLD format (object, not array)
            category: 'martial',
            weaponType: ['melee'],
            enhancementBonus: 0,
            isEquipped: true,
            properties: [],
            createdAt: '',
            updatedAt: '',
          },
        ],
      } as unknown as import('@/types/character').CharacterState;

      // migrateCharacterData is called inside loadCharacterState
      // but only runs weapon migration for old-format characters (string class).
      // For characters that already have object class, weapons are preserved as-is.
      // To test weapon migration, use a character with string class (legacy format).
      const legacyCharacter = {
        ...makeCharacter(),
        class: 'Fighter', // legacy string class triggers full migration
        weapons: [
          {
            id: 'w1',
            name: 'Sword',
            damage: { dice: '1d8', type: 'slashing' },
            category: 'martial',
            weaponType: ['melee'],
            enhancementBonus: 0,
            isEquipped: true,
            properties: [],
            createdAt: '',
            updatedAt: '',
          },
        ],
      } as unknown as import('@/types/character').CharacterState;

      useCharacterStore.getState().loadCharacterState(legacyCharacter);
      const { character } = useCharacterStore.getState();
      expect(Array.isArray(character.weapons[0].damage)).toBe(true);
      expect(character.weapons[0].damage[0]).toMatchObject({
        dice: '1d8',
        type: 'slashing',
      });
    });

    it('resets save state to saved after loading', () => {
      useCharacterStore.setState({
        hasUnsavedChanges: true,
        saveStatus: 'error',
      });
      useCharacterStore.getState().loadCharacterState(makeCharacter());
      expect(useCharacterStore.getState().saveStatus).toBe('saved');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(false);
    });

    it('fills in missing spellSlots for legacy characters', () => {
      const legacyCharacter = {
        ...makeCharacter(),
        class: 'Wizard', // triggers string-class migration
        // spellSlots intentionally omitted — migration should supply defaults
      } as unknown as import('@/types/character').CharacterState;
      // Remove spellSlots from the object
      delete (legacyCharacter as Record<string, unknown>).spellSlots;

      useCharacterStore.getState().loadCharacterState(legacyCharacter);
      const { character } = useCharacterStore.getState();
      expect(character.spellSlots).toBeDefined();
    });

    it('handles null/undefined character gracefully by returning default state', () => {
      // loadCharacterState calls migrateCharacterData which handles invalid input
      useCharacterStore
        .getState()
        .loadCharacterState(
          null as unknown as import('@/types/character').CharacterState
        );
      const { character } = useCharacterStore.getState();
      expect(character).toBeDefined();
      expect(character.id).toBeTruthy();
    });
  });

  describe('markSaved', () => {
    it('sets saveStatus to "saved"', () => {
      useCharacterStore.setState({ saveStatus: 'saving' });
      useCharacterStore.getState().markSaved();
      expect(useCharacterStore.getState().saveStatus).toBe('saved');
    });

    it('sets hasUnsavedChanges to false', () => {
      useCharacterStore.setState({ hasUnsavedChanges: true });
      useCharacterStore.getState().markSaved();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(false);
    });

    it('updates lastSaved', () => {
      const before = Date.now();
      useCharacterStore.getState().markSaved();
      const { lastSaved } = useCharacterStore.getState();
      expect(lastSaved).not.toBeNull();
      expect(
        new Date(lastSaved as Date | string).getTime()
      ).toBeGreaterThanOrEqual(before);
    });
  });

  describe('markUnsaved', () => {
    it('sets hasUnsavedChanges to true', () => {
      useCharacterStore.setState({ hasUnsavedChanges: false });
      useCharacterStore.getState().markUnsaved();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('sets saveStatus to "saving"', () => {
      useCharacterStore.setState({ saveStatus: 'saved' });
      useCharacterStore.getState().markUnsaved();
      expect(useCharacterStore.getState().saveStatus).toBe('saving');
    });
  });

  describe('setSaveStatus', () => {
    it('sets the save status to the given value', () => {
      useCharacterStore.getState().setSaveStatus('error');
      expect(useCharacterStore.getState().saveStatus).toBe('error');
    });

    it('can set status to "saving"', () => {
      useCharacterStore.getState().setSaveStatus('saving');
      expect(useCharacterStore.getState().saveStatus).toBe('saving');
    });

    it('can set status back to "saved"', () => {
      useCharacterStore.setState({ saveStatus: 'error' });
      useCharacterStore.getState().setSaveStatus('saved');
      expect(useCharacterStore.getState().saveStatus).toBe('saved');
    });
  });
});
