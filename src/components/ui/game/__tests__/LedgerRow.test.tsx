import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LedgerRow, saveLineLabel, type LedgerCell } from '../LedgerRow';

beforeEach(() => {
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const CELLS: LedgerCell[] = [
  {
    ability: 'strength',
    score: 16,
    modifier: 3,
    save: 5,
    saveProficient: true,
  },
  {
    ability: 'dexterity',
    score: 14,
    modifier: 2,
    save: 2,
    saveProficient: false,
  },
  {
    ability: 'constitution',
    score: 15,
    modifier: 2,
    save: 4,
    saveProficient: true,
  },
  {
    ability: 'intelligence',
    score: 8,
    modifier: -1,
    save: -1,
    saveProficient: false,
  },
  { ability: 'wisdom', score: 12, modifier: 1, save: 1, saveProficient: false },
  {
    ability: 'charisma',
    score: 10,
    modifier: 0,
    save: 0,
    saveProficient: false,
  },
];

describe('saveLineLabel', () => {
  it('names the saving throw and says when it is proficient', () => {
    expect(saveLineLabel('strength', 5, true)).toBe(
      'Strength saving throw +5, proficient'
    );
    expect(saveLineLabel('intelligence', -1, false)).toBe(
      'Intelligence saving throw -1'
    );
  });
});

describe('LedgerRow', () => {
  it('shows six cells as plain text when rolls are off', () => {
    const { container } = render(
      <LedgerRow cells={CELLS} abilityDisplay="modifier" />
    );
    expect(container.querySelectorAll('[data-ledger-cell]')).toHaveLength(6);
    const strength = container.querySelector<HTMLElement>(
      '[data-ledger-cell="strength"]'
    )!;
    expect(within(strength).getByText('Strength')).toBeInTheDocument();
    expect(
      within(strength).getByRole('img', {
        name: 'Strength: modifier +3, score 16',
      })
    ).toBeInTheDocument();
    expect(
      within(strength).getByRole('img', {
        name: 'Strength saving throw +5, proficient',
      })
    ).toHaveTextContent('Save +5');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('puts the chosen number first', () => {
    const { container } = render(
      <LedgerRow cells={CELLS} abilityDisplay="score" />
    );
    const strength = container.querySelector('[data-ledger-cell="strength"]')!;
    expect(strength.querySelector('[data-number="large"]')).toHaveTextContent(
      '16'
    );
    expect(strength.querySelector('[data-number="small"]')).toHaveTextContent(
      '+3'
    );
  });

  it('marks the save dot by proficiency without announcing it twice', () => {
    const { container } = render(
      <LedgerRow cells={CELLS} abilityDisplay="modifier" />
    );
    const dot = (ability: string) =>
      container.querySelector(`[data-ledger-cell="${ability}"] [data-level]`)!;
    expect(dot('strength')).toHaveAttribute('data-level', 'proficient');
    expect(dot('dexterity')).toHaveAttribute('data-level', 'none');
    expect(dot('strength')).toHaveAttribute('aria-hidden', 'true');
  });

  it('rolls a check and a save when the caller allows rolls', async () => {
    const onRollCheck = vi.fn();
    const onRollSave = vi.fn();
    render(
      <LedgerRow
        cells={CELLS}
        abilityDisplay="modifier"
        onRollCheck={onRollCheck}
        onRollSave={onRollSave}
      />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Roll Wisdom check' })
    );
    expect(onRollCheck).toHaveBeenCalledWith('wisdom');
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Roll Constitution Save +4, proficient',
      })
    );
    expect(onRollSave).toHaveBeenCalledWith('constitution');
  });

  it('names a save roll by what it shows', () => {
    render(
      <LedgerRow
        cells={CELLS}
        abilityDisplay="modifier"
        onRollCheck={vi.fn()}
        onRollSave={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Roll Dexterity Save +2' })
    ).toHaveTextContent('Save +2');
  });

  it('turns rolls off while editing and opens the score editor', async () => {
    const onScoreChange = vi.fn();
    render(
      <LedgerRow
        cells={CELLS}
        abilityDisplay="modifier"
        editing
        onScoreChange={onScoreChange}
        onRollCheck={vi.fn()}
        onRollSave={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /^Roll/ })).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Charisma: modifier +0, score 10' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Decrease Charisma score' })
    );
    expect(screen.getByText('Modifier -1')).toBeInTheDocument();
    await act(() =>
      userEvent.click(screen.getByRole('button', { name: 'Save' }))
    );
    expect(onScoreChange).toHaveBeenCalledWith('charisma', 9);
  });

  it('stays plain in edit mode when nothing can save a score', () => {
    render(<LedgerRow cells={CELLS} abilityDisplay="modifier" editing />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('animates only a change made here', () => {
    const { container, rerender } = render(
      <LedgerRow cells={CELLS} abilityDisplay="modifier" animateSwap />
    );
    const large = () =>
      container.querySelector(
        '[data-ledger-cell="strength"] [data-number="large"]'
      )!;
    expect(large()).not.toHaveClass('animate-rk-number-swap');
    rerender(<LedgerRow cells={CELLS} abilityDisplay="score" animateSwap />);
    expect(large()).toHaveClass('animate-rk-number-swap');
    rerender(<LedgerRow cells={CELLS} abilityDisplay="modifier" />);
    expect(large()).not.toHaveClass('animate-rk-number-swap');
  });

  it('plays the swap once, not again when editing remounts the numbers', () => {
    const { container, rerender } = render(
      <LedgerRow cells={CELLS} abilityDisplay="modifier" animateSwap />
    );
    const large = () =>
      container.querySelector(
        '[data-ledger-cell="strength"] [data-number="large"]'
      )!;
    rerender(<LedgerRow cells={CELLS} abilityDisplay="score" animateSwap />);
    expect(large()).toHaveClass('animate-rk-number-swap');
    // jsdom has no AnimationEvent, so React listens for the prefixed
    // webkitAnimationEnd there; the event bubbles to the row.
    const end = new Event('webkitAnimationEnd', { bubbles: true });
    Object.defineProperty(end, 'animationName', { value: 'rk-number-swap' });
    fireEvent(large(), end);
    expect(large()).not.toHaveClass('animate-rk-number-swap');
    rerender(
      <LedgerRow
        cells={CELLS}
        abilityDisplay="score"
        animateSwap
        editing
        onScoreChange={vi.fn()}
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(large()).not.toHaveClass('animate-rk-number-swap');
  });
});
