import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import { exportTableBundle, importTableBundle } from './bundle';
import { TABLE_DATABASE_VERSION } from './database';
import { TableRepository, type TableWorkspaceSelection } from './repository';
import {
  deriveSceneRoster,
  runRosterCommand,
  type TableCampaignPlayer,
  type TableRosterCommandV1,
} from './roster';
import {
  canonicalJson,
  validateSceneRecord,
  type TableActorRecordV1,
  type TableSceneMemberV1,
  type TableSceneRecordV1,
} from './schema';

/**
 * PR07 M3: one additive optional member field `representation: 'physical'`
 * (absent = digital), schemaVersion 1 and the IDB version unchanged; the
 * `roster.setRepresentation` command commits through `mutateWorkspace`.
 */

const AT = '2026-10-08T00:00:00.000Z';
const selection: TableWorkspaceSelection = {
  account: { kind: 'authenticated', accountId: 'account-a' },
  workspace: { localWorkspaceId: 'workspace-representation' },
};
const players: TableCampaignPlayer[] = [
  { playerId: 'legacy-a', characterId: 'legacy-a', name: 'Aria' },
];
const repositories: TableRepository[] = [];
afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

function scene(
  workspaceKey: string,
  members: TableSceneMemberV1[] = []
): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    sceneId: 'tavern',
    originalMapId: null,
    map: {
      name: 'Tavern',
      mapImageUrl: '/tavern.webp',
      mapImageSize: { w: 100, h: 100 },
      gridEnabled: false,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint: null,
    members,
    arrivalPoint: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

function managed(workspaceKey: string, actorId: string): TableActorRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId,
    actorKind: 'dm-managed',
    liveStats: {
      name: actorId,
      currentHp: 7,
      maxHp: 7,
      tempHp: 0,
      armorClass: 12,
      conditions: [],
    },
    playerReference: null,
    cachedPlayerData: null,
    playerConditionOverlay: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

async function open(
  factory = new IDBFactory(),
  options: Record<string, unknown> = {}
) {
  const repository = new TableRepository({
    factory,
    selection,
    broadcastChannel: null,
    events: null,
    ...options,
  });
  repositories.push(repository);
  await repository.start();
  return repository;
}

function snapshot(repository: TableRepository) {
  const current = repository.getCurrent();
  if (current?.status !== 'ready') throw new Error('repository not ready');
  return current.snapshot;
}
const revision = (repository: TableRepository) =>
  snapshot(repository).campaign?.revision ?? 0;
const members = (repository: TableRepository) =>
  snapshot(repository).scenes[0]!.members;

async function seed(repository: TableRepository) {
  const key = repository.workspaceIdentity;
  await repository.mutateWorkspace(0, 'seed', {
    actors: { put: [managed(key, 'goblin'), managed(key, 'ogre')] },
    scenes: {
      put: [
        scene(key, [
          { actorId: 'goblin', tokenIds: ['t1'], sceneMemberId: 'm-goblin' },
          {
            actorId: 'ogre',
            tokenIds: [],
            sceneMemberId: 'm-ogre',
            removedAt: AT,
          },
        ]),
      ],
    },
  });
}

const setRepresentation = (
  representation: 'physical' | 'digital',
  sceneMemberId = 'm-goblin'
): TableRosterCommandV1 => ({
  type: 'roster.setRepresentation',
  sceneId: 'tavern',
  sceneMemberId,
  representation,
  at: AT,
});

let operation = 0;
const run = (
  repository: TableRepository,
  command: TableRosterCommandV1,
  overrides: { operationId?: string; expectedRevision?: number } = {}
) =>
  runRosterCommand(repository, {
    expectedRevision: overrides.expectedRevision ?? revision(repository),
    operationId: overrides.operationId ?? `representation-${(operation += 1)}`,
    command,
    players,
  });

describe('member representation schema (M3)', () => {
  const record = (member: Record<string, unknown>) =>
    validateSceneRecord({
      ...scene('w', []),
      members: [{ actorId: 'a', tokenIds: [], ...member }],
    });

  it("accepts only 'physical'; absent means digital; schemaVersion and IDB version unchanged", () => {
    expect(record({})).toEqual({ ok: true });
    expect(record({ representation: 'physical' })).toEqual({ ok: true });
    for (const bad of ['digital', '', 'Physical', true, null, 1, {}])
      expect(record({ representation: bad }).ok, String(bad)).toBe(false);
    expect(TABLE_DATABASE_VERSION).toBe(1);
  });

  it('keeps PR01–PR06 member shapes valid', () => {
    for (const member of [
      {},
      { sceneMemberId: 'm1' },
      { sceneMemberId: 'm1', control: { kind: 'dm' } },
      {
        sceneMemberId: 'm1',
        control: { kind: 'player', legacyPlayerId: 'p', characterId: 'c' },
        removedAt: AT,
      },
    ])
      expect(record(member)).toEqual({ ok: true });
  });

  it('round-trips the field through export/import; records without it stay byte-stable', async () => {
    const factory = new IDBFactory();
    const source = await open(factory);
    const key = source.workspaceIdentity;
    await source.mutateWorkspace(0, 'seed', {
      actors: { put: [managed(key, 'goblin'), managed(key, 'ogre')] },
      scenes: {
        put: [
          scene(key, [
            {
              actorId: 'goblin',
              tokenIds: ['t1'],
              sceneMemberId: 'm-goblin',
              representation: 'physical',
            },
            { actorId: 'ogre', tokenIds: [], sceneMemberId: 'm-ogre' },
          ]),
        ],
      },
    });
    const raw = await exportTableBundle(source);
    const imported = await importTableBundle({
      factory,
      account: selection.account,
      activeWorkspaceKey: source.workspaceIdentity,
      targetCampaignCode: 'CAMP-A',
      raw,
      newWorkspaceId: () => 'pr07-import',
      now: () => AT,
    });
    expect(imported).toMatchObject({ status: 'imported' });
    const target = new TableRepository({
      factory,
      selection: {
        account: selection.account,
        workspace: {
          localWorkspaceId: 'pr07-import',
          sourceCampaignCode: null,
          routeCampaignCode: 'CAMP-A',
        },
      },
    });
    repositories.push(target);
    const loaded = await target.start();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    const strip = (value: TableSceneRecordV1) => {
      const copy = structuredClone(value) as Partial<TableSceneRecordV1>;
      delete copy.workspaceKey;
      return canonicalJson(copy);
    };
    expect(loaded.snapshot.scenes.map(strip)).toEqual(
      snapshot(source).scenes.map(strip)
    );
    expect(loaded.snapshot.scenes[0]!.members).toEqual([
      {
        actorId: 'goblin',
        tokenIds: ['t1'],
        sceneMemberId: 'm-goblin',
        representation: 'physical',
      },
      { actorId: 'ogre', tokenIds: [], sceneMemberId: 'm-ogre' },
    ]);
  });
});

describe('roster.setRepresentation (M3)', () => {
  it('physical sets the key, digital deletes it; both are idempotent and one transaction each', async () => {
    const repository = await open();
    await seed(repository);
    await expect(
      run(repository, setRepresentation('physical'))
    ).resolves.toMatchObject({ status: 'committed', revision: 2 });
    expect(members(repository)[0]).toEqual({
      actorId: 'goblin',
      tokenIds: ['t1'],
      sceneMemberId: 'm-goblin',
      representation: 'physical',
    });
    await expect(
      run(repository, setRepresentation('physical'))
    ).resolves.toEqual({ status: 'unchanged', revision: 2 });
    await expect(
      run(repository, setRepresentation('digital'))
    ).resolves.toMatchObject({ status: 'committed', revision: 3 });
    expect(members(repository)[0]).toEqual({
      actorId: 'goblin',
      tokenIds: ['t1'],
      sceneMemberId: 'm-goblin',
    });
    expect(Object.hasOwn(members(repository)[0]!, 'representation')).toBe(
      false
    );
    await expect(
      run(repository, setRepresentation('digital'))
    ).resolves.toEqual({ status: 'unchanged', revision: 3 });
  });

  it('derives the member representation for the roster', async () => {
    const repository = await open();
    await seed(repository);
    await run(repository, setRepresentation('physical'));
    const roster = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
      players,
    });
    expect(
      roster.entries.map(entry => [entry.actorId, entry.representation])
    ).toEqual([
      ['goblin', 'physical'],
      ['ogre', 'digital'],
    ]);
  });

  it('replays the same operation, refuses a different intent under it and conflicts on a stale revision', async () => {
    const repository = await open();
    await seed(repository);
    await expect(
      run(repository, setRepresentation('physical'), { operationId: 'op' })
    ).resolves.toMatchObject({ status: 'committed', revision: 2 });
    await expect(
      run(repository, setRepresentation('physical'), {
        operationId: 'op',
        expectedRevision: 1,
      })
    ).resolves.toMatchObject({ status: 'committed', revision: 2 });
    await expect(
      run(repository, setRepresentation('digital'), {
        operationId: 'op',
        expectedRevision: 1,
      })
    ).resolves.toMatchObject({
      status: 'rejected',
      reason: 'operation-digest-mismatch',
    });
    await expect(
      run(repository, setRepresentation('digital'), { expectedRevision: 1 })
    ).resolves.toEqual({ status: 'conflict', actualRevision: 2 });
  });

  it('rejects removed or missing members and malformed values', async () => {
    const repository = await open();
    await seed(repository);
    await expect(
      run(repository, setRepresentation('physical', 'm-ogre'))
    ).resolves.toMatchObject({ status: 'rejected', detail: 'member-missing' });
    await expect(
      run(repository, setRepresentation('physical', 'nobody'))
    ).resolves.toMatchObject({ status: 'rejected', detail: 'member-missing' });
    await expect(
      run(repository, {
        ...setRepresentation('physical'),
        representation: 'cardboard',
      } as never)
    ).resolves.toMatchObject({ status: 'rejected', detail: 'malformed' });
    expect(revision(repository)).toBe(1);
  });

  it('leaves state untouched on a quota abort', async () => {
    const repository = await open(new IDBFactory(), {
      beforeTransactionCommit: ({
        operationId,
        transaction,
      }: {
        operationId: string;
        transaction: IDBTransaction;
      }) => {
        if (operationId === 'quota') {
          transaction.abort();
          throw new DOMException('quota', 'QuotaExceededError');
        }
      },
    });
    await seed(repository);
    await expect(
      run(repository, setRepresentation('physical'), { operationId: 'quota' })
    ).resolves.toMatchObject({ status: 'failed', reason: 'quota-exceeded' });
    const reloaded = await repository.reload();
    if (reloaded.status !== 'ready') throw new Error('not ready');
    expect(reloaded.snapshot.scenes[0]!.members[0]).not.toHaveProperty(
      'representation'
    );
    expect(reloaded.snapshot.campaign?.revision).toBe(1);
  });
});
