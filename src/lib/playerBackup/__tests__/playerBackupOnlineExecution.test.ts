import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureDeviceBackup } from '@/lib/deviceRecovery';
import { AutomaticCharacterConflictService } from '@/lib/indexeddb/automaticCharacterConflictService';
import {
  IndexedDbAutomaticCharacterSyncRepository,
  type AutomaticCharacterConflict,
  type AutomaticCharacterOutboxEntry,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import { readCharacterAuthority } from '@/lib/indexeddb/characterAuthority';
import { characterCutoverSelectionKey } from '@/lib/indexeddb/characterCutoverSelection';
import {
  deleteRollkeeperDatabaseForTests,
  openExistingRollkeeperDatabase,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import { AutomaticCharacterSyncService } from '@/lib/supabase/automaticCharacterSyncService';
import { AutomaticCharacterSyncWorker } from '@/lib/supabase/automaticCharacterSyncWorker';
import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import {
  encodeCharacterCloudPayload,
  fingerprintCharacterPayload,
} from '@/lib/supabase/characterCloudCodec';
import { CharacterCloudGatewayError } from '@/lib/supabase/characterCloudGateway';
import type { CharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';
import { createMemoryCharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';
import type {
  CharacterCloudGateway,
  PutCharacterRequest,
} from '@/lib/supabase/manualCharacterCloudService';
import { ManualCharacterCloudService } from '@/lib/supabase/manualCharacterCloudService';

import { confirmPlayerBackupConsent } from '../playerBackupCoordinator';
import {
  createPlayerBackupDispatchGuard,
  startPlayerBackupOngoingWork,
} from '../playerBackupOngoingExecution';
import {
  derivePlayerBackupRunResult,
  executePlayerBackupManualRun,
} from '../playerBackupOnlineExecution';
import type { PlayerBackupExclusiveLockProvider } from '../playerBackupRunFence';
import {
  PlayerBackupLockUnavailableError,
  playerBackupAccountLockName,
} from '../playerBackupRunFence';
import type {
  PlayerBackupExecutionPath,
  PlayerBackupRunV1,
} from '../playerBackupRunRepository';
import {
  PlayerBackupRunReplacedError,
  advancePlayerBackupRunToLocalReady,
  playerBackupRunKey,
  readActivePlayerBackupRun,
} from '../playerBackupRunRepository';

const ACCOUNT = 'account-a';
const NAMESPACE = `user:${ACCOUNT}` as const;
const CONFIRMED_AT = '2026-08-26T10:00:00.000Z';
const NOW = '2026-08-26T11:00:00.000Z';
const LOCK_NAME = playerBackupAccountLockName(ACCOUNT);

const HERO_A = {
  id: 'hero-a',
  name: 'Hero A',
  characterData: { id: 'hero-a', revision: 5 },
};
const HERO_A_OLD = {
  id: 'hero-a',
  name: 'Hero A',
  characterData: { id: 'hero-a', revision: 4 },
};
const HERO_B = {
  id: 'hero-b',
  name: 'Hero B',
  characterData: { id: 'hero-b', revision: 2 },
};
const HERO_B_OLD = {
  id: 'hero-b',
  name: 'Hero B',
  characterData: { id: 'hero-b', revision: 1 },
};
/** Ongoing work reads the roster the automatic sync service reads. */
const CREATED_AT = '2026-08-01T00:00:00.000Z';
const ONGOING_HERO_A = { ...HERO_A, createdAt: CREATED_AT };
const HERO_C = {
  id: 'hero-c',
  name: 'Hero C',
  createdAt: CREATED_AT,
  characterData: { id: 'hero-c', revision: 3 },
};
const ONGOING_ROSTER: Record<string, unknown> = {
  'hero-a': ONGOING_HERO_A,
  'hero-b': { ...HERO_B, createdAt: CREATED_AT },
  'hero-c': HERO_C,
};

function fingerprint(character: unknown): Promise<string> {
  return fingerprintCharacterPayload(encodeCharacterCloudPayload(character));
}

function buildRun(overrides: Partial<PlayerBackupRunV1>): PlayerBackupRunV1 {
  const selected = overrides.selectedCharacterIds ?? ['hero-a'];
  const cleared = overrides.clearedCharacterIds ?? [];
  return {
    version: 1,
    runId: 'run-a',
    accountId: ACCOUNT,
    namespace: NAMESPACE,
    mode: 'one-time',
    eligibleCharacterIds: [...selected, ...cleared],
    selectedCharacterIds: selected,
    clearedCharacterIds: cleared,
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

async function seedRun(
  options: {
    runId?: string;
    mode?: 'one-time' | 'ongoing';
    executionPath?: PlayerBackupExecutionPath;
    stage?: 'confirmed' | 'local-ready';
    selected?: string[];
    cleared?: string[];
    expectedActiveRunId?: string | null;
  } = {}
): Promise<PlayerBackupRunV1> {
  const stage = options.stage ?? 'local-ready';
  const mode = options.mode ?? 'one-time';
  const database = await openRollkeeperDatabase({ factory: indexedDB });
  try {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    const run = buildRun({
      runId: options.runId ?? 'run-a',
      mode,
      futureDefault: mode === 'ongoing' ? 'on' : 'off',
      selectedCharacterIds: options.selected ?? ['hero-a'],
      clearedCharacterIds: options.cleared ?? [],
      ...(options.executionPath
        ? { executionPath: options.executionPath }
        : {}),
    });
    await preferences.applyConfirmedSelection({
      expectedActiveRunId: options.expectedActiveRunId ?? null,
      run,
      confirmed: true,
    });
    if (stage !== 'local-ready') return run;
    return await advancePlayerBackupRunToLocalReady(database, {
      accountId: ACCOUNT,
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

type FailMode = 'lost' | 'offline' | 'auth' | 'conflict';

interface GatewayDouble extends CharacterCloudGateway {
  rows: Map<string, CharacterCloudRow>;
  putRequests: PutCharacterRequest[];
  failNextPut: FailMode | null;
  failNextList: 'offline' | 'auth' | null;
  /** How many consecutive `list` calls `failNextList` covers. */
  failListCount: number;
  failNextFetch: 'offline' | 'auth' | null;
}

function gatewayError(mode: 'offline' | 'auth'): CharacterCloudGatewayError {
  return mode === 'offline'
    ? new CharacterCloudGatewayError('Network unavailable', 'offline')
    : new CharacterCloudGatewayError('Session expired', 'auth-required');
}

function createGatewayDouble(
  options: {
    events?: string[];
    onPut?: (request: PutCharacterRequest) => void;
  } = {}
): GatewayDouble {
  const rows = new Map<string, CharacterCloudRow>();
  const record = (name: string) => options.events?.push(name);
  const apply = (request: PutCharacterRequest): number => {
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
    return serverVersion;
  };
  const gateway: GatewayDouble = {
    rows,
    putRequests: [],
    failNextPut: null,
    failNextList: null,
    failListCount: 1,
    failNextFetch: null,
    put: vi.fn(async (request: PutCharacterRequest) => {
      record('put');
      gateway.putRequests.push(structuredClone(request));
      options.onPut?.(request);
      const mode = gateway.failNextPut;
      gateway.failNextPut = null;
      if (mode === 'offline' || mode === 'auth') throw gatewayError(mode);
      const current = rows.get(request.cloudId);
      if (mode === 'conflict') {
        if (current) current.server_version += 1;
        return {
          status: 'conflict' as const,
          characterId: request.cloudId,
          serverVersion: current?.server_version ?? 0,
        };
      }
      if (current && current.server_version !== request.expectedServerVersion) {
        return {
          status: 'conflict' as const,
          characterId: request.cloudId,
          serverVersion: current.server_version,
        };
      }
      const serverVersion = apply(request);
      if (mode === 'lost') throw new Error('response lost');
      return {
        status: 'success' as const,
        characterId: request.cloudId,
        serverVersion,
      };
    }),
    fetch: vi.fn(async (cloudId: string) => {
      record('fetch');
      const mode = gateway.failNextFetch;
      gateway.failNextFetch = null;
      if (mode) throw gatewayError(mode);
      const row = rows.get(cloudId);
      return row ? structuredClone(row) : null;
    }),
    list: vi.fn(async () => {
      record('list');
      const mode = gateway.failNextList;
      if (mode) {
        gateway.failListCount -= 1;
        if (gateway.failListCount <= 0) {
          gateway.failNextList = null;
          gateway.failListCount = 1;
        }
        throw gatewayError(mode);
      }
      return [...rows.values()].map(row => structuredClone(row));
    }),
    archive: vi.fn(),
    restore: vi.fn(),
  };
  return gateway;
}

async function seedRow(
  gateway: GatewayDouble,
  options: {
    cloudId: string;
    character: unknown;
    legacyId: string;
    serverVersion?: number;
    clientRevision?: number;
    schemaVersion?: number;
    deletedAt?: string | null;
  }
): Promise<CharacterCloudRow> {
  const row: CharacterCloudRow = {
    id: options.cloudId,
    legacy_client_id: options.legacyId,
    name: 'Cloud copy',
    payload: encodeCharacterCloudPayload(options.character),
    schema_version: options.schemaVersion ?? 1,
    client_revision: options.clientRevision ?? 1,
    server_version: options.serverVersion ?? 1,
    deleted_at: options.deletedAt ?? null,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
  };
  gateway.rows.set(row.id, row);
  return row;
}

class RecordingLocks implements PlayerBackupExclusiveLockProvider {
  readonly events: string[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private barrier: Promise<void> | null = null;
  private holdWaiters: Array<() => void> = [];

  hold(): () => void {
    let release = () => {};
    this.barrier = new Promise<void>(resolve => {
      release = resolve;
    });
    return () => {
      this.barrier = null;
      release();
    };
  }

  whenHolding(): Promise<void> {
    return new Promise(resolve => this.holdWaiters.push(resolve));
  }

  async request<T>(
    name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> {
    const started = this.chain.then(async () => {
      this.events.push(`acquire:${name}`);
      try {
        return await callback();
      } finally {
        const barrier = this.barrier;
        if (barrier) {
          this.holdWaiters.splice(0).forEach(resolve => resolve());
          await barrier;
        }
        this.events.push(`release:${name}`);
      }
    });
    this.chain = started.then(
      () => undefined,
      () => undefined
    );
    return started as Promise<T>;
  }
}

function createIdentities() {
  let cloud = 0;
  let mutation = 0;
  return {
    generateCloudId: vi.fn(() => `cloud-${++cloud}`),
    generateMutationId: vi.fn(() => `mutation-${++mutation}`),
  };
}

function createHarness(
  options: {
    roster?: Record<string, unknown>;
    events?: string[];
    onPut?: (request: PutCharacterRequest) => void;
    links?: CharacterCloudLinkRepository;
    locks?: PlayerBackupExclusiveLockProvider | null;
  } = {}
) {
  const roster: Record<string, unknown> = options.roster ?? {
    'hero-a': HERO_A,
    'hero-b': HERO_B,
  };
  const links = options.links ?? createMemoryCharacterCloudLinkRepository();
  const gateway = createGatewayDouble({
    ...(options.events ? { events: options.events } : {}),
    ...(options.onPut ? { onPut: options.onPut } : {}),
  });
  const service = new ManualCharacterCloudService(gateway, links, () => {
    throw new Error('the service must not mint a cloud identity');
  });
  const identities = createIdentities();
  const locks =
    options.locks === undefined ? new RecordingLocks() : options.locks;
  const execute = (runId = 'run-a') =>
    executePlayerBackupManualRun({
      factory: indexedDB,
      locks,
      accountId: ACCOUNT,
      expectedActiveRunId: runId,
      service,
      links,
      gateway,
      characters: { get: (legacyId: string) => roster[legacyId] ?? null },
      generateCloudId: identities.generateCloudId,
      generateMutationId: identities.generateMutationId,
      now: () => NOW,
    });
  return { gateway, links, service, identities, locks, execute, roster };
}

async function readCheckpoints(runId = 'run-a') {
  const run = await readActivePlayerBackupRun({
    accountId: ACCOUNT,
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

class ImmediateLocks implements PlayerBackupExclusiveLockProvider {
  async request<T>(
    _name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> {
    return callback();
  }
}

/** Runs `beforeLock` once, immediately before the first fenced section. */
function hookedLocks(
  beforeLock: () => Promise<void>
): PlayerBackupExclusiveLockProvider {
  let fired = false;
  return {
    async request<T>(
      _name: string,
      _options: { mode: 'exclusive' },
      callback: () => Promise<T> | T
    ): Promise<T> {
      if (!fired) {
        fired = true;
        await beforeLock();
      }
      return callback();
    },
  };
}

async function setCharacterPolicy(
  legacyId: string,
  enabled: boolean
): Promise<void> {
  const database = await openRollkeeperDatabase({ factory: indexedDB });
  try {
    await new AutomaticCharacterSyncPreferences(database).setCharacter(
      NAMESPACE,
      legacyId,
      enabled
    );
  } finally {
    database.close();
  }
}

function createOngoingHarness(
  options: {
    roster?: Record<string, unknown>;
    locks?: PlayerBackupExclusiveLockProvider | null;
    beforeLock?: () => Promise<void>;
    gateway?: GatewayDouble;
  } = {}
) {
  const roster = options.roster ?? ONGOING_ROSTER;
  const identities = createIdentities();
  const gateway = options.gateway ?? createGatewayDouble();
  const locks =
    options.locks !== undefined
      ? options.locks
      : options.beforeLock
        ? hookedLocks(options.beforeLock)
        : new ImmediateLocks();
  const start = (runId = 'run-a') =>
    startPlayerBackupOngoingWork({
      factory: indexedDB,
      locks,
      accountId: ACCOUNT,
      expectedActiveRunId: runId,
      gateway,
      characters: { get: (legacyId: string) => roster[legacyId] ?? null },
      generateCloudId: identities.generateCloudId,
      generateMutationId: identities.generateMutationId,
      now: () => NOW,
    });
  return { gateway, identities, locks, roster, start };
}

function deriveOngoing(repository: IndexedDbAutomaticCharacterSyncRepository) {
  return derivePlayerBackupRunResult({
    factory: indexedDB,
    accountId: ACCOUNT,
    expectedActiveRunId: 'run-a',
    repository,
  });
}

describe('one-time player backup online execution', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('uploads only selected ids from a local-ready one-time run and records verified checkpoints', async () => {
    await seedRun({ selected: ['hero-a'], cleared: ['hero-b'] });
    let pendingAtPut: unknown = null;
    const harness = createHarness({
      onPut: () => {
        pendingAtPut = harness.links.get(ACCOUNT, 'hero-a');
      },
    });
    harness.links.save({
      accountId: 'account-b',
      legacyId: 'hero-a',
      cloudId: 'other-cloud',
      serverVersion: 7,
      contentFingerprint: 'other-fingerprint',
      pendingMutation: null,
    });

    const result = await harness.execute();

    const expected = await fingerprint(HERO_A);
    expect(result).toEqual({
      runId: 'run-a',
      accountId: ACCOUNT,
      mode: 'one-time',
      executionPath: 'integrated',
      protected: ['hero-a'],
      queued: [],
      offline: [],
      authRequired: [],
      needsAttention: [],
      heldAside: [],
      failed: [],
      pending: [],
      outcomes: { 'hero-a': { outcome: 'protected', reason: null } },
      complete: true,
    });
    expect(harness.gateway.put).toHaveBeenCalledTimes(1);
    expect(harness.gateway.putRequests[0]).toMatchObject({
      legacyId: 'hero-a',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
      expectedServerVersion: 0,
    });
    expect(pendingAtPut).toEqual({
      accountId: ACCOUNT,
      legacyId: 'hero-a',
      cloudId: 'cloud-1',
      serverVersion: 0,
      contentFingerprint: null,
      pendingMutation: {
        mutationId: 'mutation-1',
        contentFingerprint: expected,
        originPlayerBackupRunId: 'run-a',
      },
    });

    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toEqual({
      version: 1,
      kind: 'manual',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
      state: 'protected',
      recordedAt: NOW,
      serverVersion: 1,
      contentFingerprint: expected,
      verifiedAt: NOW,
    });
    expect(checkpoints['hero-b']).toBeUndefined();
    expect(harness.links.get(ACCOUNT, 'hero-b')).toBeNull();
    expect([...harness.gateway.rows.keys()]).toEqual(['cloud-1']);
    expect(harness.links.get('account-b', 'hero-a')).toMatchObject({
      cloudId: 'other-cloud',
      serverVersion: 7,
    });
  });

  it('refuses a confirmed integrated run before local-ready', async () => {
    await seedRun({ stage: 'confirmed' });
    const harness = createHarness();

    await expect(harness.execute()).rejects.toThrow(
      'Player backup run has not reached local-ready'
    );
    expect(harness.gateway.list).not.toHaveBeenCalled();
    expect(harness.gateway.put).not.toHaveBeenCalled();
    expect(harness.links.get(ACCOUNT, 'hero-a')).toBeNull();
  });

  it('runs a degraded-manual run from confirmed without touching local authority', async () => {
    await seedRun({ stage: 'confirmed', executionPath: 'degraded-manual' });
    const harness = createHarness();

    const result = await harness.execute();

    expect(result).toMatchObject({
      executionPath: 'degraded-manual',
      protected: ['hero-a'],
      complete: true,
    });
    expect(
      localStorage.getItem(characterCutoverSelectionKey('guest'))
    ).toBeNull();
    await expect(readStore('documents')).resolves.toEqual([]);
    await expect(readStore('outbox')).resolves.toEqual([]);
    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    try {
      await expect(
        readCharacterAuthority(database!, 'guest')
      ).resolves.toMatchObject({ authority: 'localStorage' });
    } finally {
      database?.close();
    }
  });

  it('re-reads the exact preference partition before any online work', async () => {
    await seedRun();
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    try {
      await new AutomaticCharacterSyncPreferences(database).setCharacter(
        NAMESPACE,
        'hero-a',
        true
      );
    } finally {
      database.close();
    }
    const harness = createHarness();

    await expect(harness.execute()).rejects.toThrow(
      'Durable player backup consent could not be acknowledged'
    );
    expect(harness.gateway.list).not.toHaveBeenCalled();
    expect(harness.gateway.put).not.toHaveBeenCalled();
  });

  it('attaches and verifies an identical row without upload', async () => {
    await seedRun();
    const harness = createHarness();
    await seedRow(harness.gateway, {
      cloudId: 'cloud-a',
      legacyId: 'hero-a',
      character: HERO_A,
      serverVersion: 3,
      clientRevision: 5,
    });

    const result = await harness.execute();

    const expected = await fingerprint(HERO_A);
    expect(result.protected).toEqual(['hero-a']);
    expect(harness.gateway.put).not.toHaveBeenCalled();
    expect(harness.gateway.fetch).toHaveBeenCalledWith('cloud-a');
    expect(harness.links.get(ACCOUNT, 'hero-a')).toEqual({
      accountId: ACCOUNT,
      legacyId: 'hero-a',
      cloudId: 'cloud-a',
      serverVersion: 3,
      contentFingerprint: expected,
      pendingMutation: null,
    });
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      state: 'protected',
      cloudId: 'cloud-a',
      mutationId: null,
      serverVersion: 3,
      contentFingerprint: expected,
    });
    expect(harness.identities.generateCloudId).not.toHaveBeenCalled();
    expect(harness.identities.generateMutationId).not.toHaveBeenCalled();
  });

  it('replaces an exact linked row with CAS and keeps a drifted row as needs-attention', async () => {
    await seedRun({ selected: ['hero-a', 'hero-b'] });
    const harness = createHarness();
    await seedRow(harness.gateway, {
      cloudId: 'cloud-a',
      legacyId: 'hero-a',
      character: HERO_A_OLD,
      serverVersion: 1,
      clientRevision: 4,
    });
    await seedRow(harness.gateway, {
      cloudId: 'cloud-b',
      legacyId: 'hero-b',
      character: HERO_B_OLD,
      serverVersion: 4,
      clientRevision: 1,
    });
    harness.links.save({
      accountId: ACCOUNT,
      legacyId: 'hero-a',
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: await fingerprint(HERO_A_OLD),
      pendingMutation: null,
    });

    const result = await harness.execute();

    expect(result.protected).toEqual(['hero-a']);
    expect(result.needsAttention).toEqual(['hero-b']);
    expect(result.complete).toBe(false);
    expect(harness.gateway.put).toHaveBeenCalledTimes(1);
    expect(harness.gateway.putRequests[0]).toMatchObject({
      cloudId: 'cloud-a',
      expectedServerVersion: 1,
    });
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      state: 'protected',
      cloudId: 'cloud-a',
      serverVersion: 2,
    });
    // An integrated run hands the drifted row to the durable conflict path.
    expect(checkpoints['hero-b'].online).toMatchObject({
      kind: 'automatic',
      state: 'needs-attention',
      cloudId: 'cloud-b',
      reason: 'conflict:different',
    });
    expect(harness.links.get(ACCOUNT, 'hero-b')).toBeNull();
  });

  it('holds a future row aside with no mutation', async () => {
    await seedRun();
    const harness = createHarness();
    await seedRow(harness.gateway, {
      cloudId: 'cloud-a',
      legacyId: 'hero-a',
      character: HERO_A,
      schemaVersion: 99,
    });

    const result = await harness.execute();

    expect(result.heldAside).toEqual(['hero-a']);
    expect(result.outcomes['hero-a']).toEqual({
      outcome: 'held-aside',
      reason: 'future',
    });
    expect(harness.gateway.put).not.toHaveBeenCalled();
    expect(harness.links.get(ACCOUNT, 'hero-a')).toBeNull();
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      state: 'held-aside',
      cloudId: 'cloud-a',
      mutationId: null,
      reason: 'future',
    });
  });

  it('maps a failed listing to its gateway category without touching links', async () => {
    await seedRun({ selected: ['hero-a', 'hero-b'] });
    const harness = createHarness();
    harness.gateway.failNextList = 'auth';

    const result = await harness.execute();

    expect(result.authRequired).toEqual(['hero-a']);
    expect(result.protected).toEqual(['hero-b']);
    expect(harness.links.get(ACCOUNT, 'hero-a')).toBeNull();
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      state: 'auth-required',
      reason: 'auth-required',
      mutationId: null,
    });
  });

  it('continues unrelated characters after one failure and reports exact partial results', async () => {
    await seedRun({ selected: ['hero-a', 'hero-b'] });
    const harness = createHarness();
    harness.gateway.failNextPut = 'offline';

    const result = await harness.execute();

    expect(result.offline).toEqual(['hero-a']);
    expect(result.protected).toEqual(['hero-b']);
    expect(result.complete).toBe(false);
    expect(result.outcomes).toEqual({
      'hero-a': { outcome: 'offline', reason: 'offline' },
      'hero-b': { outcome: 'protected', reason: null },
    });
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      state: 'offline',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
      reason: 'offline',
    });
    expect(checkpoints['hero-b'].online).toMatchObject({
      state: 'protected',
      cloudId: 'cloud-2',
      mutationId: 'mutation-2',
    });
    expect(harness.links.get(ACCOUNT, 'hero-a')).toMatchObject({
      pendingMutation: {
        mutationId: 'mutation-1',
        originPlayerBackupRunId: 'run-a',
      },
    });

    const retried = await harness.execute();

    expect(retried.protected).toEqual(['hero-a', 'hero-b']);
    expect(harness.gateway.put).toHaveBeenCalledTimes(3);
    expect(harness.gateway.putRequests[2]).toMatchObject({
      legacyId: 'hero-a',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
    });
    expect(harness.identities.generateMutationId).toHaveBeenCalledTimes(2);
    expect(harness.gateway.rows.size).toBe(2);
  });

  it('reuses the mutation identity after response loss and verifies acknowledgement before retrying', async () => {
    await seedRun();
    const harness = createHarness();
    harness.gateway.failNextPut = 'lost';

    const first = await harness.execute();

    expect(first.failed).toEqual(['hero-a']);
    expect(first.outcomes['hero-a']).toEqual({
      outcome: 'failed',
      reason: 'response lost',
    });
    expect(harness.links.get(ACCOUNT, 'hero-a')).toMatchObject({
      cloudId: 'cloud-1',
      pendingMutation: { mutationId: 'mutation-1' },
    });

    const second = await harness.execute();

    expect(second.protected).toEqual(['hero-a']);
    expect(harness.gateway.put).toHaveBeenCalledTimes(1);
    expect(harness.gateway.rows.size).toBe(1);
    const expected = await fingerprint(HERO_A);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toEqual({
      version: 1,
      kind: 'manual',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
      state: 'protected',
      recordedAt: NOW,
      serverVersion: 1,
      contentFingerprint: expected,
      verifiedAt: NOW,
    });
    expect(harness.links.get(ACCOUNT, 'hero-a')).toEqual({
      accountId: ACCOUNT,
      legacyId: 'hero-a',
      cloudId: 'cloud-1',
      serverVersion: 1,
      contentFingerprint: expected,
      pendingMutation: null,
    });
  });

  it('makes zero mutation after the active run is replaced', async () => {
    await seedRun();
    await seedRun({
      runId: 'run-b',
      stage: 'confirmed',
      expectedActiveRunId: 'run-a',
    });
    const harness = createHarness();

    await expect(harness.execute('run-a')).rejects.toBeInstanceOf(
      PlayerBackupRunReplacedError
    );
    expect(harness.gateway.list).not.toHaveBeenCalled();
    expect(harness.gateway.put).not.toHaveBeenCalled();
    expect(harness.links.get(ACCOUNT, 'hero-a')).toBeNull();

    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    try {
      const transaction = database!.transaction('meta', 'readonly');
      const stored = (await requestResult(
        transaction.objectStore('meta').get(playerBackupRunKey('run-a'))
      )) as PlayerBackupRunV1;
      await transactionComplete(transaction);
      expect(stored.characterCheckpoints['hero-a']).toEqual({
        localPreparation: 'ready',
      });
    } finally {
      database?.close();
    }
  });

  it('holds the account lock across list, put, refetch and checkpoint', async () => {
    await seedRun();
    const locks = new RecordingLocks();
    // The lock double and the gateway double share one ordered event log.
    const shared = locks.events;
    const harness = createHarness({ events: shared, locks });
    const release = locks.hold();
    const holding = locks.whenHolding();

    const execution = harness.execute();
    await holding;

    const duringLock = await readCheckpoints();
    expect(duringLock['hero-a'].online).toMatchObject({ state: 'protected' });
    const blocked = confirmPlayerBackupConsent({
      factory: indexedDB,
      storage: localStorage,
      locks,
      receipts: {
        hasVerifiedDownloadReceipt: async () => false,
        readVerifiedDownloadReceipt: async () => null,
      },
      accountId: ACCOUNT,
      expectedActiveRunId: 'run-a',
      runId: 'run-b',
      mode: 'one-time',
      eligibleCharacterIds: ['hero-a'],
      selectedCharacterIds: ['hero-a'],
      clearedCharacterIds: [],
      broadSafetyBundle: await captureDeviceBackup(localStorage, {
        appVersion: 'test',
        runId: 'safety-b',
        timestamp: '2026-08-26T09:00:00.000Z',
      }),
      authority: { kind: 'legacy', namespace: 'guest', family: 'character' },
      confirmedAt: '2026-08-26T12:00:00.000Z',
      recheckUnderLock: async () => {
        shared.push('run-b-recheck');
        throw new Error('run-b is blocked');
      },
    }).catch((cause: unknown) => cause);

    release();
    await execution;
    await expect(blocked).resolves.toBeInstanceOf(Error);

    expect(shared).toEqual([
      `acquire:${LOCK_NAME}`,
      'list',
      'fetch',
      'put',
      'fetch',
      `release:${LOCK_NAME}`,
      `acquire:${LOCK_NAME}`,
      'run-b-recheck',
      `release:${LOCK_NAME}`,
    ]);
  });

  it('fails closed without lock capability', async () => {
    await seedRun();
    const harness = createHarness({ locks: null });

    await expect(harness.execute()).rejects.toBeInstanceOf(
      PlayerBackupLockUnavailableError
    );
    expect(harness.gateway.list).not.toHaveBeenCalled();
    expect(harness.gateway.put).not.toHaveBeenCalled();
  });

  it('derives results from durable evidence and detects link drift', async () => {
    await seedRun();
    const harness = createHarness();
    await harness.execute();

    const link = harness.links.get(ACCOUNT, 'hero-a');
    harness.links.save({ ...link!, serverVersion: 99 });

    const drifted = await derivePlayerBackupRunResult({
      factory: indexedDB,
      accountId: ACCOUNT,
      expectedActiveRunId: 'run-a',
      links: harness.links,
    });
    expect(drifted.protected).toEqual([]);
    expect(drifted.failed).toEqual(['hero-a']);
    expect(drifted.outcomes['hero-a']).toEqual({
      outcome: 'failed',
      reason: 'link-evidence-mismatch',
    });

    await deleteRollkeeperDatabaseForTests(indexedDB);
    await expect(
      derivePlayerBackupRunResult({
        factory: indexedDB,
        accountId: ACCOUNT,
        expectedActiveRunId: 'run-a',
        links: harness.links,
      })
    ).rejects.toThrow('Committed player backup run is missing');
  });

  it('resumes idempotently after reload', async () => {
    await seedRun();
    const harness = createHarness();

    const first = await harness.execute();
    const second = await harness.execute();

    expect(second).toEqual(first);
    expect(harness.gateway.put).toHaveBeenCalledTimes(1);
    expect(harness.gateway.rows.size).toBe(1);
    // A protected checkpoint short-circuits before any cloud read.
    expect(harness.gateway.list).toHaveBeenCalledTimes(1);
  });

  it('mints a real cloud id on resume instead of reusing the no-identity sentinel', async () => {
    await seedRun();
    const harness = createHarness();
    harness.gateway.failNextList = 'offline';

    const first = await harness.execute();

    expect(first.offline).toEqual(['hero-a']);
    const stalled = await readCheckpoints();
    expect(stalled['hero-a'].online).toMatchObject({
      state: 'offline',
      cloudId: 'none',
      mutationId: null,
    });
    expect(harness.links.get(ACCOUNT, 'hero-a')).toBeNull();

    const second = await harness.execute();

    expect(second.protected).toEqual(['hero-a']);
    expect(harness.gateway.putRequests[0]).toMatchObject({
      legacyId: 'hero-a',
      cloudId: 'cloud-1',
    });
    expect(harness.gateway.rows.has('none')).toBe(false);
    expect(harness.links.get(ACCOUNT, 'hero-a')).toMatchObject({
      cloudId: 'cloud-1',
      pendingMutation: null,
    });
  });

  it('gives two sentinel-path characters distinct cloud ids when the run resumes', async () => {
    await seedRun({ selected: ['hero-a', 'hero-b'] });
    const harness = createHarness();
    harness.gateway.failNextList = 'offline';
    harness.gateway.failListCount = 2;

    const first = await harness.execute();

    expect(first.offline).toEqual(['hero-a', 'hero-b']);
    expect(harness.gateway.put).not.toHaveBeenCalled();

    const second = await harness.execute();

    expect(second.protected).toEqual(['hero-a', 'hero-b']);
    expect(second.complete).toBe(true);
    expect(harness.gateway.putRequests.map(request => request.cloudId)).toEqual(
      ['cloud-1', 'cloud-2']
    );
    expect(harness.gateway.rows.has('none')).toBe(false);
    expect([...harness.gateway.rows.keys()]).toEqual(['cloud-1', 'cloud-2']);
  });

  it('keeps a real pending identity across a failed listing and reuses it on resume', async () => {
    await seedRun();
    const harness = createHarness();
    harness.gateway.failNextPut = 'offline';

    await harness.execute();

    harness.gateway.failNextList = 'offline';
    const stalled = await harness.execute();

    expect(stalled.offline).toEqual(['hero-a']);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      state: 'offline',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
      reason: 'offline',
    });

    const resumed = await harness.execute();

    expect(resumed.protected).toEqual(['hero-a']);
    expect(harness.gateway.putRequests[1]).toMatchObject({
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
    });
    expect(harness.identities.generateCloudId).toHaveBeenCalledTimes(1);
    expect(harness.identities.generateMutationId).toHaveBeenCalledTimes(1);
    expect(harness.gateway.rows.size).toBe(1);
  });

  it('records a missing roster character as failed without any cloud call', async () => {
    await seedRun({ selected: ['hero-a', 'hero-b'] });
    const harness = createHarness({ roster: { 'hero-b': HERO_B } });

    const first = await harness.execute();

    expect(first.failed).toEqual(['hero-a']);
    expect(first.protected).toEqual(['hero-b']);
    expect(first.outcomes['hero-a']).toEqual({
      outcome: 'failed',
      reason: 'local-character-missing',
    });
    expect(harness.links.get(ACCOUNT, 'hero-a')).toBeNull();
    // hero-b is the only character that reached the cloud.
    expect(harness.gateway.list).toHaveBeenCalledTimes(1);
    expect(harness.gateway.put).toHaveBeenCalledTimes(1);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      state: 'failed',
      cloudId: 'none',
      mutationId: null,
      reason: 'local-character-missing',
    });

    harness.roster['hero-a'] = HERO_A;
    const resumed = await harness.execute();

    expect(resumed.protected).toEqual(['hero-a', 'hero-b']);
    expect(harness.gateway.putRequests[1]).toMatchObject({
      legacyId: 'hero-a',
      cloudId: 'cloud-2',
    });
    expect(harness.gateway.rows.has('none')).toBe(false);
  });

  it('refuses to derive a one-time run without link evidence', async () => {
    await seedRun();
    const harness = createHarness();
    const executed = await harness.execute();

    expect(executed.protected).toEqual(['hero-a']);
    await expect(
      derivePlayerBackupRunResult({
        factory: indexedDB,
        accountId: ACCOUNT,
        expectedActiveRunId: 'run-a',
      })
    ).rejects.toThrow('Link evidence is required for one-time runs');
  });

  it('removes the link when a fresh upload is rejected by a row created elsewhere', async () => {
    await seedRun();
    const harness = createHarness({
      // Another device creates the row between the listing and the put.
      onPut: request => {
        void seedRow(harness.gateway, {
          cloudId: request.cloudId,
          legacyId: 'hero-a',
          character: HERO_A_OLD,
          serverVersion: 1,
          clientRevision: 4,
        });
      },
    });

    const result = await harness.execute();

    expect(result.needsAttention).toEqual(['hero-a']);
    expect(harness.links.get(ACCOUNT, 'hero-a')).toBeNull();
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'needs-attention',
      cloudId: 'cloud-1',
      reason: 'conflict:different',
    });
    // No prior link means the conflict work creates the cloud copy it contests.
    await expect(readStore('documents')).resolves.toEqual([
      expect.objectContaining({
        legacyId: 'hero-a',
        cloudId: 'cloud-1',
        operation: 'create',
        baseServerVersion: 0,
      }),
    ]);
  });

  it('retries a linked-exact character after a transient failure instead of contesting it', async () => {
    await seedRun();
    const harness = createHarness();
    await seedRow(harness.gateway, {
      cloudId: 'cloud-a',
      legacyId: 'hero-a',
      character: HERO_A_OLD,
      serverVersion: 1,
      clientRevision: 4,
    });
    harness.links.save({
      accountId: ACCOUNT,
      legacyId: 'hero-a',
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: await fingerprint(HERO_A_OLD),
      pendingMutation: null,
    });
    harness.gateway.failNextPut = 'offline';

    const stalled = await harness.execute();

    expect(stalled.offline).toEqual(['hero-a']);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      state: 'offline',
      cloudId: 'cloud-a',
      mutationId: 'mutation-1',
      reason: 'offline',
    });
    expect(harness.links.get(ACCOUNT, 'hero-a')).toMatchObject({
      serverVersion: 1,
      pendingMutation: {
        mutationId: 'mutation-1',
        originPlayerBackupRunId: 'run-a',
      },
    });

    const resumed = await harness.execute();

    expect(resumed.protected).toEqual(['hero-a']);
    expect(resumed.needsAttention).toEqual([]);
    expect(harness.gateway.put).toHaveBeenCalledTimes(2);
    expect(harness.gateway.putRequests[1]).toMatchObject({
      cloudId: 'cloud-a',
      mutationId: 'mutation-1',
      expectedServerVersion: 1,
    });
    expect(harness.links.get(ACCOUNT, 'hero-a')).toMatchObject({
      cloudId: 'cloud-a',
      serverVersion: 2,
      pendingMutation: null,
    });
  });

  it('retains the pending mutation when verifying an identical row fails', async () => {
    await seedRun();
    const harness = createHarness();
    harness.gateway.failNextPut = 'lost';

    await harness.execute();

    expect(harness.links.get(ACCOUNT, 'hero-a')).toMatchObject({
      pendingMutation: { mutationId: 'mutation-1' },
    });

    harness.gateway.failNextFetch = 'offline';
    const stalled = await harness.execute();

    expect(stalled.offline).toEqual(['hero-a']);
    expect(harness.links.get(ACCOUNT, 'hero-a')).toMatchObject({
      cloudId: 'cloud-1',
      serverVersion: 1,
      pendingMutation: {
        mutationId: 'mutation-1',
        originPlayerBackupRunId: 'run-a',
      },
    });
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      state: 'offline',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
    });

    const resumed = await harness.execute();

    expect(resumed.protected).toEqual(['hero-a']);
    expect(harness.gateway.put).toHaveBeenCalledTimes(1);
    expect(harness.links.get(ACCOUNT, 'hero-a')).toMatchObject({
      cloudId: 'cloud-1',
      serverVersion: 1,
      pendingMutation: null,
    });
    const verified = await readCheckpoints();
    expect(verified['hero-a'].online).toMatchObject({
      state: 'protected',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
    });
  });

  describe('integrated existing copies (manual)', () => {
    it('seeds a durable conflict for a different row and continues unrelated characters', async () => {
      await seedRun({ selected: ['hero-a', 'hero-b'] });
      const harness = createHarness();
      const row = await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 4,
        clientRevision: 4,
      });

      const result = await harness.execute();

      expect(result.needsAttention).toEqual(['hero-a']);
      expect(result.protected).toEqual(['hero-b']);
      expect(result.complete).toBe(false);
      expect(harness.gateway.put).toHaveBeenCalledTimes(1);
      expect(harness.gateway.putRequests[0]).toMatchObject({
        legacyId: 'hero-b',
      });
      await expect(readStore('conflicts')).resolves.toEqual([
        expect.objectContaining({
          namespace: NAMESPACE,
          family: 'character',
          legacyId: 'hero-a',
          originPlayerBackupRunId: 'run-a',
          resolutionState: 'unresolved',
          cloudCandidate: row,
        }),
      ]);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        kind: 'automatic',
        state: 'needs-attention',
        cloudId: 'cloud-a',
        reason: 'conflict:different',
      });
      expect(harness.links.get(ACCOUNT, 'hero-a')).toBeNull();
    });

    it('skips a character owned by the conflict path on resume', async () => {
      await seedRun({ selected: ['hero-a', 'hero-b'] });
      const harness = createHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 4,
        clientRevision: 4,
      });

      const first = await harness.execute();
      // One listing per character: the contested one and the uploaded one.
      expect(harness.gateway.list).toHaveBeenCalledTimes(2);

      const resumed = await harness.execute();

      // Both characters short-circuit before any cloud read.
      expect(harness.gateway.list).toHaveBeenCalledTimes(2);
      expect(harness.gateway.put).toHaveBeenCalledTimes(1);
      await expect(readStore('conflicts')).resolves.toHaveLength(1);
      expect(resumed).toEqual(first);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        kind: 'automatic',
        state: 'needs-attention',
        reason: 'conflict:different',
      });
    });

    it('seeds an archived row without restoring or uploading', async () => {
      await seedRun();
      const harness = createHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A,
        deletedAt: '2026-08-20T00:00:00.000Z',
      });

      const result = await harness.execute();

      expect(result.needsAttention).toEqual(['hero-a']);
      expect(harness.gateway.restore).not.toHaveBeenCalled();
      expect(harness.gateway.put).not.toHaveBeenCalled();
      expect(harness.links.get(ACCOUNT, 'hero-a')).toBeNull();
      await expect(readStore('conflicts')).resolves.toEqual([
        expect.objectContaining({ legacyId: 'hero-a' }),
      ]);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        kind: 'automatic',
        state: 'needs-attention',
        cloudId: 'cloud-a',
        reason: 'conflict:removed',
      });
    });

    it('holds a future row aside with exact bytes', async () => {
      await seedRun();
      const harness = createHarness();
      const row = await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A,
        schemaVersion: 99,
      });

      const result = await harness.execute();

      expect(result.heldAside).toEqual(['hero-a']);
      expect(harness.gateway.put).not.toHaveBeenCalled();
      await expect(readStore('quarantine')).resolves.toEqual([
        expect.objectContaining({
          namespace: NAMESPACE,
          family: 'character',
          legacyId: 'hero-a',
          rawValue: JSON.stringify(row),
        }),
      ]);
      await expect(readStore('conflicts')).resolves.toEqual([]);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        kind: 'manual',
        state: 'held-aside',
        cloudId: 'cloud-a',
        reason: 'future',
      });
    });

    it('turns an explicit server conflict into a durable conflict without retry', async () => {
      await seedRun();
      const harness = createHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 1,
        clientRevision: 4,
      });
      const priorFingerprint = await fingerprint(HERO_A_OLD);
      harness.links.save({
        accountId: ACCOUNT,
        legacyId: 'hero-a',
        cloudId: 'cloud-a',
        serverVersion: 1,
        contentFingerprint: priorFingerprint,
        pendingMutation: null,
      });
      harness.gateway.failNextPut = 'conflict';

      const first = await harness.execute();

      expect(first.needsAttention).toEqual(['hero-a']);
      expect(harness.links.get(ACCOUNT, 'hero-a')).toEqual({
        accountId: ACCOUNT,
        legacyId: 'hero-a',
        cloudId: 'cloud-a',
        serverVersion: 1,
        contentFingerprint: priorFingerprint,
        pendingMutation: null,
      });
      await expect(readStore('conflicts')).resolves.toEqual([
        expect.objectContaining({
          legacyId: 'hero-a',
          originPlayerBackupRunId: 'run-a',
          resolutionState: 'unresolved',
          // The refetched row the rejection carried, not the stale listing.
          cloudCandidate: expect.objectContaining({
            id: 'cloud-a',
            server_version: 2,
          }),
        }),
      ]);
      // The conflict work replaces the linked copy instead of creating one.
      await expect(readStore('documents')).resolves.toEqual([
        expect.objectContaining({
          legacyId: 'hero-a',
          cloudId: 'cloud-a',
          operation: 'replace',
          baseServerVersion: 1,
          originPlayerBackupRunId: 'run-a',
        }),
      ]);
      const afterFirst = await readCheckpoints();
      expect(afterFirst['hero-a'].online).toMatchObject({
        kind: 'automatic',
        state: 'needs-attention',
        cloudId: 'cloud-a',
        reason: 'conflict:different',
      });

      const second = await harness.execute();

      expect(second).toEqual(first);
      expect(harness.gateway.put).toHaveBeenCalledTimes(1);
      await expect(readStore('conflicts')).resolves.toHaveLength(1);
    });
  });

  describe('degraded boundary regression', () => {
    it('never seeds or quarantines for a degraded run', async () => {
      await seedRun({
        stage: 'confirmed',
        executionPath: 'degraded-manual',
        selected: ['hero-a', 'hero-b', 'hero-c'],
      });
      const harness = createHarness({
        roster: { 'hero-a': HERO_A, 'hero-b': HERO_B, 'hero-c': HERO_C },
      });
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 4,
        clientRevision: 4,
      });
      await seedRow(harness.gateway, {
        cloudId: 'cloud-b',
        legacyId: 'hero-b',
        character: HERO_B,
        deletedAt: '2026-08-20T00:00:00.000Z',
      });
      await seedRow(harness.gateway, {
        cloudId: 'cloud-c',
        legacyId: 'hero-c',
        character: HERO_C,
        schemaVersion: 99,
      });

      const result = await harness.execute();

      expect(result.executionPath).toBe('degraded-manual');
      expect(result.needsAttention).toEqual(['hero-a', 'hero-b']);
      expect(result.heldAside).toEqual(['hero-c']);
      await expect(readStore('conflicts')).resolves.toEqual([]);
      await expect(readStore('quarantine')).resolves.toEqual([]);
      await expect(readStore('documents')).resolves.toEqual([]);
      await expect(readStore('outbox')).resolves.toEqual([]);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        kind: 'manual',
        state: 'needs-attention',
        cloudId: 'cloud-a',
        mutationId: null,
        reason: 'different',
      });
      expect(checkpoints['hero-b'].online).toMatchObject({
        kind: 'manual',
        state: 'needs-attention',
        cloudId: 'cloud-b',
        mutationId: null,
        reason: 'removed',
      });
      expect(checkpoints['hero-c'].online).toMatchObject({
        kind: 'manual',
        state: 'held-aside',
        cloudId: 'cloud-c',
        mutationId: null,
        reason: 'future',
      });
    });

    it('keeps a degraded server conflict as rejected:conflict', async () => {
      await seedRun({ stage: 'confirmed', executionPath: 'degraded-manual' });
      const harness = createHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 1,
        clientRevision: 4,
      });
      const priorFingerprint = await fingerprint(HERO_A_OLD);
      harness.links.save({
        accountId: ACCOUNT,
        legacyId: 'hero-a',
        cloudId: 'cloud-a',
        serverVersion: 1,
        contentFingerprint: priorFingerprint,
        pendingMutation: null,
      });
      harness.gateway.failNextPut = 'conflict';

      const result = await harness.execute();

      expect(result.outcomes['hero-a']).toEqual({
        outcome: 'needs-attention',
        reason: 'rejected:conflict',
      });
      await expect(readStore('conflicts')).resolves.toEqual([]);
      await expect(readStore('documents')).resolves.toEqual([]);
      expect(harness.links.get(ACCOUNT, 'hero-a')).toEqual({
        accountId: ACCOUNT,
        legacyId: 'hero-a',
        cloudId: 'cloud-a',
        serverVersion: 1,
        contentFingerprint: priorFingerprint,
        pendingMutation: null,
      });
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        kind: 'manual',
        state: 'needs-attention',
        cloudId: 'cloud-a',
        mutationId: 'mutation-1',
        reason: 'rejected:conflict',
      });
    });
  });
});

