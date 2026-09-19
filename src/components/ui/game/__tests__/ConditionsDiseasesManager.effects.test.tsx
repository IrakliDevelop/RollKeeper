// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConditionsDiseasesManager from '@/components/ui/game/ConditionsDiseasesManager';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

vi.mock('@/utils/conditionsDiseasesLoader', () => ({
  loadAllConditions: vi.fn(async () => []),
  loadAllDiseases: vi.fn(async () => []),
  getExhaustionByVariant: vi.fn(async () => null),
}));

describe('ConditionsDiseasesManager effects', () => {
  beforeEach(() => {
    const character = makeCharacter();
    character.conditionsAndDiseases.activeConditions = [
      {
        id: 'poisoned',
        name: 'Poisoned',
        source: 'XPHB',
        description: 'Poisoned rules.',
        stackable: false,
        count: 1,
        appliedAt: '2026-09-20T00:00:00.000Z',
        kind: 'debuff',
      },
      {
        id: 'bless',
        name: 'Bless',
        source: 'DM',
        description: 'Bless spell rules.',
        stackable: false,
        count: 1,
        appliedAt: '2026-09-20T00:00:00.000Z',
        kind: 'buff',
      },
    ];
    useCharacterStore.setState({ character });
  });

  afterEach(cleanup);

  it('separates DM-applied buffs and lets the player read their details', async () => {
    const user = userEvent.setup();
    render(<ConditionsDiseasesManager />);

    await waitFor(() =>
      expect(screen.getByText('Active Conditions')).toBeTruthy()
    );
    expect(
      screen.getByRole('button', { name: /Conditions 1/i }).parentElement
        ?.className
    ).toContain('grid-cols-3');
    expect(screen.getByText('Poisoned')).toBeTruthy();
    expect(screen.queryByText('Bless')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Buffs 1/i }));
    expect(screen.getByText('Bless')).toBeTruthy();
    expect(screen.queryByText('Poisoned')).toBeNull();

    await user.click(screen.getByTitle('View details'));
    expect(screen.getByText('Bless spell rules.')).toBeTruthy();
  });
});
