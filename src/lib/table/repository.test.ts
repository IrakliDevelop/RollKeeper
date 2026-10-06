import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { openTableDatabase, transactionComplete } from './database';
import {
  TableRepository,
  resolveTableWorkspaceSelection,
  resolveTableWorkspaceKey,
  type TableBroadcastChannel,
  type TableWorkspaceSelection,
} from './repository';
import type { TableActorRecordV1, TableRuntimeCommandV1 } from './schema';

const selection = (
  accountId = 'account-a',
  localWorkspaceId = 'workspace-a'
): TableWorkspaceSelection => ({
  account: { kind: 'authenticated', accountId },
  workspace: { localWorkspaceId },
});

const actor = (
  workspaceKey: string,
  actorId = 'actor-1',
  currentHp = 11
): TableActorRecordV1 => ({
  schemaVersion: 1,
  workspaceKey,
  actorId,
  actorKind: 'dm-managed',
  liveStats: {
    name: 'Guard',
    currentHp,
    maxHp: 11,
    tempHp: 0,
    armorClass: 16,
    conditions: [],
  },
  playerReference: null,
  cachedPlayerData: null,
  playerConditionOverlay: null,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
});

const runtimeCommand = (
  workspaceKey: string,
  currentHp = 11,
  suffix = '1'
): TableRuntimeCommandV1 => ({
  type: 'runtime.commit',
  campaign: {
    selectedRunId: `run-${suffix}`,
    activeRunId: `run-${suffix}`,
  },
  actors: {
    put: [actor(workspaceKey, `actor-${suffix}`, currentHp)],
    delete: [],
  },
  encounters: {
    put: [
      {
        schemaVersion: 1,
        workspaceKey,
        runId: `run-${suffix}`,
        sceneId: 'scene-1',
        sourceEncounterId: `source-${suffix}`,
        runGeneration: `generation-${suffix}`,
        participants: [
          {
            actorId: `actor-${suffix}`,
            initiative: null,
            turnResources: { reactionAvailable: true, legendaryActionsUsed: 0 },
          },
        ],
        round: 0,
        currentActorId: null,
        isActive: false,
        createdAt: '2026-10-05T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
      },
    ],
    delete: [],
  },
  logs: {
    put: [
      {
        schemaVersion: 1,
        workspaceKey,
        archiveId: `archive-${suffix}`,
        runId: `run-${suffix}`,
        events: [],
        startedAt: '2026-10-05T00:00:00.000Z',
        endedAt: null,
      },
    ],
    delete: [],
  },
});

class BroadcastBus {
  private readonly listeners = new Set<(event: MessageEvent) => void>();

  create(): TableBroadcastChannel {
    return {
      postMessage: value => {
        const event = new MessageEvent('message', {
          data: structuredClone(value),
        });
        queueMicrotask(() => {
          for (const listener of this.listeners) listener(event);
        });
      },
      addEventListener: (_type, listener) => this.listeners.add(listener),
      removeEventListener: (_type, listener) => this.listeners.delete(listener),
      close: () => undefined,
    };
  }
}

const repositories: TableRepository[] = [];

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.dispose();
});

