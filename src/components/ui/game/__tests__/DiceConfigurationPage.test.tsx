import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiceConfigurationPage } from '../dice-settings/DiceConfigurationPage';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import { DEFAULT_DICE_SET } from '@/utils/diceSet';
import type { CharacterDiceSet } from '@/types/dice';
import type { ReactNode } from 'react';

vi.mock('@/hooks/useHydration', () => ({ useHydration: () => true }));
vi.mock('@/hooks/usePlayerSync', () => ({
  usePlayerSync: () => ({
    autoSync: false,
    syncEnabled: false,
    syncNow: vi.fn(),
  }),
}));
vi.mock('@/components/ui/layout/AppHeader', () => ({
  AppHeader: ({
    title,
    leading,
    actions,
  }: {
    title: ReactNode;
    leading: ReactNode;
    actions: ReactNode;
  }) => (
    <header>
      {title}
      {leading}
      {actions}
    </header>
  ),
}));
vi.mock('../DiceSetEditor', () => ({
  DiceSetEditor: ({
    value,
    onChange,
  }: {
    value: CharacterDiceSet;
    onChange: (value: CharacterDiceSet) => void;
  }) => (
    <>
      <output data-testid="current-dice">{JSON.stringify(value)}</output>
      <button
        onClick={() =>
          onChange({ ...value, dieScale: 1.8, options: { sound: 0.4 } })
        }
      >
        Change dice
      </button>
    </>
  ),
}));

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function roster(id: string, name: string) {
  return {
    id,
    name,
    race: 'Human',
    class: 'Wizard',
    level: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastPlayed: new Date(),
    tags: [],
    isArchived: false,
    characterData: makeCharacter({ id, name }),
  };
}
describe('dedicated character dice settings', () => {
  it('loads the requested character, saves only its dice, and keeps them after reopening', async () => {
    const first = roster('dice-a', 'Mira');
    const second = roster('dice-b', 'Orin');
    usePlayerStore.setState({
      characters: [first, second],
      activeCharacterId: 'dice-b',
    });
    useCharacterStore.setState({
      character: second.characterData,
      hasUnsavedChanges: false,
      hasHydrated: true,
    });
    const view = render(<DiceConfigurationPage characterId="dice-a" />);
    await screen.findByRole('button', { name: 'Change dice' });
    expect(useCharacterStore.getState().character.id).toBe('dice-a');
    expect(usePlayerStore.getState().activeCharacterId).toBe('dice-a');
    fireEvent.click(screen.getByRole('button', { name: 'Change dice' }));
    await waitFor(() =>
      expect(
        usePlayerStore.getState().getCharacterById('dice-a')?.characterData
          .diceSet?.dieScale
      ).toBe(1.8)
    );
    expect(
      usePlayerStore.getState().getCharacterById('dice-b')?.characterData
    ).toEqual(second.characterData);
    expect(useCharacterStore.getState().character.hitPoints).toEqual(
      first.characterData.hitPoints
    );
    view.unmount();
    useCharacterStore.setState({
      character: second.characterData,
      hasUnsavedChanges: false,
    });
    render(<DiceConfigurationPage characterId="dice-a" />);
    await screen.findByRole('button', { name: 'Change dice' });
    expect(
      JSON.parse(screen.getByTestId('current-dice').textContent ?? '{}')
    ).toEqual({ ...DEFAULT_DICE_SET, dieScale: 1.8, options: { sound: 0.4 } });
  });
  it('does not edit the loaded character when the requested character is absent', () => {
    const existing = roster('dice-existing', 'Mira');
    usePlayerStore.setState({
      characters: [existing],
      activeCharacterId: existing.id,
    });
    useCharacterStore.setState({
      character: existing.characterData,
      hasHydrated: true,
      hasUnsavedChanges: false,
    });
    render(<DiceConfigurationPage characterId="missing" />);
    expect(
      screen.getByRole('heading', {
        name: 'Character not found on this device',
      })
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Change dice' })
    ).not.toBeInTheDocument();
    expect(useCharacterStore.getState().character).toEqual(
      existing.characterData
    );
  });
});