describe('ongoing player backup work creation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(async () => {
    localStorage.clear();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('creates origin-stamped initial documents and work only for selected ids of a local-ready ongoing run', async () => {
    await seedRun({
      mode: 'ongoing',
      selected: ['hero-a'],
      cleared: ['hero-b'],
    });
    const harness = createOngoingHarness();

    const result = await harness.start();

    const expected = await fingerprint(ONGOING_HERO_A);
    await expect(readStore('documents')).resolves.toEqual([
      expect.objectContaining({
        namespace: NAMESPACE,
        family: 'character',
        legacyId: 'hero-a',
        cloudId: 'cloud-1',
        operation: 'create',
        payload: encodeCharacterCloudPayload(ONGOING_HERO_A),
        schemaVersion: 1,
        localRevision: 5,
        baseServerVersion: 0,
        contentFingerprint: expected,
        syncPolicy: 'on',
        updatedAt: NOW,
        originPlayerBackupRunId: 'run-a',
        deletedAt: null,
      }),
    ]);
    await expect(readStore('outbox')).resolves.toEqual([
      expect.objectContaining({
        mutationId: 'mutation-1',
        namespace: NAMESPACE,
        legacyId: 'hero-a',
        cloudId: 'cloud-1',
        operation: 'create',
        state: 'queued',
        syncPolicy: 'on',
        contentFingerprint: expected,
        originPlayerBackupRunId: 'run-a',
      }),
    ]);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toEqual({
      version: 1,
      kind: 'automatic',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
      state: 'queued',
      recordedAt: NOW,
    });
    expect(checkpoints['hero-b']).toBeUndefined();
    expect(result).toMatchObject({
      runId: 'run-a',
      mode: 'ongoing',
      executionPath: 'integrated',
      queued: ['hero-a'],
      protected: [],
      failed: [],
      pending: [],
      complete: false,
    });
  });

  it('rejects a confirmed run and a degraded run', async () => {
    await seedRun({ mode: 'ongoing', stage: 'confirmed' });

    await expect(createOngoingHarness().start()).rejects.toThrow(
      'Player backup run has not reached local-ready'
    );
    await expect(readStore('documents')).resolves.toEqual([]);
    await expect(readStore('outbox')).resolves.toEqual([]);

    await deleteRollkeeperDatabaseForTests(indexedDB);
    await seedRun({
      mode: 'one-time',
      stage: 'confirmed',
      executionPath: 'degraded-manual',
    });

    await expect(createOngoingHarness().start()).rejects.toThrow(
      'Ongoing work requires an integrated run'
    );
    await expect(readStore('documents')).resolves.toEqual([]);
    await expect(readStore('outbox')).resolves.toEqual([]);
  });

  it('is idempotent across reload and never duplicates work', async () => {
    await seedRun({ mode: 'ongoing' });
    const harness = createOngoingHarness();

    const first = await harness.start();
    const second = await harness.start();

    expect(second).toEqual(first);
    await expect(readStore('outbox')).resolves.toEqual([
      expect.objectContaining({ mutationId: 'mutation-1' }),
    ]);
    await expect(readStore('documents')).resolves.toHaveLength(1);
    expect(harness.identities.generateMutationId).toHaveBeenCalledTimes(1);
    expect(harness.identities.generateCloudId).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when the active run was replaced mid-transaction', async () => {
    await seedRun({ mode: 'ongoing' });
    const harness = createOngoingHarness({
      // The replacement lands after the pre-flight read, so only the fenced
      // transaction can still refuse the work.
      beforeLock: async () => {
        await seedRun({
          mode: 'ongoing',
          runId: 'run-b',
          stage: 'confirmed',
          expectedActiveRunId: 'run-a',
        });
      },
    });

    await expect(harness.start('run-a')).rejects.toBeInstanceOf(
      PlayerBackupRunReplacedError
    );
    await expect(readStore('documents')).resolves.toEqual([]);
    await expect(readStore('outbox')).resolves.toEqual([]);
  });

  it('re-reads preference under the fence and refuses a paused character', async () => {
    await seedRun({ mode: 'ongoing', selected: ['hero-a', 'hero-c'] });
    await setCharacterPolicy('hero-a', false);

    // A selection that is already broken before the run starts writes nothing.
    await expect(createOngoingHarness().start()).rejects.toThrow(
      'Durable player backup consent could not be acknowledged'
    );
    await expect(readStore('outbox')).resolves.toEqual([]);

    await setCharacterPolicy('hero-a', true);
    const harness = createOngoingHarness({
      beforeLock: async () => {
        await setCharacterPolicy('hero-a', false);
      },
    });

    const result = await harness.start();

    expect(result.failed).toEqual(['hero-a']);
    expect(result.outcomes['hero-a']).toEqual({
      outcome: 'failed',
      reason: 'preference-not-acknowledged',
    });
    expect(result.queued).toEqual(['hero-c']);
    await expect(readStore('outbox')).resolves.toEqual([
      expect.objectContaining({ legacyId: 'hero-c' }),
    ]);
    await expect(readStore('documents')).resolves.toEqual([
      expect.objectContaining({ legacyId: 'hero-c' }),
    ]);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'failed',
      reason: 'preference-not-acknowledged',
      mutationId: null,
    });
  });

  it('records a missing local character as failed without creating work', async () => {
    await seedRun({ mode: 'ongoing', selected: ['hero-a', 'hero-c'] });
    const harness = createOngoingHarness({
      roster: { 'hero-c': HERO_C },
    });

    const result = await harness.start();

    expect(result.failed).toEqual(['hero-a']);
    expect(result.outcomes['hero-a']).toEqual({
      outcome: 'failed',
      reason: 'local-character-missing',
    });
    expect(result.queued).toEqual(['hero-c']);
    await expect(readStore('outbox')).resolves.toEqual([
      expect.objectContaining({ legacyId: 'hero-c' }),
    ]);
  });

  it('keeps the queued identity when a resumed character is refused under the fence', async () => {
    await seedRun({ mode: 'ongoing' });
    await createOngoingHarness().start();

    const refused = createOngoingHarness({
      beforeLock: async () => {
        await setCharacterPolicy('hero-a', false);
      },
    });
    const result = await refused.start();

    // The retained queued work is the stronger durable evidence; the guard
    // holds it at dispatch while the preference stays off.
    expect(result.queued).toEqual(['hero-a']);
    expect(result.failed).toEqual([]);
    const checkpoints = await readCheckpoints();
    expect(checkpoints['hero-a'].online).toMatchObject({
      kind: 'automatic',
      state: 'failed',
      reason: 'preference-not-acknowledged',
      cloudId: 'cloud-1',
      mutationId: 'mutation-1',
    });
    // The work minted by the first attempt is retained untouched.
    await expect(readStore('outbox')).resolves.toEqual([
      expect.objectContaining({ mutationId: 'mutation-1', state: 'queued' }),
    ]);

    await setCharacterPolicy('hero-a', true);
    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    if (!database) throw new Error('database is missing');
    try {
      const repository = new IndexedDbAutomaticCharacterSyncRepository(
        database
      );
      const worker = new AutomaticCharacterSyncWorker({
        namespace: NAMESPACE,
        featureEnabled: true,
        repository,
        gateway: createGatewayDouble(),
        dispatchGuard: createPlayerBackupDispatchGuard({
          factory: indexedDB,
          locks: new ImmediateLocks(),
          accountId: ACCOUNT,
        }),
      });

      await expect(worker.runOnce()).resolves.toBe('synced');

      const acknowledged = await deriveOngoing(repository);
      expect(acknowledged.protected).toEqual(['hero-a']);
      expect(acknowledged.failed).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('keeps unrelated characters working after one hard failure', async () => {
    await seedRun({ mode: 'ongoing', selected: ['hero-a', 'hero-c'] });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    try {
      const repository = new IndexedDbAutomaticCharacterSyncRepository(
        database,
        { randomId: () => 'archived-hero-a' }
      );
      await repository.commit({
        namespace: NAMESPACE,
        legacyId: 'hero-a',
        cloudId: 'cloud-archived',
        operation: 'delete',
        payload: null,
        schemaVersion: 1,
        localRevision: 5,
        baseServerVersion: 0,
        contentFingerprint: 'archived',
        syncPolicy: 'on',
        updatedAt: CONFIRMED_AT,
      });
      const [archived] = await repository.listOutbox(NAMESPACE);
      await repository.acknowledge(archived!, 'cloud-archived', 1);
    } finally {
      database.close();
    }

    const result = await createOngoingHarness().start();

    expect(result.failed).toEqual(['hero-a']);
    expect(result.outcomes['hero-a']).toEqual({
      outcome: 'failed',
      reason: 'Initial automatic work could not be saved',
    });
    expect(result.queued).toEqual(['hero-c']);
    const documents = (await readStore('documents')) as Array<{
      legacyId: string;
      originPlayerBackupRunId?: string;
      deletedAt: string | null;
    }>;
    expect(
      documents.find(document => document.legacyId === 'hero-a')
    ).toMatchObject({ deletedAt: CONFIRMED_AT });
    expect(
      documents.find(document => document.legacyId === 'hero-a')
        ?.originPlayerBackupRunId
    ).toBeUndefined();
    await expect(readStore('outbox')).resolves.toEqual([
      expect.objectContaining({
        legacyId: 'hero-c',
        originPlayerBackupRunId: 'run-a',
      }),
    ]);
  });

  it('derives protected only from an acknowledged document with no pending work', async () => {
    await seedRun({ mode: 'ongoing' });
    const harness = createOngoingHarness();
    const queued = await harness.start();

    expect(queued.queued).toEqual(['hero-a']);
    expect(queued.protected).toEqual([]);

    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    if (!database) throw new Error('database is missing');
    try {
      const repository = new IndexedDbAutomaticCharacterSyncRepository(
        database,
        { randomId: () => 'later-edit' }
      );
      const gateway = createGatewayDouble();
      const worker = new AutomaticCharacterSyncWorker({
        namespace: NAMESPACE,
        featureEnabled: true,
        repository,
        gateway,
      });

      await expect(worker.runOnce()).resolves.toBe('synced');

      const acknowledged = await deriveOngoing(repository);
      expect(acknowledged.protected).toEqual(['hero-a']);
      expect(acknowledged.complete).toBe(true);

      const document = await repository.getDocument(NAMESPACE, 'hero-a');
      expect(document).toMatchObject({ cloudId: 'cloud-1' });
      await repository.commit({
        namespace: NAMESPACE,
        legacyId: 'hero-a',
        cloudId: 'cloud-1',
        operation: 'replace',
        payload: document!.payload,
        schemaVersion: 1,
        localRevision: 6,
        baseServerVersion: document!.baseServerVersion,
        contentFingerprint: document!.contentFingerprint,
        syncPolicy: 'on',
        updatedAt: NOW,
      });
      const [pending] = await repository.listOutbox(NAMESPACE);
      expect((await deriveOngoing(repository)).queued).toEqual(['hero-a']);

      await repository.preserveConflict(
        pending!,
        { id: 'cloud-1', server_version: 9 },
        NOW
      );
      const contested = await deriveOngoing(repository);
      expect(contested.needsAttention).toEqual(['hero-a']);
      expect(contested.protected).toEqual([]);

      await repository.quarantineCloudCandidate(
        NAMESPACE,
        'hero-a',
        { id: 'cloud-1' },
        'undecodable',
        NOW
      );
      const quarantined = await deriveOngoing(repository);
      expect(quarantined.heldAside).toEqual(['hero-a']);
      expect(quarantined.needsAttention).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('supersedes stale-origin work when a new run mints initial work', async () => {
    await seedRun({ mode: 'ongoing', selected: ['hero-a', 'hero-c'] });
    const staleMutation = (legacyId: string, origin?: string) => ({
      namespace: NAMESPACE,
      legacyId,
      cloudId: `cloud-stale-${legacyId}`,
      operation: 'create' as const,
      payload: encodeCharacterCloudPayload(ONGOING_ROSTER[legacyId]),
      schemaVersion: 1,
      localRevision: 1,
      baseServerVersion: 0,
      contentFingerprint: `stale-${legacyId}`,
      syncPolicy: 'on' as const,
      updatedAt: CONFIRMED_AT,
      ...(origin ? { originPlayerBackupRunId: origin } : {}),
    });
    const database = await openRollkeeperDatabase({ factory: indexedDB });
    try {
      const staleRepository = new IndexedDbAutomaticCharacterSyncRepository(
        database,
        { randomId: () => 'stale-a' }
      );
      await staleRepository.commit(staleMutation('hero-a', 'run-old'));
      await staleRepository.updateWork('stale-a', {
        state: 'retry',
        nextAttemptAt: 0,
        lastError: 'stale attempt',
      });
      // An ordinary edit carries no run origin and is never superseded.
      const editRepository = new IndexedDbAutomaticCharacterSyncRepository(
        database,
        { randomId: () => 'ordinary-edit' }
      );
      await editRepository.commit({
        ...staleMutation('hero-a'),
        localRevision: 2,
      });
      await editRepository.updateWork('ordinary-edit', {
        state: 'retry',
        nextAttemptAt: 0,
      });
      const inflightRepository = new IndexedDbAutomaticCharacterSyncRepository(
        database,
        { randomId: () => 'stale-c' }
      );
      await inflightRepository.commit(staleMutation('hero-c', 'run-old'));
      await inflightRepository.markInflight('stale-c');
    } finally {
      database.close();
    }

    await createOngoingHarness().start();

    await expect(readStore('outbox')).resolves.toEqual([
      expect.objectContaining({
        mutationId: 'mutation-1',
        legacyId: 'hero-a',
        state: 'queued',
        originPlayerBackupRunId: 'run-a',
      }),
      expect.objectContaining({
        mutationId: 'mutation-2',
        legacyId: 'hero-c',
        state: 'queued',
        originPlayerBackupRunId: 'run-a',
      }),
      expect.objectContaining({
        mutationId: 'ordinary-edit',
        legacyId: 'hero-a',
        state: 'retry',
      }),
      // Stale work that is already in flight is left exactly as it is.
      expect.objectContaining({
        mutationId: 'stale-c',
        legacyId: 'hero-c',
        state: 'inflight',
        originPlayerBackupRunId: 'run-old',
      }),
    ]);
  });

  it('reports an acknowledged cloud copy that was later removed as failed', async () => {
    await seedRun({ mode: 'ongoing' });
    await createOngoingHarness().start();

    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    if (!database) throw new Error('database is missing');
    try {
      const repository = new IndexedDbAutomaticCharacterSyncRepository(
        database,
        { randomId: () => 'archive-hero-a' }
      );
      const worker = new AutomaticCharacterSyncWorker({
        namespace: NAMESPACE,
        featureEnabled: true,
        repository,
        gateway: createGatewayDouble(),
      });
      await expect(worker.runOnce()).resolves.toBe('synced');
      await expect(deriveOngoing(repository)).resolves.toMatchObject({
        protected: ['hero-a'],
      });

      const document = await repository.getDocument(NAMESPACE, 'hero-a');
      await repository.commit({
        namespace: NAMESPACE,
        legacyId: 'hero-a',
        cloudId: document!.cloudId!,
        operation: 'delete',
        payload: null,
        schemaVersion: 1,
        localRevision: 6,
        baseServerVersion: document!.baseServerVersion,
        contentFingerprint: document!.contentFingerprint,
        syncPolicy: 'on',
        updatedAt: NOW,
      });
      const [archive] = await repository.listOutbox(NAMESPACE);
      await repository.acknowledge(archive!, document!.cloudId!, 2);

      const removed = await deriveOngoing(repository);
      expect(removed.protected).toEqual([]);
      expect(removed.failed).toEqual(['hero-a']);
      expect(removed.outcomes['hero-a']).toEqual({
        outcome: 'failed',
        reason: 'cloud-copy-removed',
      });
    } finally {
      database.close();
    }
  });

  it('dispatch guard holds stale-origin and paused work but dispatches current on work', async () => {
    await seedRun({ mode: 'ongoing' });
    await createOngoingHarness().start();
    const [entry] = (await readStore(
      'outbox'
    )) as AutomaticCharacterOutboxEntry[];
    const locks = new RecordingLocks();
    const guard = createPlayerBackupDispatchGuard({
      factory: indexedDB,
      locks,
      accountId: ACCOUNT,
    });

    await expect(
      guard.authorize({ ...entry!, originPlayerBackupRunId: 'run-old' })
    ).resolves.toEqual({ hold: 'stale-origin' });
    await expect(
      guard.authorize({ ...entry!, namespace: 'user:account-b' })
    ).resolves.toEqual({ hold: 'unavailable' });
    await expect(guard.authorize(entry!)).resolves.toBe('dispatch');

    await expect(guard.around(entry!, async () => 'dispatched')).resolves.toBe(
      'dispatched'
    );
    expect(locks.events).toEqual([
      `acquire:${LOCK_NAME}`,
      `release:${LOCK_NAME}`,
    ]);

    await setCharacterPolicy('hero-a', false);
    await expect(guard.authorize(entry!)).resolves.toEqual({
      hold: 'preference-off',
    });

    const lockless = createPlayerBackupDispatchGuard({
      factory: indexedDB,
      locks: null,
      accountId: ACCOUNT,
    });
    await expect(
      lockless.around(entry!, async () => 'dispatched')
    ).rejects.toBeInstanceOf(PlayerBackupLockUnavailableError);
  });

  it('later ongoing edits stop after an explicit pause and resume without losing acknowledged data', async () => {
    await seedRun({ mode: 'ongoing' });
    const harness = createOngoingHarness();
    await harness.start();

    const database = await openExistingRollkeeperDatabase({
      factory: indexedDB,
    });
    if (!database) throw new Error('database is missing');
    try {
      const repository = new IndexedDbAutomaticCharacterSyncRepository(
        database
      );
      const preferences = new AutomaticCharacterSyncPreferences(database);
      const gateway = createGatewayDouble();
      const worker = new AutomaticCharacterSyncWorker({
        namespace: NAMESPACE,
        featureEnabled: true,
        repository,
        gateway,
        dispatchGuard: createPlayerBackupDispatchGuard({
          factory: indexedDB,
          locks: new ImmediateLocks(),
          accountId: ACCOUNT,
        }),
      });
      await expect(worker.runOnce()).resolves.toBe('synced');

      const service = new AutomaticCharacterSyncService({
        featureEnabled: true,
        account: { id: ACCOUNT },
        repository,
        preferences,
        indexedDbPrimary: true,
        generateCloudId: harness.identities.generateCloudId,
        now: () => NOW,
      });
      const edited = {
        ...ONGOING_HERO_A,
        characterData: { id: 'hero-a', revision: 6 },
      };
      await expect(service.recordEdit(edited)).resolves.toBe('queued');
      await service.disableCharacter('hero-a');

      await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
        expect.objectContaining({ state: 'paused', pausedFromState: 'queued' }),
      ]);
      await expect(
        repository.getDocument(NAMESPACE, 'hero-a')
      ).resolves.toMatchObject({ cloudId: 'cloud-1', baseServerVersion: 1 });
      await expect(worker.runOnce()).resolves.toBe('idle');
      expect(gateway.put).toHaveBeenCalledTimes(1);

      await service.enableCharacter(edited, {
        confirmed: true,
        targetAccountId: ACCOUNT,
      });

      await expect(worker.runOnce()).resolves.toBe('synced');
      expect(gateway.put).toHaveBeenCalledTimes(2);
      await expect(
        repository.getDocument(NAMESPACE, 'hero-a')
      ).resolves.toMatchObject({
        cloudId: 'cloud-1',
        baseServerVersion: 2,
        localRevision: 6,
      });
      await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([]);
    } finally {
      database.close();
    }
  });

  describe('ongoing existing copies', () => {
    it('attaches an identical row as an acknowledged document without work', async () => {
      await seedRun({ mode: 'ongoing' });
      const harness = createOngoingHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: ONGOING_HERO_A,
        serverVersion: 2,
        clientRevision: 5,
      });

      const result = await harness.start();

      const expected = await fingerprint(ONGOING_HERO_A);
      await expect(readStore('documents')).resolves.toEqual([
        expect.objectContaining({
          namespace: NAMESPACE,
          family: 'character',
          legacyId: 'hero-a',
          cloudId: 'cloud-a',
          operation: 'replace',
          schemaVersion: 1,
          localRevision: 5,
          baseServerVersion: 2,
          contentFingerprint: expected,
          syncPolicy: 'on',
          updatedAt: NOW,
          originPlayerBackupRunId: 'run-a',
          deletedAt: null,
        }),
      ]);
      await expect(readStore('outbox')).resolves.toEqual([]);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toEqual({
        version: 1,
        kind: 'automatic',
        cloudId: 'cloud-a',
        mutationId: null,
        state: 'protected',
        recordedAt: NOW,
        serverVersion: 2,
        contentFingerprint: expected,
        verifiedAt: NOW,
      });
      expect(result.protected).toEqual(['hero-a']);
      expect(result.complete).toBe(true);
      expect(harness.identities.generateCloudId).not.toHaveBeenCalled();
      expect(harness.identities.generateMutationId).not.toHaveBeenCalled();

      const database = await openExistingRollkeeperDatabase({
        factory: indexedDB,
      });
      if (!database) throw new Error('database is missing');
      try {
        const gateway = createGatewayDouble();
        const worker = new AutomaticCharacterSyncWorker({
          namespace: NAMESPACE,
          featureEnabled: true,
          repository: new IndexedDbAutomaticCharacterSyncRepository(database),
          gateway,
          dispatchGuard: createPlayerBackupDispatchGuard({
            factory: indexedDB,
            locks: new ImmediateLocks(),
            accountId: ACCOUNT,
          }),
        });

        await worker.runOnce();

        expect(gateway.put).not.toHaveBeenCalled();
      } finally {
        database.close();
      }
    });

    it('seeds a conflict for a newer row and continues others', async () => {
      await seedRun({ mode: 'ongoing', selected: ['hero-a', 'hero-c'] });
      const harness = createOngoingHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 3,
        clientRevision: 9,
      });

      const result = await harness.start();

      expect(result.needsAttention).toEqual(['hero-a']);
      expect(result.queued).toEqual(['hero-c']);
      await expect(readStore('conflicts')).resolves.toEqual([
        expect.objectContaining({
          namespace: NAMESPACE,
          legacyId: 'hero-a',
          originPlayerBackupRunId: 'run-a',
          resolutionState: 'unresolved',
        }),
      ]);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        kind: 'automatic',
        state: 'needs-attention',
        cloudId: 'cloud-a',
        reason: 'conflict:newer',
      });
      // The conflict work carries this run's origin and the document it
      // preserves; the unrelated character keeps its ordinary queued work.
      const outbox = (await readStore(
        'outbox'
      )) as AutomaticCharacterOutboxEntry[];
      expect(outbox).toEqual([
        expect.objectContaining({
          legacyId: 'hero-a',
          state: 'conflict',
          originPlayerBackupRunId: 'run-a',
        }),
        expect.objectContaining({
          legacyId: 'hero-c',
          state: 'queued',
          originPlayerBackupRunId: 'run-a',
        }),
      ]);
    });

    it('seeds an archived row as conflict:removed', async () => {
      await seedRun({ mode: 'ongoing' });
      const harness = createOngoingHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: ONGOING_HERO_A,
        deletedAt: '2026-08-20T00:00:00.000Z',
      });

      const result = await harness.start();

      expect(result.needsAttention).toEqual(['hero-a']);
      expect(harness.gateway.restore).not.toHaveBeenCalled();
      await expect(readStore('conflicts')).resolves.toHaveLength(1);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        kind: 'automatic',
        state: 'needs-attention',
        cloudId: 'cloud-a',
        reason: 'conflict:removed',
      });
    });

    it('holds a future row aside', async () => {
      await seedRun({ mode: 'ongoing' });
      const harness = createOngoingHarness();
      const row = await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: ONGOING_HERO_A,
        schemaVersion: 99,
      });

      const result = await harness.start();

      expect(result.heldAside).toEqual(['hero-a']);
      await expect(readStore('quarantine')).resolves.toEqual([
        expect.objectContaining({
          namespace: NAMESPACE,
          legacyId: 'hero-a',
          rawValue: JSON.stringify(row),
        }),
      ]);
      await expect(readStore('outbox')).resolves.toEqual([]);
      await expect(readStore('documents')).resolves.toEqual([]);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        kind: 'automatic',
        state: 'held-aside',
        cloudId: 'cloud-a',
        reason: 'future',
      });
    });

    it('records a listing failure by category and retries once the listing succeeds', async () => {
      await seedRun({
        mode: 'ongoing',
        selected: ['hero-a', 'hero-b', 'hero-c'],
      });
      const harness = createOngoingHarness();
      harness.gateway.failNextList = 'offline';
      harness.gateway.failListCount = 3;

      const stalled = await harness.start();

      // A failure recorded before anything was written mints no identity.
      expect(stalled.offline).toEqual(['hero-a', 'hero-b', 'hero-c']);
      await expect(readStore('outbox')).resolves.toEqual([]);
      await expect(readStore('documents')).resolves.toEqual([]);
      const stalledCheckpoints = await readCheckpoints();
      for (const legacyId of ['hero-a', 'hero-b', 'hero-c']) {
        expect(stalledCheckpoints[legacyId].online).toMatchObject({
          kind: 'automatic',
          state: 'offline',
          reason: 'offline',
          cloudId: 'none',
          mutationId: null,
        });
      }
      expect(harness.identities.generateMutationId).not.toHaveBeenCalled();

      // The account gained copies of two of them while the listing was down.
      await seedRow(harness.gateway, {
        cloudId: 'cloud-b',
        legacyId: 'hero-b',
        character: ONGOING_ROSTER['hero-b'],
        serverVersion: 2,
        clientRevision: 2,
      });
      await seedRow(harness.gateway, {
        cloudId: 'cloud-c',
        legacyId: 'hero-c',
        character: { ...HERO_C, characterData: { id: 'hero-c', revision: 2 } },
        serverVersion: 4,
        clientRevision: 9,
      });

      const retried = await harness.start();

      // Each character re-correlates and takes the branch its row deserves.
      expect(retried.queued).toEqual(['hero-a']);
      expect(retried.protected).toEqual(['hero-b']);
      expect(retried.needsAttention).toEqual(['hero-c']);
      await expect(readStore('outbox')).resolves.toEqual([
        expect.objectContaining({
          mutationId: 'mutation-1',
          legacyId: 'hero-a',
          state: 'queued',
          originPlayerBackupRunId: 'run-a',
        }),
        expect.objectContaining({ legacyId: 'hero-c', state: 'conflict' }),
      ]);
      const documents = (await readStore('documents')) as {
        legacyId: string;
        cloudId?: string;
        baseServerVersion: number;
      }[];
      expect(documents).toEqual([
        expect.objectContaining({
          legacyId: 'hero-a',
          cloudId: 'cloud-1',
          baseServerVersion: 0,
        }),
        expect.objectContaining({
          legacyId: 'hero-b',
          cloudId: 'cloud-b',
          baseServerVersion: 2,
        }),
        expect.objectContaining({ legacyId: 'hero-c', cloudId: 'cloud-c' }),
      ]);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        state: 'queued',
        cloudId: 'cloud-1',
        mutationId: 'mutation-1',
      });
      expect(checkpoints['hero-b'].online).toMatchObject({
        state: 'protected',
        cloudId: 'cloud-b',
        mutationId: null,
      });
      expect(checkpoints['hero-c'].online).toMatchObject({
        state: 'needs-attention',
        cloudId: 'cloud-c',
        reason: 'conflict:newer',
      });
    });

    it('never re-mints work for a character that already has a queued identity', async () => {
      await seedRun({ mode: 'ongoing' });
      const harness = createOngoingHarness();

      const first = await harness.start();

      expect(first.queued).toEqual(['hero-a']);
      // A cloud copy appears before the resume; the queued work still stands.
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 4,
        clientRevision: 4,
      });

      const resumed = await harness.start();

      expect(resumed).toEqual(first);
      expect(harness.identities.generateMutationId).toHaveBeenCalledTimes(1);
      expect(harness.identities.generateCloudId).toHaveBeenCalledTimes(1);
      await expect(readStore('outbox')).resolves.toEqual([
        expect.objectContaining({ mutationId: 'mutation-1', state: 'queued' }),
      ]);
      await expect(readStore('conflicts')).resolves.toEqual([]);
      await expect(readStore('documents')).resolves.toHaveLength(1);
      const checkpoints = await readCheckpoints();
      expect(checkpoints['hero-a'].online).toMatchObject({
        state: 'queued',
        cloudId: 'cloud-1',
        mutationId: 'mutation-1',
      });
    });

    it('keeps the missing path unchanged', async () => {
      await seedRun({ mode: 'ongoing' });
      const harness = createOngoingHarness();
      // Another character's cloud copy must not be correlated with this one.
      await seedRow(harness.gateway, {
        cloudId: 'cloud-z',
        legacyId: 'hero-z',
        character: HERO_C,
      });

      const result = await harness.start();

      const expected = await fingerprint(ONGOING_HERO_A);
      await expect(readStore('documents')).resolves.toEqual([
        expect.objectContaining({
          legacyId: 'hero-a',
          cloudId: 'cloud-1',
          operation: 'create',
          baseServerVersion: 0,
          contentFingerprint: expected,
          originPlayerBackupRunId: 'run-a',
        }),
      ]);
      await expect(readStore('outbox')).resolves.toEqual([
        expect.objectContaining({
          mutationId: 'mutation-1',
          legacyId: 'hero-a',
          state: 'queued',
        }),
      ]);
      expect(result.queued).toEqual(['hero-a']);
    });
  });

  describe('dispatch guard run authorisation', () => {
    it('dispatches one-time run-origin work whose checkpoint is automatic while the preference stays off', async () => {
      await seedRun();
      const harness = createHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 4,
        clientRevision: 4,
      });
      await harness.execute();
      const [conflict] = (await readStore(
        'conflicts'
      )) as AutomaticCharacterConflict[];

      const database = await openExistingRollkeeperDatabase({
        factory: indexedDB,
      });
      if (!database) throw new Error('database is missing');
      try {
        const conflicts = new AutomaticCharacterConflictService(database, {
          randomId: () => 'resolution-1',
          now: () => NOW,
        });

        await expect(
          conflicts.resolve(conflict!.conflictId, 'keep-mine', {
            originPlayerBackupRunId: 'run-a',
          })
        ).resolves.toBe('resolved');

        const queued = (
          (await readStore('outbox')) as AutomaticCharacterOutboxEntry[]
        ).filter(entry => entry.state === 'queued');
        expect(queued).toEqual([
          expect.objectContaining({
            mutationId: 'resolution-1',
            legacyId: 'hero-a',
            originPlayerBackupRunId: 'run-a',
          }),
        ]);

        const guard = createPlayerBackupDispatchGuard({
          factory: indexedDB,
          locks: new ImmediateLocks(),
          accountId: ACCOUNT,
        });
        await expect(guard.authorize(queued[0]!)).resolves.toBe('dispatch');
        // The one-time run authorises its own resolution work without ever
        // turning the character's preference on.
        await expect(
          new AutomaticCharacterSyncPreferences(
            database
          ).readConfirmedSelection(NAMESPACE, ['hero-a'])
        ).resolves.toMatchObject({ characterPolicies: { 'hero-a': 'off' } });
      } finally {
        database.close();
      }
    });

    it('still holds preference-off for ongoing paused work and for one-time entries without origin', async () => {
      await seedRun({ mode: 'ongoing' });
      await createOngoingHarness().start();
      const [paused] = (await readStore(
        'outbox'
      )) as AutomaticCharacterOutboxEntry[];
      await setCharacterPolicy('hero-a', false);

      await expect(
        createPlayerBackupDispatchGuard({
          factory: indexedDB,
          locks: new ImmediateLocks(),
          accountId: ACCOUNT,
        }).authorize(paused!)
      ).resolves.toEqual({ hold: 'preference-off' });

      await deleteRollkeeperDatabaseForTests(indexedDB);
      await seedRun();
      const harness = createHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 4,
        clientRevision: 4,
      });
      await harness.execute();
      const [contested] = (await readStore(
        'outbox'
      )) as AutomaticCharacterOutboxEntry[];
      const unstamped: AutomaticCharacterOutboxEntry = { ...contested! };
      delete unstamped.originPlayerBackupRunId;

      await expect(
        createPlayerBackupDispatchGuard({
          factory: indexedDB,
          locks: new ImmediateLocks(),
          accountId: ACCOUNT,
        }).authorize(unstamped)
      ).resolves.toEqual({ hold: 'preference-off' });
    });

    it('holds stale-origin work unchanged', async () => {
      await seedRun();
      const harness = createHarness();
      await seedRow(harness.gateway, {
        cloudId: 'cloud-a',
        legacyId: 'hero-a',
        character: HERO_A_OLD,
        serverVersion: 4,
        clientRevision: 4,
      });
      await harness.execute();
      const [contested] = (await readStore(
        'outbox'
      )) as AutomaticCharacterOutboxEntry[];

      await expect(
        createPlayerBackupDispatchGuard({
          factory: indexedDB,
          locks: new ImmediateLocks(),
          accountId: ACCOUNT,
        }).authorize({ ...contested!, originPlayerBackupRunId: 'run-old' })
      ).resolves.toEqual({ hold: 'stale-origin' });
    });
  });
});
