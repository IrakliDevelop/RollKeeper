// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EncounterList } from './EncounterList';
import { useEncounterStore } from '@/store/encounterStore';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { Encounter } from '@/types/encounter';

const encounter: Encounter = {
  id: 'enc-1',
  name: 'Goblin ambush',
  campaignCode: 'SYNTH1',
  entities: [],
  isActive: false,
  round: 0,
  currentTurn: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

beforeEach(() => {
  useEncounterStore.setState({ encounters: [], encounterTombstones: {} });
  useBattleMapStore.setState({ battleMaps: {} });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EncounterList', () => {
  it('creates an encounter from a named field and returns focus to the opener', async () => {
    const user = userEvent.setup();
    render(<EncounterList campaignCode="SYNTH1" />);
    const opener = screen.getByRole('button', { name: 'Create encounter' });
    await user.click(opener);
    await user.type(
      screen.getByRole('textbox', { name: 'Encounter name' }),
      'Goblin ambush'
    );
    await user.click(screen.getByRole('button', { name: 'Create encounter' }));
    expect(useEncounterStore.getState().encounters[0]?.name).toBe(
      'Goblin ambush'
    );
    expect(
      screen.getByRole('button', { name: 'Create encounter' })
    ).toHaveFocus();
  });

  it('uses direct links and named row actions', () => {
    useEncounterStore.setState({ encounters: [encounter] });
    render(<EncounterList campaignCode="SYNTH1" />);
    expect(
      screen
        .getByRole('link', { name: 'Open Goblin ambush' })
        .getAttribute('href')
    ).toBe('/dm/campaign/SYNTH1/encounters/enc-1');
    expect(
      screen.getByRole('button', { name: 'Delete Goblin ambush' })
    ).toBeVisible();
  });
});