describe('table repository', () => {
  it('assigns a missing legacy workspace UUID once and rejects mapping collisions', async () => {
    const factory = new IDBFactory();
    const randomUUID = vi
      .fn<() => string>()
      .mockReturnValueOnce('workspace-generated-a')
      .mockReturnValueOnce('workspace-generated-b');
    const request = {
      factory,
      account: { kind: 'guest' as const },
      workspace: { sourceCampaignCode: 'LEGACY-CODE' },
      randomUUID,
    };

    const first = await resolveTableWorkspaceSelection(request);
    const second = await resolveTableWorkspaceSelection(request);

    expect(first).toEqual(second);
    expect(first.workspace.localWorkspaceId).toBe('workspace-generated-a');
    expect(randomUUID).toHaveBeenCalledTimes(1);
    await expect(
      resolveTableWorkspaceSelection({
        ...request,
        workspace: {
          localWorkspaceId: 'different-workspace',
          sourceCampaignCode: 'LEGACY-CODE',
        },
      })
    ).rejects.toThrow('collision requires selection');
  });

  it('commits campaign, actor, run, log and operation atomically and awaits completion', async () => {
    const factory = new IDBFactory();
    const scopes: string[][] = [];
    const repository = new TableRepository({
      factory,
      selection: selection(),
      transactionStarted: transaction =>
        scopes.push([...transaction.objectStoreNames]),
    });
    repositories.push(repository);
    await repository.start();
    const workspaceKey = resolveTableWorkspaceKey(selection());

    const result = await repository.commit(
      0,
      'operation-1',
      runtimeCommand(workspaceKey)
    );

    expect(result).toMatchObject({ status: 'committed', revision: 1 });
    expect(scopes.at(-1)).toEqual([
      'actors',
      'campaigns',
      'encounters',
      'logs',
      'operations',
    ]);
    const loaded = await repository.reload();
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') throw new Error('expected ready repository');
    expect(loaded.snapshot.campaign?.revision).toBe(1);
    expect(loaded.snapshot.actors).toHaveLength(1);
    expect(loaded.snapshot.encounters).toHaveLength(1);
    expect(loaded.snapshot.logs).toHaveLength(1);
    expect(Object.isFrozen(loaded.snapshot)).toBe(true);
    expect(() =>
      loaded.snapshot.actors.push(actor(workspaceKey, 'mutant'))
    ).toThrow();
  });

  it('returns CAS conflicts and serializes two repository instances through IndexedDB', async () => {
    const factory = new IDBFactory();
    const first = new TableRepository({ factory, selection: selection() });
    const second = new TableRepository({ factory, selection: selection() });
    repositories.push(first, second);
    await Promise.all([first.start(), second.start()]);
    const workspaceKey = resolveTableWorkspaceKey(selection());

    const [left, right] = await Promise.all([
      first.commit(
        0,
        'operation-left',
        runtimeCommand(workspaceKey, 11, 'left')
      ),
      second.commit(
        0,
        'operation-right',
        runtimeCommand(workspaceKey, 12, 'right')
      ),
    ]);

    expect([left.status, right.status].sort()).toEqual([
      'committed',
      'conflict',
    ]);
    const conflict = left.status === 'conflict' ? left : right;
    expect(conflict).toMatchObject({ status: 'conflict', actualRevision: 1 });
    const loaded = await first.reload();
    expect(
      loaded.status === 'ready' && loaded.snapshot.campaign?.revision
    ).toBe(1);
  });

  it('replays the same operation digest, rejects mismatches, and never reapplies evicted outcomes', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection: selection() });
    repositories.push(repository);
    await repository.start();
    const workspaceKey = resolveTableWorkspaceKey(selection());
    const firstCommand = runtimeCommand(workspaceKey);
    const first = await repository.commit(0, 'operation-1', firstCommand);

    await expect(
      repository.commit(0, 'operation-1', firstCommand)
    ).resolves.toEqual(first);
    await expect(
      repository.commit(1, 'operation-1', runtimeCommand(workspaceKey, 3))
    ).resolves.toMatchObject({
      status: 'rejected',
      reason: 'operation-digest-mismatch',
    });

    for (let revision = 1; revision <= 256; revision += 1) {
      const suffix = String(revision + 1);
      const outcome = await repository.commit(
        revision,
        `operation-${suffix}`,
        runtimeCommand(workspaceKey)
      );
      expect(outcome.status, JSON.stringify({ revision, outcome })).toBe(
        'committed'
      );
    }

    await expect(
      repository.commit(0, 'operation-1', firstCommand)
    ).resolves.toMatchObject({ status: 'conflict', actualRevision: 257 });
    await expect(
      repository.commit(256, 'operation-257', runtimeCommand(workspaceKey))
    ).resolves.toMatchObject({ status: 'committed', revision: 257 });
  }, 20_000);

  it('aborts quota/transaction failures without changing revision or unrelated records', async () => {
    const factory = new IDBFactory();
    const workspaceKey = resolveTableWorkspaceKey(selection());
    const repository = new TableRepository({
      factory,
      selection: selection(),
      beforeTransactionCommit: ({ operationId, transaction }) => {
        if (operationId === 'quota-operation') {
          transaction.abort();
          throw new DOMException('quota exhausted', 'QuotaExceededError');
        }
        if (operationId === 'abort-operation') transaction.abort();
      },
    });
    repositories.push(repository);
    await repository.start();
    await repository.commit(0, 'baseline', runtimeCommand(workspaceKey));

    await expect(
      repository.commit(
        1,
        'quota-operation',
        runtimeCommand(workspaceKey, 2, '2')
      )
    ).resolves.toMatchObject({ status: 'failed', reason: 'quota-exceeded' });
    await expect(
      repository.commit(
        1,
        'abort-operation',
        runtimeCommand(workspaceKey, 3, '3')
      )
    ).resolves.toMatchObject({
      status: 'failed',
      reason: 'transaction-failed',
    });

    const loaded = await repository.reload();
    if (loaded.status !== 'ready') throw new Error('expected ready repository');
    expect(loaded.snapshot.campaign?.revision).toBe(1);
    expect(loaded.snapshot.actors.map(value => value.actorId)).toEqual([
      'actor-1',
    ]);
    expect(loaded.snapshot.logs.map(value => value.archiveId)).toEqual([
      'archive-1',
    ]);
  });

  it('freezes unknown future schema reads and refuses mutation', async () => {
    const factory = new IDBFactory();
    const workspaceKey = resolveTableWorkspaceKey(selection());
    const database = await openTableDatabase({ factory });
    const transaction = database.transaction('campaigns', 'readwrite');
    transaction.objectStore('campaigns').put({
      schemaVersion: 2,
      workspaceKey,
      revision: 99,
      future: { nested: ['preserve-me'] },
    });
    await transactionComplete(transaction);
    database.close();

    const repository = new TableRepository({ factory, selection: selection() });
    repositories.push(repository);
    const loaded = await repository.start();
    expect(loaded).toMatchObject({
      status: 'read-only',
      reason: 'unknown-schema',
    });
    if (loaded.status !== 'read-only') throw new Error('expected read-only');
    expect(Object.isFrozen(loaded.raw)).toBe(true);
    expect(
      Object.isFrozen((loaded.raw.campaign as { future: object }).future)
    ).toBe(true);
    await expect(
      repository.commit(99, 'operation-1', runtimeCommand(workspaceKey))
    ).resolves.toMatchObject({ status: 'rejected', reason: 'unknown-schema' });
  });

  it('broadcasts invalidation only and reloads authoritative data before notifying', async () => {
    const factory = new IDBFactory();
    const bus = new BroadcastBus();
    const first = new TableRepository({
      factory,
      selection: selection(),
      broadcastChannel: bus.create(),
    });
    const second = new TableRepository({
      factory,
      selection: selection(),
      broadcastChannel: bus.create(),
    });
    repositories.push(first, second);
    await Promise.all([first.start(), second.start()]);
    const listener = vi.fn();
    second.subscribe(listener);
    const workspaceKey = resolveTableWorkspaceKey(selection());

    await first.commit(0, 'operation-1', runtimeCommand(workspaceKey));
    await vi.waitFor(() => {
      expect(second.getCurrent()?.status).toBe('ready');
      const current = second.getCurrent();
      expect(
        current?.status === 'ready' && current.snapshot.campaign?.revision
      ).toBe(1);
      expect(listener).toHaveBeenCalled();
    });
  });

  it('reloads on focus/visibility even without BroadcastChannel', async () => {
    const factory = new IDBFactory();
    const events = new EventTarget();
    let visible = true;
    const first = new TableRepository({ factory, selection: selection() });
    const second = new TableRepository({
      factory,
      selection: selection(),
      events,
      isVisible: () => visible,
    });
    repositories.push(first, second);
    await Promise.all([first.start(), second.start()]);
    const workspaceKey = resolveTableWorkspaceKey(selection());
    await first.commit(0, 'operation-1', runtimeCommand(workspaceKey));
    const beforeFocus = second.getCurrent();
    expect(
      beforeFocus?.status === 'ready' && beforeFocus.snapshot.campaign
    ).toBe(null);

    events.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => {
      const current = second.getCurrent();
      expect(
        current?.status === 'ready' && current.snapshot.campaign?.revision
      ).toBe(1);
    });

    visible = false;
    events.dispatchEvent(new Event('visibilitychange'));
    visible = true;
    events.dispatchEvent(new Event('visibilitychange'));
  });

  it('fails closed without IndexedDB and isolates account/workspace switches immediately', async () => {
    const unavailable = new TableRepository({
      factory: null,
      selection: selection(),
    });
    repositories.push(unavailable);
    await expect(unavailable.start()).resolves.toMatchObject({
      status: 'unavailable',
    });
    await expect(
      unavailable.commit(
        0,
        'operation-1',
        runtimeCommand(resolveTableWorkspaceKey(selection()))
      )
    ).resolves.toMatchObject({
      status: 'failed',
      reason: 'indexeddb-unavailable',
    });

    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection: selection() });
    repositories.push(repository);
    await repository.start();
    const firstKey = resolveTableWorkspaceKey(selection());
    await repository.commit(0, 'operation-1', runtimeCommand(firstKey));

    const switching = repository.switchWorkspace(
      selection('account-b', 'workspace-b')
    );
    expect(repository.getCurrent()).toBeNull();
    const next = await switching;
    expect(next.status).toBe('ready');
    if (next.status !== 'ready') throw new Error('expected ready repository');
    expect(next.snapshot.campaign).toBeNull();

    const noisyA = {
      ...selection(),
      displayName: 'Mutable name A',
      routeAccountId: 'attacker',
    } as TableWorkspaceSelection;
    const noisyB = {
      ...selection(),
      displayName: 'Mutable name B',
      routeAccountId: 'different-attacker',
    } as TableWorkspaceSelection;
    expect(resolveTableWorkspaceKey(noisyA)).toBe(
      resolveTableWorkspaceKey(noisyB)
    );
    expect(resolveTableWorkspaceKey(selection('account-a'))).not.toBe(
      resolveTableWorkspaceKey(selection('account-b'))
    );
    expect(
      resolveTableWorkspaceKey({
        account: { kind: 'guest' },
        workspace: { localWorkspaceId: 'legacy-campaign-id' },
      })
    ).toBe('guest/workspace:legacy-campaign-id');
  });
});
