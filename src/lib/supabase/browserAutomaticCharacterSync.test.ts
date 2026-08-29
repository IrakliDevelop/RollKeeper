import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readCharacterAuthority } from '@/lib/indexeddb/characterAuthority';
import { characterCutoverSelectionKey } from '@/lib/indexeddb/characterCutoverSelection';
import { deleteRollkeeperDatabaseForTests } from '@/lib/indexeddb/localDatabase';

import { createSupabaseBrowserClient } from './browser';
import {
  createBrowserAutomaticCharacterSync,
  subscribeBrowserAutomaticCharacterAccountChanges,
} from './browserAutomaticCharacterSync';
import type { AutomaticCharacterSyncWorker as AutomaticCharacterSyncWorkerType } from './automaticCharacterSyncWorker';
import { createSupabaseCharacterCloudGateway } from './characterCloudGateway';

vi.mock('./browser', () => ({ createSupabaseBrowserClient: vi.fn() }));
vi.mock('@/lib/indexeddb/characterAuthority', () => ({
  readCharacterAuthority: vi.fn(),
}));
vi.mock('./characterCloudGateway', async importOriginal => {
  const actual =
    await importOriginal<typeof import('./characterCloudGateway')>();
  return { ...actual, createSupabaseCharacterCloudGateway: vi.fn() };
});

const workerOptionsCapture = vi.hoisted(() => ({
  current: null as
    | ConstructorParameters<typeof AutomaticCharacterSyncWorkerType>[0]
    | null,
}));

vi.mock('./automaticCharacterSyncWorker', async importOriginal => {
  const actual =
    await importOriginal<typeof import('./automaticCharacterSyncWorker')>();
  class RecordingAutomaticCharacterSyncWorker extends actual.AutomaticCharacterSyncWorker {
    constructor(
      options: ConstructorParameters<
        typeof actual.AutomaticCharacterSyncWorker
      >[0]
    ) {
      workerOptionsCapture.current = options;
      super(options);
    }
  }
  return {
    ...actual,
    AutomaticCharacterSyncWorker: RecordingAutomaticCharacterSyncWorker,
  };
});

const selection = {
  version: 1,
  namespace: 'guest',
  family: 'character',
  selectedAt: '2026-02-01T00:00:00.000Z',
  activatedEpoch: 1,
  activatedGeneration: 'generation-a',
};

const character = (id: string) => ({
  id,
  name: id,
  createdAt: '2026-02-01T00:00:00.000Z',
  characterData: { id, name: id, revision: 1 },
});

