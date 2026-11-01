import { beforeEach, expect, it } from 'vitest';
import { useCharacterStore } from '../characterStore';
import { usePlayerStore } from '../playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import { parseThemePreference } from '@/utils/themePreference';
import type { CharacterExport } from '@/types/character';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('rollkeeper-theme', 'light');
  useCharacterStore
    .getState()
    .loadCharacterState(makeCharacter({ id: 'appearance-hero', revision: 10 }));
  usePlayerStore.setState({ characters: [] });
});

it.each(['light', 'dark', 'blue', 'system'] as const)(
  'saves %s in character JSON and retains it through roster import and reload',
  themePreference => {
    useCharacterStore.getState().updateCharacter({ themePreference });
    expect(useCharacterStore.getState().character.revision).toBe(11);
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    useCharacterStore.getState().saveCharacter();
    const exported: CharacterExport = JSON.parse(
      JSON.stringify(useCharacterStore.getState().exportCharacter())
    );
    expect(exported.character.themePreference).toBe(themePreference);
    const id = usePlayerStore.getState().importCharacter(exported);
    const imported = usePlayerStore
      .getState()
      .characters.find(character => character.id === id)!;
    expect(imported.characterData.themePreference).toBe(themePreference);
    useCharacterStore.getState().loadCharacterState(imported.characterData);
    expect(useCharacterStore.getState().character.themePreference).toBe(
      themePreference
    );
    expect(localStorage.getItem('rollkeeper-theme')).toBe('light');
  }
);

it('removes the override from exported JSON when following the app', () => {
  useCharacterStore.getState().updateCharacter({ themePreference: 'blue' });
  useCharacterStore.getState().updateCharacter({ themePreference: undefined });
  const exported = JSON.parse(
    JSON.stringify(useCharacterStore.getState().exportCharacter())
  );
  expect(exported.character).not.toHaveProperty('themePreference');
  expect(useCharacterStore.getState().character.revision).toBe(12);
  expect(
    parseThemePreference(exported.character.themePreference)
  ).toBeUndefined();
  expect(localStorage.getItem('rollkeeper-theme')).toBe('light');
});
