import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openExistingRollkeeperDatabase,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import { encodeCharacterCloudPayload } from '@/lib/supabase/characterCloudCodec';
import type { CharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';
import { createMemoryCharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';
import type {
  CharacterCloudGateway,
  PutCharacterRequest,
} from '@/lib/supabase/manualCharacterCloudService';
import { ManualCharacterCloudService } from '@/lib/supabase/manualCharacterCloudService';

import { PlayerBackupReadOnlyCoordinator } from '../playerBackupCoordinator';
import {
  derivePlayerBackupRunResult,
  executePlayerBackupManualRun,
} from '../playerBackupOnlineExecution';
import type { PlayerBackupExclusiveLockProvider } from '../playerBackupRunFence';
import type { PlayerBackupRunV1 } from '../playerBackupRunRepository';
import {
  advancePlayerBackupRunToLocalReady,
  readActivePlayerBackupRun,
} from '../playerBackupRunRepository';

/**
 * Minimal fixtures for this file only. `playerBackupOnlineExecution.test.ts`
 * owns the exhaustive execution-path coverage; this file proves account
 * isolation and passivity and must not depend on (or edit) that file.
 */

const CONFIRMED_AT = '2026-08-26T10:00:00.000Z';
const NOW = '2026-08-26T11:00:00.000Z';

const HERO = {
  id: 'hero-shared',
  name: 'Hero Shared',
  characterData: { id: 'hero-shared', revision: 5 },
};
const HERO_OLD = {
  id: 'hero-shared',
  name: 'Hero Shared',
  characterData: { id: 'hero-shared', revision: 4 },
};
const HERO_FUTURE = {
  id: 'hero-future',
  name: 'Hero Future',
  characterData: { id: 'hero-future', revision: 2 },
};
const ROSTER: Record<string, unknown> = {
  'hero-shared': HERO,
  'hero-future': HERO_FUTURE,
};

function cloudRow(options: {
  cloudId: string;
  legacyId: string;
  character: unknown;
  clientRevision: number;
  schemaVersion?: number;
}): CharacterCloudRow {
  return {
    id: options.cloudId,
    legacy_client_id: options.legacyId,
    name: 'Cloud copy',
    payload: encodeCharacterCloudPayload(options.character),
    schema_version: options.schemaVersion ?? 1,
    client_revision: options.clientRevision,
    server_version: 3,
    deleted_at: null,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
  };
}

class ImmediateLocks implements PlayerBackupExclusiveLockProvider {
  async request<T>(
    _name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> {
    return callback();
  }
}

function buildRun(
  accountId: string,
  overrides: Partial<PlayerBackupRunV1>
): PlayerBackupRunV1 {
  const selected = overrides.selectedCharacterIds ?? ['hero-shared'];
  return {
    version: 1,
    runId: 'run-a',
    accountId,
    namespace: `user:${accountId}`,
    mode: 'one-time',
    eligibleCharacterIds: selected,
    selectedCharacterIds: selected,
    clearedCharacterIds: [],
    futureDefault: 'off',
    broadSafetyReceipt: {
      runId: 'safety-a',
      manifestHash: 'manifest-a',
      createdAt: '2026-08-26T09:00:00.000Z',
      protectedEntryDigest: 'protected-a',
    },
    authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
    confirmedAt: CONFIRMED_AT,
    stage: 'confirmed',
    characterCheckpoints: Object.fromEntries(
      selected.map(id => [id, { localPreparation: 'pending' as const }])
    ),
    ...overrides,
  };
}

/** Seeds one account's active run, independent of any other account's. */
async function seedRun(
  accountId: string,
  options: {
    runId: string;
    stage?: 'confirmed' | 'local-ready';
    selected?: string[];
  }
): Promise<PlayerBackupRunV1> {
  const stage = options.stage ?? 'local-ready';
  const database = await openRollkeeperDatabase({ factory: indexedDB });
  try {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    const run = buildRun(accountId, {
      runId: options.runId,
      selectedCharacterIds: options.selected ?? ['hero-shared'],
    });
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: null,
      run,
      confirmed: true,
    });
    if (stage !== 'local-ready') return run;
    return await advancePlayerBackupRunToLocalReady(database, {
      accountId,
      expectedActiveRunId: run.runId,
      authority: {
        kind: 'indexedDB',
        namespace: 'guest',
        family: 'character',
        generation: 'generation-a',
        epoch: 1,
      },
      selectionAuthorizedAt: CONFIRMED_AT,
      verifiedAt: '2026-08-26T10:30:00.000Z',
    });
  } finally {
    database.close();
  }
}

function createGatewayDouble(
  seed: readonly CharacterCloudRow[] = []
): CharacterCloudGateway {
  const rows = new Map<string, CharacterCloudRow>(
    seed.map(row => [row.id, row])
  );
  return {
    put: vi.fn(async (request: PutCharacterRequest) => {
      const current = rows.get(request.cloudId);
      const serverVersion = current ? current.server_version + 1 : 1;
      rows.set(request.cloudId, {
        id: request.cloudId,
        legacy_client_id: request.legacyId,
        name: request.name,
        payload: request.payload,
        schema_version: request.schemaVersion,
        client_revision: request.clientRevision,
        server_version: serverVersion,
        deleted_at: null,
        created_at: '2026-08-26T00:00:00.000Z',
        updated_at: '2026-08-26T00:00:00.000Z',
      });
      return {
        status: 'success' as const,
        characterId: request.cloudId,
        serverVersion,
      };
    }),
    fetch: vi.fn(async (cloudId: string) => {
      const row = rows.get(cloudId);
      return row ? structuredClone(row) : null;
    }),
    list: vi.fn(async () =>
      [...rows.values()].map(row => structuredClone(row))
    ),
    archive: vi.fn(),
    restore: vi.fn(),
  };
}

function createSpyLinks(): CharacterCloudLinkRepository {
  const inner = createMemoryCharacterCloudLinkRepository();
  return {
    get: vi.fn(inner.get),
    save: vi.fn(inner.save),
    remove: vi.fn(inner.remove),
  };
}

async function readCheckpoints(accountId: string, runId: string) {
  const run = await readActivePlayerBackupRun({
    accountId,
    factory: indexedDB,
  });
  expect(run?.runId).toBe(runId);
  return run!.characterCheckpoints;
}

async function readStore(
  name: 'documents' | 'outbox' | 'conflicts' | 'quarantine'
): Promise<unknown[]> {
  const database = await openExistingRollkeeperDatabase({ factory: indexedDB });
  if (!database) throw new Error('database is missing');
  try {
    const transaction = database.transaction(name, 'readonly');
    const records = await requestResult(transaction.objectStore(name).getAll());
    await transactionComplete(transaction);
    return records as unknown[];
  } finally {
    database.close();
  }
}

function execute(options: {
  accountId: string;
  runId: string;
  links: CharacterCloudLinkRepository;
  gateway: CharacterCloudGateway;
  cloudId: string;
  mutationId: string;
}) {
  const service = new ManualCharacterCloudService(
    options.gateway,
    options.links,
    () => {
      throw new Error('the service must not mint a cloud identity');
    }
  );
  return executePlayerBackupManualRun({
    factory: indexedDB,
    locks: new ImmediateLocks(),
    accountId: options.accountId,
    expectedActiveRunId: options.runId,
    service,
    links: options.links,
    gateway: options.gateway,
    characters: { get: (legacyId: string) => ROSTER[legacyId] ?? null },
    generateCloudId: () => options.cloudId,
    generateMutationId: () => options.mutationId,
    now: () => NOW,
  });
}

describe('player backup account isolation and passivity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('keeps account A and B runs, links, documents, work and results isolated across a switch', async () => {
    await seedRun('account-a', { runId: 'run-a' });
    await seedRun('account-b', { runId: 'run-b' });

    const links = createMemoryCharacterCloudLinkRepository();
    const gatewayA = createGatewayDouble();
    const gatewayB = createGatewayDouble();

    const resultA = await execute({
      accountId: 'account-a',
      runId: 'run-a',
      links,
      gateway: gatewayA,
      cloudId: 'cloud-a-1',
      mutationId: 'mutation-a-1',
    });

    expect(resultA.protected).toEqual(['hero-shared']);
    expect(resultA.accountId).toBe('account-a');
    expect(links.get('account-a', 'hero-shared')).toMatchObject({
      cloudId: 'cloud-a-1',
    });
    expect(links.get('account-b', 'hero-shared')).toBeNull();
    expect(gatewayB.put).not.toHaveBeenCalled();
    expect(gatewayB.list).not.toHaveBeenCalled();

    const pendingB = await derivePlayerBackupRunResult({
      factory: indexedDB,
      accountId: 'account-b',
      expectedActiveRunId: 'run-b',
      links,
    });
    expect(pendingB.pending).toEqual(['hero-shared']);
    expect(pendingB.protected).toEqual([]);
    expect(pendingB.complete).toBe(false);

    const checkpointsAAfterA = await readCheckpoints('account-a', 'run-a');

    const resultB = await execute({
      accountId: 'account-b',
      runId: 'run-b',
      links,
      gateway: gatewayB,
      cloudId: 'cloud-b-1',
      mutationId: 'mutation-b-1',
    });

    expect(resultB.protected).toEqual(['hero-shared']);
    expect(resultB.accountId).toBe('account-b');
    expect(links.get('account-b', 'hero-shared')).toMatchObject({
      cloudId: 'cloud-b-1',
    });
    // Account A's link is untouched by B's execution.
    expect(links.get('account-a', 'hero-shared')).toMatchObject({
      cloudId: 'cloud-a-1',
    });
    expect(gatewayA.put).toHaveBeenCalledTimes(1);
    expect(gatewayB.put).toHaveBeenCalledTimes(1);

    const checkpointsAAfterB = await readCheckpoints('account-a', 'run-a');
    expect(checkpointsAAfterB).toEqual(checkpointsAAfterA);
  });

  it('seeds conflicts and quarantine only inside the executing account namespace', async () => {
    await seedRun('account-a', {
      runId: 'run-a',
      selected: ['hero-shared', 'hero-future'],
    });
    await seedRun('account-b', { runId: 'run-b' });

    const links = createMemoryCharacterCloudLinkRepository();
    const gatewayA = createGatewayDouble([
      cloudRow({
        cloudId: 'cloud-a-existing',
        legacyId: 'hero-shared',
        character: HERO_OLD,
        clientRevision: 4,
      }),
      cloudRow({
        cloudId: 'cloud-a-future',
        legacyId: 'hero-future',
        character: HERO_FUTURE,
        clientRevision: 2,
        schemaVersion: 99,
      }),
    ]);
    const gatewayB = createGatewayDouble();

    const resultA = await execute({
      accountId: 'account-a',
      runId: 'run-a',
      links,
      gateway: gatewayA,
      cloudId: 'cloud-a-1',
      mutationId: 'mutation-a-1',
    });

    expect(resultA.needsAttention).toEqual(['hero-shared']);
    expect(resultA.heldAside).toEqual(['hero-future']);
    expect(gatewayA.put).not.toHaveBeenCalled();
    expect(gatewayB.list).not.toHaveBeenCalled();
    for (const name of [
      'conflicts',
      'quarantine',
      'documents',
      'outbox',
    ] as const) {
      const records = (await readStore(name)) as { namespace: string }[];
      expect(records).not.toHaveLength(0);
      expect(
        records.filter(record => record.namespace !== 'user:account-a')
      ).toEqual([]);
    }

    // Account B keeps an untouched, still-pending run and no link of its own.
    expect(links.get('account-b', 'hero-shared')).toBeNull();
    const checkpointsB = await readCheckpoints('account-b', 'run-b');
    expect(checkpointsB['hero-shared']).toEqual({ localPreparation: 'ready' });
    const derivedB = await derivePlayerBackupRunResult({
      factory: indexedDB,
      accountId: 'account-b',
      expectedActiveRunId: 'run-b',
      links,
    });
    expect(derivedB.pending).toEqual(['hero-shared']);
  });

  it('leaves unrelated RollKeeper keys and DM-family records unchanged', async () => {
    localStorage.setItem('rollkeeper-dm-data', '{"dm":"unchanged"}');
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[{"id":"hero-shared"}]},"version":1}'
    );
    await seedRun('account-a', { runId: 'run-a' });

    const dmFamilyRecord = {
      key: 'dm-family:unchanged',
      value: { campaigns: ['c-1'] },
    };
    const seedDatabase = await openRollkeeperDatabase({ factory: indexedDB });
    try {
      const transaction = seedDatabase.transaction('meta', 'readwrite');
      transaction.objectStore('meta').put(dmFamilyRecord);
      await transactionComplete(transaction);
    } finally {
      seedDatabase.close();
    }

    const localStorageBefore = Object.fromEntries(
      Array.from(
        { length: localStorage.length },
        (_, index) => localStorage.key(index)!
      ).map(key => [key, localStorage.getItem(key)])
    );

    const links = createMemoryCharacterCloudLinkRepository();
    const gateway = createGatewayDouble();
    await execute({
      accountId: 'account-a',
      runId: 'run-a',
      links,
      gateway,
      cloudId: 'cloud-a-1',
      mutationId: 'mutation-a-1',
    });

    const localStorageAfter = Object.fromEntries(
      Array.from(
        { length: localStorage.length },
        (_, index) => localStorage.key(index)!
      ).map(key => [key, localStorage.getItem(key)])
    );
    expect(localStorageAfter).toEqual(localStorageBefore);

    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    try {
      const transaction = database!.transaction('meta', 'readonly');
      const record = await requestResult(
        transaction.objectStore('meta').get('dm-family:unchanged')
      );
      await transactionComplete(transaction);
      expect(record).toEqual(dmFamilyRecord);
    } finally {
      database?.close();
    }
  });

  it('makes no mutation from passive discovery', async () => {
    await seedRun('account-a', { runId: 'run-a', stage: 'confirmed' });
    const links = createSpyLinks();

    const discovered = await readActivePlayerBackupRun({
      accountId: 'account-a',
      factory: indexedDB,
    });
    expect(discovered).toMatchObject({ runId: 'run-a', stage: 'confirmed' });

    const derived = await derivePlayerBackupRunResult({
      factory: indexedDB,
      accountId: 'account-a',
      expectedActiveRunId: 'run-a',
      links,
    });
    expect(derived.pending).toEqual(['hero-shared']);
    expect(derived.complete).toBe(false);

    const coordinator = new PlayerBackupReadOnlyCoordinator();
    coordinator.changeAccount('account-a');
    const viaCoordinator = await coordinator.discoverRun(indexedDB);
    expect(viaCoordinator).toMatchObject({
      runId: 'run-a',
      stage: 'confirmed',
    });

    expect(links.save).not.toHaveBeenCalled();
    expect(links.remove).not.toHaveBeenCalled();
    await expect(readStore('documents')).resolves.toEqual([]);
    await expect(readStore('outbox')).resolves.toEqual([]);
  });
});
