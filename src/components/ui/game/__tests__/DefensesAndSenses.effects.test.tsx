// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useSensesData', () => ({
  useSensesData: () => ({ senses: [], loading: false }),
}));
import DefensesAndSenses from '@/components/ui/game/DefensesAndSenses';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

describe('DefensesAndSenses effects', () => {
  beforeEach(() => {
    localStorage.clear();
    const character = makeCharacter();
    character.damageResistances = ['Fire', 'Cold'];
    character.damageImmunities = ['Poison'];
    character.senses = [
      {
        id: 'dark',
        name: 'Darkvision',
        range: 60,
        source: 'Ancestry',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: 'blind',
        name: 'Blindsight',
        range: 10,
        source: 'Spell',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
    ];
    useCharacterStore.setState({ character });
  });
  afterEach(cleanup);

  it('shows neutral defenses in a Section and gates changes in play mode', () => {
    const { container } = render(<DefensesAndSenses editing={false} />);
    expect(
      screen.getByRole('heading', { name: /Defenses and senses/ })
    ).toBeTruthy();
    expect(screen.getByText('Fire')).toBeTruthy();
    expect(screen.getByText('Darkvision')).toBeTruthy();
    expect(
      screen.queryAllByRole('button', {
        name: /^Add (Damage|Condition|Senses)/,
      })
    ).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Remove Fire' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Remove Darkvision' })
    ).toBeNull();
    expect(container.querySelector('.bg-accent-amber-bg')).toBeNull();
  });

  it('returns focus to the next tag or sense, then to Add when the last is removed', async () => {
    const user = userEvent.setup();
    render(<DefensesAndSenses editing />);
    await user.click(screen.getByRole('button', { name: 'Remove Fire' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Remove Cold' })
      )
    );
    await user.click(screen.getByRole('button', { name: 'Remove Cold' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Add Damage resistances' })
      )
    );
    await user.click(screen.getByRole('button', { name: 'Remove Darkvision' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Remove Blindsight' })
      )
    );
  });

  it('keeps the add range clearable and validates it before adding', async () => {
    const user = userEvent.setup();
    render(<DefensesAndSenses editing />);
    await user.click(screen.getByRole('button', { name: 'Add Senses' }));
    const range = screen.getByRole('textbox', { name: 'Range (ft.)' });
    expect(range.getAttribute('type')).toBe('text');
    await user.clear(range);
    expect(range.getAttribute('value')).toBe('');
    expect(
      screen.getByRole('button', { name: 'Add sense' }).hasAttribute('disabled')
    ).toBe(true);
  });

  it('closes an open selector on edit-to-play and keeps collapse across remounts', async () => {
    const user = userEvent.setup();
    const view = render(<DefensesAndSenses editing />);
    await user.click(
      screen.getByRole('button', { name: 'Add Damage resistances' })
    );
    expect(
      screen.getByRole('button', { name: 'Done Damage resistances' })
    ).toBeTruthy();
    expect(screen.getByPlaceholderText('Search')).toBeTruthy();
    view.rerender(<DefensesAndSenses editing={false} />);
    expect(screen.queryByPlaceholderText('Search')).toBeNull();
    expect(
      screen.queryAllByRole('button', {
        name: /^Add (Damage|Condition|Senses)/,
      })
    ).toHaveLength(0);
    view.rerender(<DefensesAndSenses editing />);
    expect(screen.queryByPlaceholderText('Search')).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Defenses and senses' })
    );
    expect(screen.queryByText('Fire')).toBeNull();
    view.unmount();
    // Collapse is a per-device preference now: it survives a remount.
    render(<DefensesAndSenses editing />);
    expect(screen.queryByText('Fire')).toBeNull();
  });
});
