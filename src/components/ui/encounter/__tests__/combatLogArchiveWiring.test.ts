import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useCombatLogStore } from '@/store/combatLogStore';
import type { CombatStatusEvent } from '@/types/combatLog';
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
      'enc-1',
      archiveId,
      store.getLatestArchiveForEncounter,
      store.endArchive,
      store.setActiveArchive
    );

    const state = useCombatLogStore.getState();
    expect(state.activeArchiveId).toBeNull();
    expect(state.encounters[archiveId]?.endedAt).toBeDefined();
  });

  it('no-ops when there is no archive for this encounter', () => {
    const endArchive = vi.fn();
    const setActiveArchive = vi.fn();
    const getLatestArchiveForEncounter = vi.fn().mockReturnValue(null);

    endCombatLogArchiveForCombat(
      'enc-1',
      null,
      getLatestArchiveForEncounter,
      endArchive,
      setActiveArchive
    );

    expect(getLatestArchiveForEncounter).toHaveBeenCalledWith('enc-1');
    expect(endArchive).not.toHaveBeenCalled();
    expect(setActiveArchive).not.toHaveBeenCalled();
  });

  it("two concurrently active encounters: ending X ends only X's archive, leaves Y active and logging", () => {
    // Start combat on X, then on Y — mirrors two encounters both `isActive`
    // (e.g. combat started on X, then on Y before X was ended). Y becomes
    // the store's global `activeArchiveId`, orphaning X's archive.
    const store = useCombatLogStore.getState();
    const archiveX = store.startArchive('enc-x')!;
    const archiveY = useCombatLogStore.getState().startArchive('enc-y')!;
    expect(useCombatLogStore.getState().activeArchiveId).toBe(archiveY);

    // End combat on X.
    const s1 = useCombatLogStore.getState();
    endCombatLogArchiveForCombat(
      'enc-x',
      s1.activeArchiveId,
      s1.getLatestArchiveForEncounter,
      s1.endArchive,
      s1.setActiveArchive
    );

    const afterEndX = useCombatLogStore.getState();
    // X's own archive is ended.
    expect(afterEndX.encounters[archiveX]?.endedAt).toBeDefined();
    // Y's archive must NOT have been touched.
    expect(afterEndX.encounters[archiveY]?.endedAt).toBeUndefined();
    // The active pointer still names Y — ending X must not clear it.
    expect(afterEndX.activeArchiveId).toBe(archiveY);

    // Further logging for Y still works.
    const stillLoggingForY: Omit<CombatStatusEvent, 'id' | 'timestamp'> = {
      type: 'combat_start',
      encounterId: 'enc-y',
      round: 1,
      turn: 1,
      participantNames: ['still logging for Y'],
    };
    afterEndX.logEvent(archiveY, stillLoggingForY);
    expect(
      useCombatLogStore.getState().encounters[archiveY]?.events
    ).toHaveLength(1);

    // Now end Y — its own archive closes and the active pointer clears.
    const s2 = useCombatLogStore.getState();
    endCombatLogArchiveForCombat(
      'enc-y',
      s2.activeArchiveId,
      s2.getLatestArchiveForEncounter,
      s2.endArchive,
      s2.setActiveArchive
    );

    const afterEndY = useCombatLogStore.getState();
    expect(afterEndY.encounters[archiveY]?.endedAt).toBeDefined();
    expect(afterEndY.activeArchiveId).toBeNull();
  });
});
