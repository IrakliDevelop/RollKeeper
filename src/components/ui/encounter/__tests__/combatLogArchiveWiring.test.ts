import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useCombatLogStore } from '@/store/combatLogStore';
import {
  startCombatLogArchiveForCombat,
  endCombatLogArchiveForCombat,
} from '../EncounterView';

function resetCombatLogStore() {
  useCombatLogStore.setState({
    encounters: {},
    combatLogTombstones: {},
    activeArchiveId: null,
    lastAdmissionError: null,
  });
}

describe('startCombatLogArchiveForCombat', () => {
  beforeEach(() => {
    resetCombatLogStore();
  });

  it('creates an archive for the encounter and sets it active', () => {
    startCombatLogArchiveForCombat(
      'enc-1',
      'ABC123',
      useCombatLogStore.getState().startArchive
    );

    const state = useCombatLogStore.getState();
    expect(state.activeArchiveId).not.toBeNull();
    const archive = state.encounters[state.activeArchiveId!];
    expect(archive).toMatchObject({
      encounterId: 'enc-1',
      campaignCode: 'ABC123',
    });
  });

  it('does not throw or otherwise break combat start when admission rejects (startArchive returns null)', () => {
    const startArchive = vi.fn().mockReturnValue(null);

    expect(() =>
      startCombatLogArchiveForCombat('enc-1', 'ABC123', startArchive)
    ).not.toThrow();
    expect(startArchive).toHaveBeenCalledWith('enc-1', 'ABC123');
    // No archive was activated locally by the wiring itself.
    expect(useCombatLogStore.getState().activeArchiveId).toBeNull();
  });
});

describe('endCombatLogArchiveForCombat', () => {
  beforeEach(() => {
    resetCombatLogStore();
  });

  it('ends the active archive and clears activeArchiveId', () => {
    const archiveId = useCombatLogStore.getState().startArchive('enc-1')!;
    expect(useCombatLogStore.getState().activeArchiveId).toBe(archiveId);

    const store = useCombatLogStore.getState();
    endCombatLogArchiveForCombat(
      archiveId,
      store.endArchive,
      store.setActiveArchive
    );

    const state = useCombatLogStore.getState();
    expect(state.activeArchiveId).toBeNull();
    expect(state.encounters[archiveId]?.endedAt).toBeDefined();
  });

  it('no-ops when there is no active archive', () => {
    const endArchive = vi.fn();
    const setActiveArchive = vi.fn();

    endCombatLogArchiveForCombat(null, endArchive, setActiveArchive);

    expect(endArchive).not.toHaveBeenCalled();
    expect(setActiveArchive).not.toHaveBeenCalled();
  });
});
