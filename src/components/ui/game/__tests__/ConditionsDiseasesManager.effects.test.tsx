// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConditionsDiseasesManager from '@/components/ui/game/ConditionsDiseasesManager';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

vi.mock('@/utils/conditionsDiseasesLoader', () => ({
  loadAllConditions: vi.fn(async () => [
    {
      id: 'stunned',
      name: 'Stunned',
      source: 'XPHB',
      description: 'Stunned rules.',
    },
  ]),
  loadAllDiseases: vi.fn(async () => [
    {
      id: 'fever',
      name: 'Cackle Fever',
      source: 'DMG',
      description: 'Fever rules.',
      type: 'Humanoid disease',
    },
  ]),
  getExhaustionByVariant: vi.fn(async () => null),
}));
vi.mock('@/components/ui/feedback/confirm-dialog', () => ({
  confirmDialog: vi.fn(async () => true),
}));

function seed() {
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
      id: 'exhaustion',
      name: 'Exhaustion',
      source: 'XPHB',
      description: 'Exhaustion rules.',
      stackable: true,
      count: 2,
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
  character.conditionsAndDiseases.activeDiseases = [
    {
      id: 'fever',
      name: 'Cackle Fever',
      source: 'DMG',
      description: 'Fever rules.',
      appliedAt: '2026-09-20T00:00:00.000Z',
    },
  ];
  useCharacterStore.setState({ character });
}

describe('ConditionsDiseasesManager effects', () => {
  beforeEach(() => {
    seed();
    vi.mocked(confirmDialog).mockResolvedValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows complete rows and separates buff-kind effects', async () => {
    const user = userEvent.setup();
    render(<ConditionsDiseasesManager />);
    await screen.findByRole('heading', { name: 'Conditions and effects' });
    expect(
      screen.getByRole('tablist', { name: 'Conditions and effects' })
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Conditions 2/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Buffs 1/ })).toBeTruthy();
    expect(screen.getByText('Poisoned')).toBeTruthy();
    expect(
      screen.getAllByText(/Player's Handbook 2024/).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Bless')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Show Poisoned details' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Remove Poisoned' })
    ).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: /Buffs 1/ }));
    expect(screen.getByText('Bless')).toBeTruthy();
    expect(screen.queryByText('Poisoned')).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Show Bless details' })
    );
    expect(screen.getByText('Bless spell rules.')).toBeTruthy();
  });

  it('confirms one-revision non-buff clear and honors cancel', async () => {
    const user = userEvent.setup();
    render(<ConditionsDiseasesManager />);
    await screen.findByRole('heading', { name: 'Conditions and effects' });
    const before = useCharacterStore.getState().character.revision ?? 0;
    vi.mocked(confirmDialog).mockResolvedValueOnce(false);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(useCharacterStore.getState().character.revision ?? 0).toBe(before);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Remove all conditions?',
        confirmLabel: 'Remove all',
        tone: 'danger',
      })
    );
    expect(useCharacterStore.getState().character.revision).toBe(before + 1);
    expect(
      useCharacterStore
        .getState()
        .character.conditionsAndDiseases.activeConditions.map(c => c.name)
    ).toEqual(['Bless']);
  });

  it('confirms disease clear and opens the add picker in a dialog', async () => {
    const user = userEvent.setup();
    render(<ConditionsDiseasesManager />);
    await screen.findByRole('heading', { name: 'Conditions and effects' });
    await user.click(screen.getByRole('tab', { name: /Diseases 1/ }));
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Remove all diseases?',
        confirmLabel: 'Remove all',
        tone: 'danger',
      })
    );
    expect(
      useCharacterStore.getState().character.conditionsAndDiseases
        .activeDiseases
    ).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Add disease' }));
    expect(screen.getByRole('dialog', { name: 'Add disease' })).toBeTruthy();
    expect(
      screen.getByRole('textbox', { name: 'Search diseases' })
    ).toBeTruthy();
    expect(screen.getByText(/Humanoid disease/)).toBeTruthy();
    await user.type(
      screen.getByRole('textbox', { name: 'Search diseases' }),
      'missing'
    );
    expect(
      screen.getByText('No diseases found matching "missing"')
    ).toBeTruthy();
  });

  it('moves focus to the next row and then Add condition after removing the last row', async () => {
    const user = userEvent.setup();
    render(<ConditionsDiseasesManager />);
    await screen.findByRole('heading', { name: 'Conditions and effects' });
    await user.click(screen.getByRole('button', { name: 'Remove Poisoned' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Show Exhaustion details' })
      )
    );
    await user.click(screen.getByRole('button', { name: 'Remove Exhaustion' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Add condition' })
      )
    );
  });
});
