import 'fake-indexeddb/auto';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlayerBackupRecovery } from '@/components/ui/character/PlayerBackupRecovery';
import { captureDeviceBackup } from '@/lib/deviceRecovery';
import { readCharacterAuthority } from '@/lib/indexeddb/characterAuthority';
import { resetCharacterPersistenceRuntimeForTests } from '@/lib/indexeddb/characterPersistenceRuntime';
import {
  deleteRollkeeperDatabaseForTests,
  openExistingRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { usePlayerStore } from '@/store/playerStore';

const PLAYABLE_PLAYER =
  '{"state":{"characters":[{"id":"hero-1","name":"Hero One","race":"Human","class":"Fighter","level":1,"createdAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","lastPlayed":"2020-01-01T00:00:00.000Z","characterData":{"id":"hero-1"},"tags":[],"isArchived":false}]},"version":1}';

const caps = vi.hoisted(() => ({ localAuthorityMutation: false }));
const authoritySpies = vi.hoisted(() => ({
  inspectCurrentCharacterSafetyCoverage: vi.fn(),
  verifyCharacterRollbackGenerationAfterReopen: vi.fn(),
  rollbackCharacterAuthority: vi.fn(),
}));
const authorityActual = vi.hoisted(
  () =>
    ({}) as {
      inspectCurrentCharacterSafetyCoverage?: typeof import('@/lib/indexeddb/characterAuthority').inspectCurrentCharacterSafetyCoverage;
      verifyCharacterRollbackGenerationAfterReopen?: typeof import('@/lib/indexeddb/characterAuthority').verifyCharacterRollbackGenerationAfterReopen;
      rollbackCharacterAuthority?: typeof import('@/lib/indexeddb/characterAuthority').rollbackCharacterAuthority;
    }
);

vi.mock('@/lib/playerBackup/playerBackupFlags', () => ({
  readPlayerBackupCapabilities: () => ({
    calls: { localAuthorityMutation: caps.localAuthorityMutation },
  }),
}));

vi.mock('@/lib/indexeddb/characterAuthority', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/indexeddb/characterAuthority')>();
  authorityActual.inspectCurrentCharacterSafetyCoverage =
    actual.inspectCurrentCharacterSafetyCoverage;
  authorityActual.verifyCharacterRollbackGenerationAfterReopen =
    actual.verifyCharacterRollbackGenerationAfterReopen;
  authorityActual.rollbackCharacterAuthority =
    actual.rollbackCharacterAuthority;
  authoritySpies.inspectCurrentCharacterSafetyCoverage.mockImplementation(
    actual.inspectCurrentCharacterSafetyCoverage
  );
  authoritySpies.verifyCharacterRollbackGenerationAfterReopen.mockImplementation(
    actual.verifyCharacterRollbackGenerationAfterReopen
  );
  authoritySpies.rollbackCharacterAuthority.mockImplementation(
    actual.rollbackCharacterAuthority
  );
  return {
    ...actual,
    inspectCurrentCharacterSafetyCoverage:
      authoritySpies.inspectCurrentCharacterSafetyCoverage,
    verifyCharacterRollbackGenerationAfterReopen:
      authoritySpies.verifyCharacterRollbackGenerationAfterReopen,
    rollbackCharacterAuthority: authoritySpies.rollbackCharacterAuthority,
  };
});

