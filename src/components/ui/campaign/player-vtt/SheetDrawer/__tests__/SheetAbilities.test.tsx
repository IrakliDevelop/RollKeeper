import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  render,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SheetAbilities } from '../SheetAbilities';
import { SWAP_ANIMATION } from '@/components/ui/game/abilityNumbers';
import { setPref } from '@/hooks/useUiPrefs';
import { useCharacterStore } from '@/store/characterStore';
import {
  calculateSavingThrowModifier,
  formatModifier,
} from '@/utils/calculations';
import type { CharacterState } from '@/types/character';

beforeEach(() => {
  localStorage.clear();
  // The score editor asks for (min-width: 640px); jsdom has no matchMedia.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
  const base = useCharacterStore.getState().character;
  useCharacterStore.getState().loadCharacterState({
    ...base,
    abilities: { ...base.abilities, strength: 12 },
    // A proficient save, so the save bonus differs from the modifier.
    savingThrows: { ...base.savingThrows, strength: { proficient: true } },
  } as CharacterState);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function strengthSave() {
  return calculateSavingThrowModifier(
    useCharacterStore.getState().character,
    'strength'
  );
}

describe('SheetAbilities', () => {
  it('rolls checks and saves', () => {
    const roll = vi.fn().mockResolvedValue(undefined);
    render(<SheetAbilities locked roll={roll} />);
    fireEvent.click(
      screen.getByRole('button', { name: /roll strength check/i })
    );
    expect(strengthSave()).not.toBe(1);
    fireEvent.click(
      screen.getByRole('button', {
        name: `Roll Strength Save ${formatModifier(strengthSave())}, proficient`,
      })
    );
    expect(roll).toHaveBeenNthCalledWith(1, 'Strength Check', 1);
    expect(roll).toHaveBeenNthCalledWith(2, 'Strength Save', strengthSave());
  });

  it('shows plain ability cells when roll is not provided', () => {
    render(<SheetAbilities locked />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(
      screen.getByRole('img', { name: 'Strength: modifier +1, score 12' })
    ).toBeInTheDocument();
    const save = formatModifier(strengthSave());
    expect(
      screen.getByRole('img', {
        name: `Strength saving throw ${save}, proficient`,
      })
    ).toHaveTextContent(`Save ${save}`);
    expect(screen.getByText('Strength')).toBeInTheDocument();
  });

  it('opens the score editor only when unlocked and writes through updateAbilityScore', async () => {
    const { rerender } = render(<SheetAbilities locked />);
    expect(
      screen.queryByRole('button', { name: /^Strength: modifier/ })
    ).toBeNull();
    rerender(<SheetAbilities locked={false} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Strength: modifier +1, score 12' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase Strength score' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase Strength score' })
    );
    await act(() =>
      userEvent.click(screen.getByRole('button', { name: 'Save' }))
    );
    expect(useCharacterStore.getState().character.abilities.strength).toBe(14);
  });

  it('drops the rolls while unlocked', () => {
    render(<SheetAbilities locked={false} roll={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^roll/i })).toBeNull();
  });

  it('follows this device’s "Scores large" setting', () => {
    localStorage.setItem(
      'rollkeeper-ui-prefs',
      JSON.stringify({ abilityDisplay: 'score' })
    );
    const { container } = render(<SheetAbilities locked />);
    expect(container.querySelector('[data-ledger-row]')).toHaveAttribute(
      'data-display',
      'score'
    );
  });

  it('snaps when the "Scores large" setting changes', () => {
    const { container } = render(<SheetAbilities locked />);
    act(() => setPref('abilityDisplay', 'score'));
    expect(container.querySelector('[data-ledger-row]')).toHaveAttribute(
      'data-display',
      'score'
    );
    expect(
      container.querySelector('[data-number="large"]')!.className
    ).not.toContain(SWAP_ANIMATION);
  });
});
