// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useSensesData', () => ({
  useSensesData: () => ({
    senses: [{ name: 'Darkvision', description: 'See in the dark.' }],
    loading: false,
  }),
}));
vi.mock('@/utils/conditionsDiseasesLoader', () => ({
  loadAllConditions: vi.fn(async () => []),
  loadAllDiseases: vi.fn(async () => []),
  getExhaustionByVariant: vi.fn(async () => null),
}));

import ConditionsDiseasesManager from '@/components/ui/game/ConditionsDiseasesManager';
import DefensesAndSenses from '@/components/ui/game/DefensesAndSenses';
import TemporaryBuffsManager from '@/components/ui/game/TemporaryBuffsManager';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';

function uiPrefsCollapsed(): Record<string, boolean> {
  return JSON.parse(localStorage.getItem('rollkeeper-ui-prefs') ?? '{}')
    .collapsed;
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('paired Defenses and buffs headers', () => {
  it('collapses Temporary buffs through the shared section preference', async () => {
    const user = userEvent.setup();
    useCharacterStore.setState({ character: makeCharacter() });
    render(<TemporaryBuffsManager />);

    const toggle = screen.getByRole('button', { name: 'Temporary buffs' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(uiPrefsCollapsed()['combat-temporary-buffs']).toBe(true);
  });

  it('collapses Defenses and senses through the shared section preference, with no Expand/Collapse button', async () => {
    const user = userEvent.setup();
    useCharacterStore.setState({ character: makeCharacter() });
    render(<DefensesAndSenses editing={false} />);

    expect(screen.queryByRole('button', { name: 'Collapse' })).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Defenses and senses' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(uiPrefsCollapsed()['combat-defenses-senses']).toBe(true);
  });
});

describe('Defenses and senses screen-reader names', () => {
  function seedDefenses() {
    const character = makeCharacter();
    character.senses = [
      {
        id: 'dark',
        name: 'Darkvision',
        range: 60,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
    ];
    useCharacterStore.setState({ character });
  }

  it('names each tag search field by its section', async () => {
    const user = userEvent.setup();
    seedDefenses();
    render(<DefensesAndSenses editing />);
    await user.click(
      screen.getByRole('button', { name: 'Add Damage resistances' })
    );
    expect(
      screen.getByRole('textbox', { name: 'Search damage resistances' })
    ).toBeTruthy();
  });

  it('reports whether a sense description is open', async () => {
    const user = userEvent.setup();
    seedDefenses();
    render(<DefensesAndSenses editing={false} />);
    const toggle = screen.getByRole('button', {
      name: 'Show Darkvision description',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders when an older character has no senses array', () => {
    const character = makeCharacter() as CharacterState;
    (character as { senses?: unknown }).senses = undefined;
    useCharacterStore.setState({ character });
    render(<DefensesAndSenses editing />);
    expect(screen.getByText('Senses')).toBeTruthy();
  });
});

describe('Temporary buff form', () => {
  it('names the effect row remove button', async () => {
    const user = userEvent.setup();
    useCharacterStore.setState({ character: makeCharacter() });
    render(<TemporaryBuffsManager />);
    await user.click(screen.getByRole('button', { name: 'Add buff' }));
    await user.click(screen.getByRole('button', { name: /Add effect/ }));
    expect(
      screen.getAllByRole('button', { name: 'Remove effect' }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });
});

describe('Exhaustion display', () => {
  function seedExhaustion(count: number | null) {
    const character = makeCharacter();
    character.conditionsAndDiseases.activeConditions =
      count === null
        ? []
        : [
            {
              id: 'exhaustion',
              name: 'Exhaustion',
              source: 'XPHB',
              description: 'Exhaustion rules.',
              stackable: true,
              count,
              appliedAt: '2026-09-20T00:00:00.000Z',
              kind: 'debuff',
            },
          ];
    useCharacterStore.setState({ character });
  }

  it('shows no ember Exhaustion chip at level 0', async () => {
    seedExhaustion(null);
    const { container } = render(<ConditionsDiseasesManager />);
    await waitFor(() =>
      expect(screen.getByText('Conditions and effects')).toBeTruthy()
    );
    expect(container.querySelector('[data-kind="condition"]')).toBeNull();
    expect(screen.getByText('Exhaustion')).toBeTruthy();
  });

  it('labels the exhaustion row with its level instead of a stack count', async () => {
    seedExhaustion(2);
    const { container } = render(<ConditionsDiseasesManager />);
    await waitFor(() =>
      expect(container.querySelector('[data-effect-row]')).not.toBeNull()
    );
    const row = container.querySelector<HTMLElement>(
      '[data-effect-row="exhaustion"]'
    )!;
    expect(row.textContent).toContain('Level 2');
    expect(row.textContent).not.toContain('x2');
  });
});
