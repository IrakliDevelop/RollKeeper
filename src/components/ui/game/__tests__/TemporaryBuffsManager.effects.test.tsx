// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import TemporaryBuffsManager from '@/components/ui/game/TemporaryBuffsManager';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

describe('TemporaryBuffsManager effects', () => {
  beforeEach(() => {
    const character = makeCharacter();
    character.temporaryBuffs = [
      {
        id: 'thp',
        name: 'Wild Shape temporary hit points',
        source: 'Class feature',
        isActive: true,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
        effects: [
          { id: 'thp-e', targetStat: 'tempHp', mode: 'grant', value: 10 },
        ],
      },
      {
        id: 'armor',
        name: 'Shield of Faith',
        source: 'Spell',
        isActive: false,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
        effects: [{ id: 'armor-e', targetStat: 'ac', mode: 'add', value: 2 }],
      },
    ];
    useCharacterStore.setState({ character });
  });
  afterEach(cleanup);

  it('shows neutral rows, full names, state on labeled switches and no brass action at rest', async () => {
    const user = userEvent.setup();
    const { container } = render(<TemporaryBuffsManager />);
    expect(
      screen.getByRole('heading', { name: /Temporary buffs/ })
    ).toBeTruthy();
    expect(
      screen
        .getByRole('switch', { name: 'Wild Shape temporary hit points' })
        .getAttribute('aria-checked')
    ).toBe('true');
    expect(
      screen
        .getByRole('switch', { name: 'Shield of Faith' })
        .getAttribute('aria-checked')
    ).toBe('false');
    expect(screen.getByText('Wild Shape temporary hit points')).toBeTruthy();
    expect(container.querySelector('[data-variant="primary"]')).toBeNull();
    expect(container.querySelector('[data-effect-kind="tempHp"]')).toBeTruthy();
    await user.click(screen.getByRole('switch', { name: 'Shield of Faith' }));
    expect(
      useCharacterStore.getState().character.temporaryBuffs?.[1].isActive
    ).toBe(true);
  });

  it('opens the existing add/edit form in a dialog and keeps numeric buff values', async () => {
    const user = userEvent.setup();
    render(<TemporaryBuffsManager />);
    await user.click(screen.getByRole('button', { name: 'Add buff' }));
    expect(screen.getByRole('dialog', { name: 'Add buff' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(
      screen.getByRole('button', {
        name: 'Edit Wild Shape temporary hit points',
      })
    );
    expect(screen.getByRole('dialog', { name: 'Edit buff' })).toBeTruthy();
    expect(
      screen.getByRole('textbox', { name: 'Value' }).getAttribute('type')
    ).toBe('text');
  });

  it('treats an empty value as incomplete and preserves a signed numeric edit', async () => {
    const user = userEvent.setup();
    render(<TemporaryBuffsManager />);
    await user.click(
      screen.getByRole('button', { name: 'Edit Shield of Faith' })
    );
    const value = screen.getByRole('textbox', { name: 'Value' });
    await user.clear(value);
    expect(
      screen.getByRole('button', { name: 'Save buff' }).hasAttribute('disabled')
    ).toBe(true);
    await user.type(value, '-3');
    await user.click(screen.getByRole('button', { name: 'Save buff' }));
    expect(
      useCharacterStore.getState().character.temporaryBuffs?.[1].effects[0]
        .value
    ).toBe(-3);
  });

  it('returns focus to a surviving row or Add buff after deleting the focused row', async () => {
    const user = userEvent.setup();
    render(<TemporaryBuffsManager />);
    await user.click(
      screen.getByRole('button', {
        name: 'Delete Wild Shape temporary hit points',
      })
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Edit Shield of Faith' })
      )
    );
    await user.click(
      screen.getByRole('button', { name: 'Delete Shield of Faith' })
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Add buff' })
      )
    );
  });
});
