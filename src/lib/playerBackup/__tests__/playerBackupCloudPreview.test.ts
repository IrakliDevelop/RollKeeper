import { describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

import {
  DATABASE_NAME,
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

import {
  PlayerBackupCloudPreviewController,
  previewPlayerBackupCloud,
} from '../playerBackupCloudPreview';
import type { PlayerBackupCloudPreview } from '../playerBackupCloudPreview';
import { readActivePlayerBackupRun } from '../playerBackupRunRepository';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cloud-1',
    legacy_client_id: 'hero-1',
    name: 'Hero',
    payload: { id: 'hero-1', name: 'Hero', characterData: { id: 'hero-1' } },
    schema_version: 1,
    client_revision: 1,
    server_version: 1,
    deleted_at: null,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('read-only player backup cloud preview', () => {
  it('uses only account and list reads and compares current-account rows', async () => {
    const getUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: 'account-a', email: 'a@x' } } });
    const gateway = {
      list: vi.fn().mockResolvedValue([row()]),
      put: vi.fn(),
      fetch: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
    };
    const preview = await previewPlayerBackupCloud({
      auth: { getUser },
      gateway,
      expectedAccountId: 'account-a',
      localCharacters: [
        { id: 'hero-1', name: 'Hero', characterData: { id: 'hero-1' } },
      ],
    });
    expect(preview.account.id).toBe('account-a');
    expect(preview.characters[0].state).toBe('identical');
    expect(gateway.list).toHaveBeenCalledOnce();
    expect(gateway.put).not.toHaveBeenCalled();
    expect(gateway.fetch).not.toHaveBeenCalled();
    expect(gateway.archive).not.toHaveBeenCalled();
    expect(gateway.restore).not.toHaveBeenCalled();
  });

  it('makes no cloud call while signed out', async () => {
    const gateway = { list: vi.fn() };
    await expect(
      previewPlayerBackupCloud({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: null }, error: null }),
        },
        gateway,
        localCharacters: [],
      })
    ).rejects.toMatchObject({ category: 'signed-out' });
    expect(gateway.list).not.toHaveBeenCalled();
  });

  it('rejects an account that changes during the read', async () => {
    const getUser = vi
      .fn()
      .mockResolvedValueOnce({ data: { user: { id: 'account-a' } } })
      .mockResolvedValueOnce({ data: { user: { id: 'account-b' } } });
    await expect(
      previewPlayerBackupCloud({
        auth: { getUser },
        gateway: { list: vi.fn().mockResolvedValue([row()]) },
        expectedAccountId: 'account-a',
        localCharacters: [],
      })
    ).rejects.toMatchObject({ category: 'account-changed' });
  });

  it('clears old rows synchronously and discards stale responses', async () => {
    let finish!: (value: PlayerBackupCloudPreview) => void;
    const controller = new PlayerBackupCloudPreviewController();
    const loading = controller.load(
      'account-a',
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    controller.changeAccount('account-b');
    expect(controller.snapshot()).toEqual({
      accountId: 'account-b',
      characters: [],
      loading: false,
    });
    finish({ account: { id: 'account-a' }, characters: [], onlineOnly: [] });
    await expect(loading).resolves.toBe(false);
    expect(controller.snapshot().accountId).toBe('account-b');
  });

  it('discards a stale failure after the account changes', async () => {
    let fail!: (cause: Error) => void;
    const controller = new PlayerBackupCloudPreviewController();
    const loading = controller.load(
      'account-a',
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        })
    );
    controller.changeAccount('account-b');
    fail(new Error('old account failed'));
    await expect(loading).resolves.toBe(false);
    expect(controller.snapshot()).toEqual({
      accountId: 'account-b',
      characters: [],
      loading: false,
    });
  });

  it('discovers only the active run for the current account', async () => {
    await deleteRollkeeperDatabaseForTests(indexedDB);
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    const write = database.transaction('meta', 'readwrite');
    const meta = write.objectStore('meta');
    meta.put({
      key: 'player-backup-active-run:account-a',
      runId: 'run-a',
      accountId: 'account-a',
    });
    meta.put({
      key: 'player-backup-run:run-a',
      version: 1,
      runId: 'run-a',
      accountId: 'account-a',
      namespace: 'user:account-a',
      mode: 'one-time',
      eligibleCharacterIds: ['hero-1'],
      selectedCharacterIds: ['hero-1'],
      clearedCharacterIds: [],
      futureDefault: 'off',
      broadSafetyReceipt: {
        runId: 'safety-a',
        manifestHash: 'manifest-a',
        createdAt: '2026-08-26T00:00:00.000Z',
        protectedEntryDigest: 'protected-a',
      },
      authority: {
        kind: 'legacy',
        namespace: 'guest',
        family: 'character',
      },
      stage: 'confirmed',
      confirmedAt: '2026-08-26T00:00:00.000Z',
      characterCheckpoints: {
        'hero-1': { localPreparation: 'pending' },
      },
    });
    await transactionComplete(write);
    database.close();

    await expect(
      readActivePlayerBackupRun({ accountId: 'account-a', factory: indexedDB })
    ).resolves.toMatchObject({ runId: 'run-a', accountId: 'account-a' });
    await expect(
      readActivePlayerBackupRun({ accountId: 'account-b', factory: indexedDB })
    ).resolves.toBeNull();
  });

  it('discovers no resumable run without creating rollkeeper-local', async () => {
    await deleteRollkeeperDatabaseForTests(indexedDB);
    await expect(
      readActivePlayerBackupRun({ accountId: 'account-a', factory: indexedDB })
    ).resolves.toBeNull();
    await new Promise(resolve => setTimeout(resolve, 0));
    await expect(indexedDB.databases()).resolves.not.toContainEqual(
      expect.objectContaining({ name: DATABASE_NAME })
    );
  });
});