async function uploadSafetyFile(serialized: string) {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  const file = new File([serialized], 'backup.json', {
    type: 'application/json',
  });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('PlayerBackupRecovery', () => {
  afterEach(async () => {
    cleanup();
    usePlayerStore.setState({ characters: [] });
    localStorage.clear();
    caps.localAuthorityMutation = false;
    resetCharacterPersistenceRuntimeForTests();
    authoritySpies.inspectCurrentCharacterSafetyCoverage.mockReset();
    authoritySpies.verifyCharacterRollbackGenerationAfterReopen.mockReset();
    authoritySpies.rollbackCharacterAuthority.mockReset();
    authoritySpies.inspectCurrentCharacterSafetyCoverage.mockImplementation(
      authorityActual.inspectCurrentCharacterSafetyCoverage!
    );
    authoritySpies.verifyCharacterRollbackGenerationAfterReopen.mockImplementation(
      authorityActual.verifyCharacterRollbackGenerationAfterReopen!
    );
    authoritySpies.rollbackCharacterAuthority.mockImplementation(
      authorityActual.rollbackCharacterAuthority!
    );
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('reviews a valid character-free safety file as restore-missing-data', async () => {
    localStorage.setItem(
      'rollkeeper-dm-data',
      '{"state":{"campaigns":[]},"version":1}'
    );
    const bundle = await captureDeviceBackup(localStorage, {
      appVersion: 'test',
      runId: 'dm-only',
      timestamp: 'now',
    });
    localStorage.clear();
    render(<PlayerBackupRecovery />);
    await uploadSafetyFile(JSON.stringify(bundle));
    expect(
      await screen.findByRole('heading', { name: COPY.recovery.reviewTitle })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: COPY.recovery.restoreMissing })
    ).toBeVisible();
    expect(
      await openExistingRollkeeperDatabase({ factory: indexedDB })
    ).toBeNull();
  });

  it('does not create an IndexedDB pointer for an empty profile when local authority mutation is unavailable', async () => {
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', PLAYABLE_PLAYER]]),
      { appVersion: 'test', runId: 'legacy-empty', timestamp: 'now' }
    );
    render(<PlayerBackupRecovery />);
    await uploadSafetyFile(JSON.stringify(bundle));
    fireEvent.click(
      await screen.findByRole('button', { name: COPY.recovery.restoreCurrent })
    );
    fireEvent.click(
      screen.getByRole('button', { name: COPY.recovery.confirm })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      COPY.recovery.restoreSuccess
    );
    expect(
      await openExistingRollkeeperDatabase({ factory: indexedDB })
    ).toBeNull();
    expect(localStorage.getItem('rollkeeper-player-data')).toBe(
      PLAYABLE_PLAYER
    );
    expect(usePlayerStore.getState().characters).toEqual([
      expect.objectContaining({ id: 'hero-1', tags: [] }),
    ]);
  });

  it('switches the mounted stores to the activated authority before reporting success', async () => {
    caps.localAuthorityMutation = true;
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', PLAYABLE_PLAYER]]),
      { appVersion: 'test', runId: 'activate-visible', timestamp: 'now' }
    );
    render(<PlayerBackupRecovery />);
    await uploadSafetyFile(JSON.stringify(bundle));
    fireEvent.click(
      await screen.findByRole('button', { name: COPY.recovery.restoreCurrent })
    );
    fireEvent.click(
      screen.getByRole('button', { name: COPY.recovery.confirm })
    );
    expect(await screen.findByText(COPY.recovery.restorePreview)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: COPY.recovery.confirm })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      COPY.recovery.restoreSuccess
    );
    expect(usePlayerStore.getState().characters).toEqual([
      expect.objectContaining({ id: 'hero-1', tags: [] }),
    ]);
  });

  it('stages an inactive generation without activating until a second confirmation', async () => {
    caps.localAuthorityMutation = true;
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', PLAYABLE_PLAYER]]),
      { appVersion: 'test', runId: 'stage-only', timestamp: 'now' }
    );
    render(<PlayerBackupRecovery />);
    await uploadSafetyFile(JSON.stringify(bundle));
    fireEvent.click(
      await screen.findByRole('button', { name: COPY.recovery.restoreCurrent })
    );
    fireEvent.click(
      screen.getByRole('button', { name: COPY.recovery.confirm })
    );
    expect(await screen.findByText(COPY.recovery.restorePreview)).toBeVisible();
    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    expect(database).not.toBeNull();
    expect(await readCharacterAuthority(database!, 'guest')).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    database!.close();
    expect(
      screen.queryByText(COPY.recovery.restoreSuccess)
    ).not.toBeInTheDocument();
  });

  it('keeps incomplete roster characters unusable and does not activate them', async () => {
    caps.localAuthorityMutation = true;
    const player =
      '{"state":{"characters":[{"id":"hero-1","name":"Hero One","characterData":{"id":"hero-1"}}]},"version":1}';
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', player]]),
      { appVersion: 'test', runId: 'incomplete-ui', timestamp: 'now' }
    );
    render(<PlayerBackupRecovery />);
    await uploadSafetyFile(JSON.stringify(bundle));
    fireEvent.click(
      await screen.findByRole('button', { name: COPY.recovery.restoreCurrent })
    );
    fireEvent.click(
      screen.getByRole('button', { name: COPY.recovery.confirm })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      COPY.recovery.unusable
    );
    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    expect(await readCharacterAuthority(database!, 'guest')).toEqual({
      authority: 'localStorage',
      epoch: 0,
    });
    database!.close();
  });

  it('does not write an unusable per-character envelope through the legacy fallback', async () => {
    const bundle = await captureDeviceBackup(
      new Map([
        ['rollkeeper-player-data', PLAYABLE_PLAYER],
        ['rollkeeper-character:hero-1', '{"state":{},"version":0}'],
      ]),
      { appVersion: 'test', runId: 'unusable-legacy', timestamp: 'now' }
    );
    render(<PlayerBackupRecovery />);
    await uploadSafetyFile(JSON.stringify(bundle));
    fireEvent.click(
      await screen.findByRole('button', { name: COPY.recovery.restoreCurrent })
    );
    fireEvent.click(
      screen.getByRole('button', { name: COPY.recovery.confirm })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      COPY.recovery.unusable
    );
    expect(localStorage.getItem('rollkeeper-player-data')).toBeNull();
    expect(localStorage.getItem('rollkeeper-character:hero-1')).toBeNull();
  });

  it('proves rollback generation after reopen instead of inferring from parity', async () => {
    authoritySpies.inspectCurrentCharacterSafetyCoverage.mockResolvedValueOnce({
      authority: {
        authority: 'indexedDB',
        namespace: 'guest',
        family: 'character',
        generation: 'active',
        epoch: 2,
        committedAt: 'now',
      },
      rows: [],
      parity: true,
      matchingJournalCount: 0,
      broadFileCoversCurrentCharacters: true,
    });
    authoritySpies.verifyCharacterRollbackGenerationAfterReopen.mockResolvedValueOnce(
      true
    );
    authoritySpies.rollbackCharacterAuthority.mockResolvedValueOnce({
      state: 'IDB_PRIMARY',
    });
    render(<PlayerBackupRecovery />);
    fireEvent.click(
      screen.getByRole('button', { name: COPY.recovery.options })
    );
    fireEvent.click(
      screen.getByRole('button', { name: COPY.recovery.rollback })
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: COPY.recovery.rollback })
    );
    await waitFor(() => {
      expect(
        authoritySpies.verifyCharacterRollbackGenerationAfterReopen
      ).toHaveBeenCalledWith(indexedDB, 'guest', 'active', 2);
      expect(authoritySpies.rollbackCharacterAuthority).toHaveBeenCalledWith(
        expect.anything(),
        localStorage,
        expect.objectContaining({ reopenVerified: true, confirmed: true })
      );
    });
  });
});
