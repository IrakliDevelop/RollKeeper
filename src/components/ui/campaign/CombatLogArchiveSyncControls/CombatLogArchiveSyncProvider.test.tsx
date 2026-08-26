import 'fake-indexeddb/auto';

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';
import { useCombatLogStore } from '@/store/combatLogStore';
import { useDmStore } from '@/store/dmStore';

import { CombatLogArchiveSyncProvider } from './CombatLogArchiveSyncProvider';

const NOW = '2026-08-25T00:00:00.000Z';

/**
 * The provider only stays inert if the campaign it is asked for actually
 * exists: with an unknown code every effect would early-return on
 * `campaignCode` alone and the default-off guarantee below would be vacuous.
 */
function seedCampaign() {
  useDmStore.setState({
    campaigns: [{ code: 'SYNTH1', name: 'Combat logs', createdAt: NOW }],
  });
}

describe('CombatLogArchiveSyncProvider owner mount', () => {
  beforeEach(() => {
    seedCampaign();
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // The persisted store rewrites its envelope on every setState, so the
    // reset has to happen before the storage is cleared.
    useCombatLogStore.setState({
      encounters: {},
      combatLogTombstones: {},
      activeArchiveId: null,
      lastAdmissionError: null,
    });
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('renders children and performs zero storage, IndexedDB, cookie, or network work by default', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cookieBefore = document.cookie;

    const { container } = render(
      <CombatLogArchiveSyncProvider campaignCode="SYNTH1">
        <p>route content</p>
      </CombatLogArchiveSyncProvider>
    );

    // The provider adds no DOM of its own, so the route renders unchanged.
    expect(container.innerHTML).toBe('<p>route content</p>');
    await Promise.resolve();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
  });

  it('keeps that guarantee falsifiable: the same spies do catch real work', async () => {
    // Without this case the assertions above could pass because the spies are
    // installed too late, or because `openRollkeeperDatabase` and
    // `localStorage` are stubbed out of the environment entirely.
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const open = vi.spyOn(indexedDB, 'open');

    localStorage.getItem('rollkeeper-combat-log');
    const database = await openRollkeeperDatabase();
    database.close();

    expect(getItem).toHaveBeenCalled();
    expect(open).toHaveBeenCalled();
  });
});