describe('browser automatic character sync authority routing', () => {
  const originalCutoverFlag =
    process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED;
  const gateway = {
    put: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    fetch: vi.fn(),
    list: vi.fn(async () => []),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED = 'true';
    localStorage.clear();
    vi.mocked(createSupabaseBrowserClient).mockReset();
    vi.mocked(readCharacterAuthority).mockResolvedValue({
      namespace: 'guest',
      family: 'character',
      authority: 'indexedDB',
      epoch: 1,
      generation: 'generation-a',
      committedAt: '2026-02-01T00:00:00.000Z',
    });
    vi.mocked(createSupabaseCharacterCloudGateway).mockReturnValue(gateway);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await deleteRollkeeperDatabaseForTests(indexedDB);
    if (originalCutoverFlag === undefined) {
      delete process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED =
        originalCutoverFlag;
    }
  });

  it('does not initialize auth, IndexedDB, or cloud without explicit local cutover selection', async () => {
    await expect(createBrowserAutomaticCharacterSync()).resolves.toBeNull();
    expect(createSupabaseBrowserClient).not.toHaveBeenCalled();
    expect(readCharacterAuthority).not.toHaveBeenCalled();
    expect(createSupabaseCharacterCloudGateway).not.toHaveBeenCalled();
  });

  it('does not let automatic sync silently activate a disabled IndexedDB cutover', async () => {
    localStorage.setItem(
      characterCutoverSelectionKey('guest'),
      JSON.stringify(selection)
    );
    delete process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED;
    await expect(createBrowserAutomaticCharacterSync()).resolves.toBeNull();
    const stop = subscribeBrowserAutomaticCharacterAccountChanges(vi.fn());
    stop();
    expect(createSupabaseBrowserClient).not.toHaveBeenCalled();
    expect(readCharacterAuthority).not.toHaveBeenCalled();
  });

  it('subscribes to account identity only for selected local profiles and releases the listener', () => {
    const listener = vi.fn();
    const disabledStop =
      subscribeBrowserAutomaticCharacterAccountChanges(listener);
    expect(disabledStop).toEqual(expect.any(Function));
    disabledStop();
    expect(createSupabaseBrowserClient).not.toHaveBeenCalled();

    localStorage.setItem(
      characterCutoverSelectionKey('guest'),
      JSON.stringify(selection)
    );
    const unsubscribe = vi.fn();
    let authListener:
      | ((_event: string, session: { user: { id: string } } | null) => void)
      | undefined;
    vi.mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        onAuthStateChange: vi.fn(callback => {
          authListener = callback;
          return { data: { subscription: { unsubscribe } } };
        }),
      },
    } as never);
    const stop = subscribeBrowserAutomaticCharacterAccountChanges(listener);
    authListener?.('SIGNED_IN', { user: { id: 'account-a' } });
    authListener?.('SIGNED_OUT', null);
    expect(listener).toHaveBeenNthCalledWith(1, 'account-a');
    expect(listener).toHaveBeenNthCalledWith(2, null);
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('stops before persistence or cloud when client configuration or authentication is unavailable', async () => {
    localStorage.setItem(
      characterCutoverSelectionKey('guest'),
      JSON.stringify(selection)
    );
    vi.mocked(createSupabaseBrowserClient).mockReturnValueOnce(null);
    const unconfiguredStop = subscribeBrowserAutomaticCharacterAccountChanges(
      vi.fn()
    );
    unconfiguredStop();
    vi.mocked(createSupabaseBrowserClient).mockReturnValueOnce(null);
    await expect(createBrowserAutomaticCharacterSync()).resolves.toBeNull();
    expect(readCharacterAuthority).not.toHaveBeenCalled();

    vi.mocked(createSupabaseBrowserClient).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: new Error('expired'),
        })),
      },
    } as never);
    await expect(createBrowserAutomaticCharacterSync()).resolves.toBeNull();
    expect(readCharacterAuthority).not.toHaveBeenCalled();
    expect(createSupabaseCharacterCloudGateway).not.toHaveBeenCalled();
  });

  it('restores the isolated account runtime from the stored session when getUser is offline', async () => {
    localStorage.setItem(
      characterCutoverSelectionKey('guest'),
      JSON.stringify(selection)
    );
    vi.mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: new TypeError('Failed to fetch'),
        })),
        getSession: vi.fn(async () => ({
          data: {
            session: {
              user: { id: 'account-a', email: 'synthetic@localhost' },
            },
          },
          error: null,
        })),
      },
    } as never);

    await expect(createBrowserAutomaticCharacterSync()).resolves.toMatchObject({
      accountId: 'account-a',
      accountLabel: 'synthetic@localhost',
      indexedDbPrimary: true,
    });
  });

  it("starts from the wizard's account-scoped activated selection", async () => {
    const accountNamespace = 'user:account-a' as const;
    localStorage.setItem(
      characterCutoverSelectionKey(accountNamespace),
      JSON.stringify({ ...selection, namespace: accountNamespace })
    );
    vi.mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: { id: 'account-a', email: 'synthetic@localhost' },
          },
          error: null,
        })),
      },
    } as never);
    vi.mocked(readCharacterAuthority).mockResolvedValueOnce({
      namespace: accountNamespace,
      family: 'character',
      authority: 'indexedDB',
      epoch: 1,
      generation: 'generation-a',
      committedAt: '2026-02-01T00:00:00.000Z',
    });

    const context = await createBrowserAutomaticCharacterSync();

    expect(context).toMatchObject({
      accountId: 'account-a',
      indexedDbPrimary: true,
    });
    expect(readCharacterAuthority).toHaveBeenCalledWith(
      expect.anything(),
      accountNamespace
    );
    context!.close();
  });

  it('keeps the automatic runtime disabled when the offline session cannot be read', async () => {
    localStorage.setItem(
      characterCutoverSelectionKey('guest'),
      JSON.stringify(selection)
    );
    vi.mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: new TypeError('Failed to fetch'),
        })),
        getSession: vi.fn(async () => {
          throw new Error('Session storage unavailable');
        }),
      },
    } as never);

    await expect(createBrowserAutomaticCharacterSync()).resolves.toBeNull();
    expect(readCharacterAuthority).not.toHaveBeenCalled();
    expect(createSupabaseCharacterCloudGateway).not.toHaveBeenCalled();
  });

  it('restores from an object-shaped offline error without requiring BroadcastChannel', async () => {
    localStorage.setItem(
      characterCutoverSelectionKey('guest'),
      JSON.stringify(selection)
    );
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: { message: 'Network request failed' },
        })),
        getSession: vi.fn(async () => ({
          data: {
            session: { user: { id: 'account-a', email: null } },
          },
          error: null,
        })),
      },
    } as never);

    const context = await createBrowserAutomaticCharacterSync();
    expect(context).toMatchObject({
      accountId: 'account-a',
      accountLabel: 'Signed-in account',
    });
    context!.close();
  });

  it('reports every durable status without making status reads a cloud operation', async () => {
    localStorage.setItem(
      characterCutoverSelectionKey('guest'),
      JSON.stringify(selection)
    );
    vi.mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'account-a', email: 'synthetic@localhost' } },
          error: null,
        })),
      },
    } as never);
    const context = await createBrowserAutomaticCharacterSync();
    expect(context).not.toBeNull();
    expect(context).toMatchObject({
      accountId: 'account-a',
      accountLabel: 'synthetic@localhost',
      indexedDbPrimary: true,
    });
    const ids = [
      'queued',
      'syncing',
      'offline',
      'auth',
      'failed',
      'paused',
      'conflict',
      'quarantine',
      'synced',
    ];
    for (const id of ids) {
      await context!.service.enableCharacter(character(id), {
        confirmed: true,
        targetAccountId: 'account-a',
      });
    }
    const work = await context!.repository.listOutbox('user:account-a');
    const byId = new Map(work.map(entry => [entry.legacyId, entry]));
    await context!.repository.updateWork(byId.get('syncing')!.mutationId, {
      state: 'inflight',
    });
    await context!.repository.updateWork(byId.get('offline')!.mutationId, {
      state: 'offline',
    });
    await context!.repository.updateWork(byId.get('auth')!.mutationId, {
      state: 'auth-required',
    });
    await context!.repository.updateWork(byId.get('failed')!.mutationId, {
      state: 'retry',
    });
    await context!.repository.pauseAggregate('user:account-a', 'paused');
    await context!.repository.preserveConflict(
      byId.get('conflict')!,
      { id: 'cloud-conflict' },
      '2026-02-02T00:00:00.000Z'
    );
    await context!.repository.quarantineCloudCandidate(
      'user:account-a',
      'quarantine',
      { id: 'unsafe' },
      'unsafe',
      '2026-02-02T00:00:00.000Z'
    );
    await context!.repository.acknowledge(
      byId.get('synced')!,
      'cloud-synced',
      2
    );

    await expect(
      context!.statuses([
        ...ids.map(character),
        { ...character('local'), createdAt: new Date('2026-02-01T00:00:00Z') },
      ])
    ).resolves.toEqual({
      queued: 'queued',
      syncing: 'syncing',
      offline: 'offline',
      auth: 'auth-required',
      failed: 'failed',
      paused: 'local-only',
      conflict: 'conflict',
      quarantine: 'quarantined',
      synced: 'synced',
      local: 'local-only',
    });
    expect(gateway.list).not.toHaveBeenCalled();
    await expect(context!.documents()).resolves.toHaveLength(ids.length);
    await context!.coordinator.start();
    expect(gateway.list).toHaveBeenCalled();
    context!.close();
  });

  it('keeps rolled-back local authority unselected and tolerates unavailable wake channels', async () => {
    localStorage.setItem(
      characterCutoverSelectionKey('guest'),
      JSON.stringify(selection)
    );
    vi.mocked(readCharacterAuthority).mockResolvedValue({
      namespace: 'guest',
      family: 'character',
      authority: 'localStorage',
      epoch: 2,
      rollbackGeneration: 'generation-a',
      committedAt: '2026-02-01T00:00:00.000Z',
    });
    vi.mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'account-a', email: null } },
          error: null,
        })),
      },
    } as never);
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('unavailable');
        }
      }
    );
    const context = await createBrowserAutomaticCharacterSync();
    expect(context).toMatchObject({
      accountLabel: 'Signed-in account',
      indexedDbPrimary: false,
    });
    await expect(
      context!.service.enableCharacter(character('blocked'), {
        confirmed: true,
        targetAccountId: 'account-a',
      })
    ).rejects.toThrow(/IndexedDB/i);
    expect(gateway.put).not.toHaveBeenCalled();
    context!.close();
  });

  describe('wizard-gated dispatch guard', () => {
    const originalWizardFlag =
      process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;

    beforeEach(() => {
      workerOptionsCapture.current = null;
      localStorage.setItem(
        characterCutoverSelectionKey('guest'),
        JSON.stringify(selection)
      );
      vi.mocked(createSupabaseBrowserClient).mockReturnValue({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: 'account-a', email: 'synthetic@localhost' } },
            error: null,
          })),
        },
      } as never);
    });

    afterEach(() => {
      if (originalWizardFlag === undefined) {
        delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
      } else {
        process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE =
          originalWizardFlag;
      }
    });

    it('passes a dispatchGuard to the worker when the wizard is visible', async () => {
      process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';

      const context = await createBrowserAutomaticCharacterSync();

      expect(context).not.toBeNull();
      expect(workerOptionsCapture.current).not.toBeNull();
      expect('dispatchGuard' in (workerOptionsCapture.current as object)).toBe(
        true
      );
      expect(workerOptionsCapture.current?.dispatchGuard).toEqual(
        expect.objectContaining({
          around: expect.any(Function),
          authorize: expect.any(Function),
        })
      );
      context!.close();
    });

    it('omits the dispatchGuard option entirely when the wizard is not visible', async () => {
      delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;

      const context = await createBrowserAutomaticCharacterSync();

      expect(context).not.toBeNull();
      expect(workerOptionsCapture.current).not.toBeNull();
      expect('dispatchGuard' in (workerOptionsCapture.current as object)).toBe(
        false
      );
      context!.close();
    });
  });
});
