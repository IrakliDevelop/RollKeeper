import { afterEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

import {
  DATABASE_NAME,
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import * as supabaseBrowser from '@/lib/supabase/browser';
import * as characterCloudCodec from '@/lib/supabase/characterCloudCodec';
import * as characterCloudGateway from '@/lib/supabase/characterCloudGateway';

import {
  PlayerBackupCloudPreviewController,
  compareCloudRows,
  createBrowserPlayerBackupCloudPreview,
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

  it('does not list cloud rows when the signed-in account is not the expected account', async () => {
    const gateway = { list: vi.fn() };
    await expect(
      previewPlayerBackupCloud({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: 'account-b' } } }),
        },
        gateway,
        expectedAccountId: 'account-a',
        localCharacters: [],
      })
    ).rejects.toMatchObject({ category: 'account-changed' });
    expect(gateway.list).not.toHaveBeenCalled();
  });

  it('treats a thrown auth read as offline before any list call', async () => {
    const gateway = { list: vi.fn() };
    await expect(
      previewPlayerBackupCloud({
        auth: { getUser: vi.fn().mockRejectedValue(new Error('network down')) },
        gateway,
        localCharacters: [],
      })
    ).rejects.toMatchObject({ category: 'offline' });
    expect(gateway.list).not.toHaveBeenCalled();
  });

  it('treats an auth error as failed before any list call', async () => {
    const gateway = { list: vi.fn() };
    await expect(
      previewPlayerBackupCloud({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'account-a' } },
            error: { message: 'session unreadable' },
          }),
        },
        gateway,
        localCharacters: [],
      })
    ).rejects.toMatchObject({ category: 'failed' });
    expect(gateway.list).not.toHaveBeenCalled();
  });

  it('treats a thrown cloud list as offline', async () => {
    await expect(
      previewPlayerBackupCloud({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: 'account-a' } } }),
        },
        gateway: { list: vi.fn().mockRejectedValue(new Error('list failed')) },
        localCharacters: [],
      })
    ).rejects.toMatchObject({ category: 'offline' });
  });

  it('excludes ambiguous duplicate online-only rows', async () => {
    const compared = await compareCloudRows(
      [
        row({ id: 'cloud-a', legacy_client_id: 'online-only' }),
        row({ id: 'cloud-b', legacy_client_id: 'online-only' }),
        row({ id: 'cloud-c', legacy_client_id: 'unique-online' }),
      ],
      []
    );
    expect(compared.onlineOnly).toHaveLength(1);
    expect(compared.onlineOnly[0]?.row.id).toBe('cloud-c');
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
      onlineOnly: [],
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
      onlineOnly: [],
      loading: false,
    });
  });

  it('keeps the current-account snapshot after a successful load', async () => {
    const controller = new PlayerBackupCloudPreviewController();
    await expect(
      controller.load('account-a', async () => ({
        account: { id: 'account-a' },
        characters: [
          {
            legacyId: 'hero-1',
            name: 'Hero',
            state: 'identical',
            row: null,
            decoded: null,
          },
        ],
        onlineOnly: [],
      }))
    ).resolves.toBe(true);
    expect(controller.snapshot()).toMatchObject({
      accountId: 'account-a',
      loading: false,
    });
    expect(controller.snapshot().characters).toEqual([
      {
        legacyId: 'hero-1',
        name: 'Hero',
        state: 'identical',
        row: null,
        decoded: null,
      },
    ]);
  });

  it('discards a successful load whose result belongs to a different account', async () => {
    const controller = new PlayerBackupCloudPreviewController();
    await expect(
      controller.load('account-a', async () => ({
        account: { id: 'account-b' },
        characters: [
          {
            legacyId: 'hero-1',
            name: 'Hero',
            state: 'identical',
            row: null,
            decoded: null,
          },
        ],
        onlineOnly: [],
      }))
    ).resolves.toBe(false);
    expect(controller.snapshot().characters).toEqual([]);
  });

  it('clears loading and rethrows when the current-account load fails', async () => {
    const controller = new PlayerBackupCloudPreviewController();
    await expect(
      controller.load('account-a', async () => {
        throw new Error('preview failed');
      })
    ).rejects.toThrow('preview failed');
    expect(controller.snapshot()).toEqual({
      accountId: 'account-a',
      characters: [],
      onlineOnly: [],
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

describe('shared cloud row comparison', () => {
  const HERO_1 = {
    id: 'hero-1',
    name: 'Hero',
    characterData: { id: 'hero-1' },
  };
  const HERO_2 = {
    id: 'hero-2',
    name: 'Duplicated',
    characterData: { id: 'hero-2' },
  };
  const HERO_3 = {
    id: 'hero-3',
    name: 'Future',
    characterData: { id: 'hero-3' },
  };
  const HERO_4 = {
    id: 'hero-4',
    name: 'Removed',
    characterData: { id: 'hero-4' },
  };
  const HERO_6 = {
    id: 'hero-6',
    name: 'Local only',
    characterData: { id: 'hero-6' },
  };
  const HERO_7 = {
    id: 'hero-7',
    name: 'Older locally',
    characterData: { id: 'hero-7', revision: 1 },
  };
  const HERO_8 = {
    id: 'hero-8',
    name: 'Drifted locally',
    characterData: { id: 'hero-8', revision: 4 },
  };

  const rows = [
    row(),
    row({ id: 'cloud-2a', legacy_client_id: 'hero-2' }),
    row({ id: 'cloud-2b', legacy_client_id: 'hero-2' }),
    row({ id: 'cloud-3', legacy_client_id: 'hero-3', schema_version: 99 }),
    row({
      id: 'cloud-4',
      legacy_client_id: 'hero-4',
      deleted_at: '2026-08-26T01:00:00.000Z',
    }),
    row({ id: 'cloud-5', legacy_client_id: 'hero-5' }),
    row({
      id: 'cloud-7',
      legacy_client_id: 'hero-7',
      client_revision: 9,
      payload: { id: 'hero-7', name: 'Cloud', characterData: { id: 'hero-7' } },
    }),
    row({
      id: 'cloud-8',
      legacy_client_id: 'hero-8',
      client_revision: 2,
      payload: { id: 'hero-8', name: 'Cloud', characterData: { id: 'hero-8' } },
    }),
  ];
  const localCharacters = [
    HERO_1,
    HERO_2,
    HERO_3,
    HERO_4,
    HERO_6,
    HERO_7,
    HERO_8,
  ];

  it('produces exactly the classification previewPlayerBackupCloud publishes', async () => {
    const preview = await previewPlayerBackupCloud({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: 'account-a' } } }),
      },
      gateway: { list: vi.fn().mockResolvedValue(rows) },
      localCharacters,
    });

    const compared = await compareCloudRows(rows, localCharacters);

    expect(compared.characters).toEqual(preview.characters);
    expect(compared.onlineOnly).toEqual(preview.onlineOnly);
    expect(compared.characters.map(entry => entry.state)).toEqual([
      'identical',
      'unavailable',
      'future',
      'removed',
      'missing',
      'newer',
      'different',
    ]);
    expect(compared.onlineOnly.map(entry => entry.row.id)).toEqual(['cloud-5']);
  });

  it('classifies a local character as unavailable when decode throws', async () => {
    const decode = vi
      .spyOn(characterCloudCodec, 'decodeCharacterCloudRow')
      .mockRejectedValue(new Error('corrupt row'));
    try {
      const compared = await compareCloudRows([row()], [HERO_1]);
      expect(compared.characters).toEqual([
        {
          legacyId: 'hero-1',
          name: 'Hero',
          state: 'unavailable',
          row: null,
          decoded: null,
        },
      ]);
    } finally {
      decode.mockRestore();
    }
  });

  it('refuses to classify a local character that has no identity', async () => {
    await expect(compareCloudRows([], [null])).rejects.toMatchObject({
      category: 'failed',
    });
    await expect(compareCloudRows([], [{}])).rejects.toMatchObject({
      category: 'failed',
    });
  });

  it('resolves identity from characterData and names unnamed local characters', async () => {
    const compared = await compareCloudRows(
      [],
      [{ characterData: { id: 'hero-unnamed' } }]
    );
    expect(compared.characters).toEqual([
      {
        legacyId: 'hero-unnamed',
        name: 'Unnamed character',
        state: 'missing',
        row: null,
        decoded: null,
      },
    ]);
  });

  it('treats a missing local revision as zero when the cloud copy is newer', async () => {
    const compared = await compareCloudRows(
      [
        row({
          id: 'cloud-9',
          legacy_client_id: 'hero-9',
          client_revision: 5,
          payload: {
            id: 'hero-9',
            name: 'Cloud',
            characterData: { id: 'hero-9' },
          },
        }),
      ],
      [{ id: 'hero-9', name: 'Local', characterData: { id: 'hero-9' } }]
    );
    expect(compared.characters[0]?.state).toBe('newer');
  });
});

describe('createBrowserPlayerBackupCloudPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when neither read capability is enabled', () => {
    const createClient = vi.spyOn(
      supabaseBrowser,
      'createSupabaseBrowserClient'
    );
    expect(
      createBrowserPlayerBackupCloudPreview({
        manualRead: false,
        automaticRead: false,
      })
    ).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns null when no browser client is available', () => {
    vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue(
      null
    );
    expect(
      createBrowserPlayerBackupCloudPreview({
        manualRead: true,
        automaticRead: false,
      })
    ).toBeNull();
  });

  it('wires auth and the list gateway when a client exists', () => {
    const client = { auth: { getUser: vi.fn() } };
    const gateway = { list: vi.fn() };
    vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue(
      client as never
    );
    vi.spyOn(
      characterCloudGateway,
      'createSupabaseCharacterCloudGateway'
    ).mockReturnValue(gateway as never);

    expect(
      createBrowserPlayerBackupCloudPreview({
        manualRead: false,
        automaticRead: true,
      })
    ).toEqual({ auth: client.auth, gateway });
    expect(
      characterCloudGateway.createSupabaseCharacterCloudGateway
    ).toHaveBeenCalledWith(client);
  });
});
