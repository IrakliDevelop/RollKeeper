import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import { exportTableBundle, importTableBundle } from './bundle';
import { TableRepository, type TableWorkspaceSelection } from './repository';
import {
  canonicalJson,
  validateSceneRecord,
  type TableSceneRecordV1,
} from './schema';
import { runSceneCommand, type TableSceneCommandV1 } from './sceneCommands';

const AT = '2026-10-08T00:00:00.000Z';
const selection: TableWorkspaceSelection = {
  account: { kind: 'authenticated', accountId: 'account-scenes' },
  workspace: { localWorkspaceId: 'workspace-scenes' },
};
const repositories: TableRepository[] = [];
afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

async function open(
  options: {
    factory?: IDBFactory;
    beforeTransactionCommit?: ConstructorParameters<
      typeof TableRepository
    >[0]['beforeTransactionCommit'];
  } = {}
) {
  const repository = new TableRepository({
    factory: options.factory ?? new IDBFactory(),
    selection,
    broadcastChannel: null,
    events: null,
    now: () => AT,
    beforeTransactionCommit: options.beforeTransactionCommit,
  });
  repositories.push(repository);
  await repository.start();
  return repository;
}

function snapshotOf(repository: TableRepository) {
  const current = repository.getCurrent();
  if (current?.status !== 'ready') throw new Error('not ready');
  return current.snapshot;
}

const revisionOf = (repository: TableRepository) =>
  snapshotOf(repository).campaign?.revision ?? 0;

const create = (
  overrides: Partial<
    Extract<TableSceneCommandV1, { type: 'scene.create' }>
  > = {}
): TableSceneCommandV1 => ({
  type: 'scene.create',
  sceneId: 'scene-forest',
  name: 'Forest',
  mapImageUrl: '',
  mapImageSize: { w: 0, h: 0 },
  at: AT,
  ...overrides,
});

function run(
  repository: TableRepository,
  command: TableSceneCommandV1,
  operationId = `op-${crypto.randomUUID()}`
) {
  return runSceneCommand(repository, {
    expectedRevision: revisionOf(repository),
    operationId,
    command,
  });
}

describe('A2 scene.create', () => {
  it('creates a valid blank scene without touching source mappings', async () => {
    const repository = await open();
    const result = await run(repository, create());
    expect(result).toMatchObject({ status: 'committed', revision: 1 });
    const snapshot = snapshotOf(repository);
    const scene = snapshot.scenes.find(item => item.sceneId === 'scene-forest');
    expect(scene).toEqual({
      schemaVersion: 1,
      workspaceKey: repository.workspaceIdentity,
      sceneId: 'scene-forest',
      originalMapId: null,
      map: {
        name: 'Forest',
        mapImageUrl: '',
        mapImageSize: { w: 0, h: 0 },
        gridEnabled: false,
        gridSettings: null,
        markers: [],
        dmOnlyElements: {},
      },
      canvasCheckpoint: null,
      members: [],
      arrivalPoint: null,
      createdAt: AT,
      updatedAt: AT,
    } satisfies TableSceneRecordV1);
    expect(validateSceneRecord(scene).ok).toBe(true);
    expect(snapshot.campaign?.sourceMappings).toEqual([]);
    expect(snapshot.sources).toEqual([]);
  });

  it('creates an image scene from an https URL with its natural size', async () => {
    const repository = await open();
    await expect(
      run(
        repository,
        create({
          sceneId: 'scene-tavern',
          name: 'Tavern',
          mapImageUrl: 'https://bucket.s3.eu-west-1.amazonaws.com/maps/t.webp',
          mapImageSize: { w: 2048, h: 1536 },
        })
      )
    ).resolves.toMatchObject({ status: 'committed' });
    const scene = snapshotOf(repository).scenes[0]!;
    expect(scene.map.mapImageUrl).toBe(
      'https://bucket.s3.eu-west-1.amazonaws.com/maps/t.webp'
    );
    expect(scene.map.mapImageSize).toEqual({ w: 2048, h: 1536 });
  });

  it.each([
    ['http URL', { mapImageUrl: 'http://example.test/map.png' }],
    ['data URL', { mapImageUrl: 'data:image/png;base64,AAAA' }],
    ['javascript URL', { mapImageUrl: 'javascript:alert(1)' }],
    ['relative URL', { mapImageUrl: '/maps/forest.webp' }],
    ['empty name', { name: '   ' }],
    ['overlong name', { name: 'x'.repeat(201) }],
    ['negative size', { mapImageSize: { w: -1, h: 10 } }],
    ['non-finite size', { mapImageSize: { w: Number.NaN, h: 10 } }],
    ['missing scene id', { sceneId: '' }],
  ])('rejects %s and writes nothing', async (_label, overrides) => {
    const repository = await open();
    const result = await run(repository, create(overrides));
    expect(result).toMatchObject({ status: 'rejected' });
    expect(snapshotOf(repository).scenes).toEqual([]);
    expect(revisionOf(repository)).toBe(0);
  });

  it('accepts a 200-character name', async () => {
    const repository = await open();
    await expect(
      run(repository, create({ name: 'y'.repeat(200) }))
    ).resolves.toMatchObject({ status: 'committed' });
  });

  it('never overwrites an existing scene id', async () => {
    const repository = await open();
    await run(repository, create());
    const result = await run(repository, create({ name: 'Other' }));
    expect(result).toMatchObject({
      status: 'rejected',
      detail: 'scene-exists',
    });
    expect(snapshotOf(repository).scenes[0]!.map.name).toBe('Forest');
  });

  it('replays the same operation id and rejects a different digest', async () => {
    const repository = await open();
    const first = await runSceneCommand(repository, {
      expectedRevision: 0,
      operationId: 'create-forest',
      command: create(),
    });
    const replay = await runSceneCommand(repository, {
      expectedRevision: 0,
      operationId: 'create-forest',
      command: create(),
    });
    expect(replay).toEqual(first);
    expect(snapshotOf(repository).scenes).toHaveLength(1);
    expect(revisionOf(repository)).toBe(1);
    const mismatch = await runSceneCommand(repository, {
      expectedRevision: 0,
      operationId: 'create-forest',
      command: create({ name: 'Different' }),
    });
    expect(mismatch).toEqual({
      status: 'rejected',
      reason: 'operation-digest-mismatch',
    });
  });

  it('enforces the scene cap before writing', async () => {
    const repository = await open();
    const key = repository.workspaceIdentity;
    const scenes = Array.from({ length: 100 }, (_, index) => ({
      schemaVersion: 1 as const,
      workspaceKey: key,
      sceneId: `seed-${index}`,
      originalMapId: null,
      map: {
        name: `Seed ${index}`,
        mapImageUrl: '',
        mapImageSize: { w: 0, h: 0 },
        gridEnabled: false,
        gridSettings: null,
        markers: [],
        dmOnlyElements: {},
      },
      canvasCheckpoint: null,
      members: [],
      arrivalPoint: null,
      createdAt: AT,
      updatedAt: AT,
    }));
    await repository.mutateWorkspace(0, 'seed', { scenes: { put: scenes } });
    const result = await run(repository, create());
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'limit-exceeded',
    });
    expect(snapshotOf(repository).scenes).toHaveLength(100);
  });

  it.each(['quota', 'abort'])(
    'leaves the workspace unchanged on %s',
    async mode => {
      let failNext = false;
      const repository = await open({
        beforeTransactionCommit: ({ transaction }) => {
          if (!failNext) return;
          failNext = false;
          transaction.abort();
          if (mode === 'quota')
            throw new DOMException('quota exhausted', 'QuotaExceededError');
        },
      });
      await run(repository, create({ sceneId: 'existing', name: 'Existing' }));
      const before = canonicalJson(snapshotOf(repository));
      failNext = true;
      const result = await run(repository, create());
      expect(result).toMatchObject({
        status: 'failed',
        reason: mode === 'quota' ? 'quota-exceeded' : 'transaction-failed',
      });
      await repository.reload();
      expect(canonicalJson(snapshotOf(repository))).toBe(before);
    }
  );
});

describe('A2 scene.setArrivalPoint', () => {
  it('sets, replaces and clears the arrival point', async () => {
    const repository = await open();
    await run(repository, create());
    await expect(
      run(repository, {
        type: 'scene.setArrivalPoint',
        sceneId: 'scene-forest',
        point: { x: 120, y: -40 },
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'committed' });
    expect(snapshotOf(repository).scenes[0]!.arrivalPoint).toEqual({
      x: 120,
      y: -40,
    });
    await expect(
      run(repository, {
        type: 'scene.setArrivalPoint',
        sceneId: 'scene-forest',
        point: { x: 120, y: -40 },
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'unchanged' });
    await run(repository, {
      type: 'scene.setArrivalPoint',
      sceneId: 'scene-forest',
      point: null,
      at: AT,
    });
    expect(snapshotOf(repository).scenes[0]!.arrivalPoint).toBeNull();
  });

  it('rejects a missing scene and a non-finite point', async () => {
    const repository = await open();
    await run(repository, create());
    await expect(
      run(repository, {
        type: 'scene.setArrivalPoint',
        sceneId: 'nowhere',
        point: { x: 1, y: 1 },
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'rejected' });
    await expect(
      run(repository, {
        type: 'scene.setArrivalPoint',
        sceneId: 'scene-forest',
        point: { x: Number.POSITIVE_INFINITY, y: 1 },
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'rejected' });
    expect(snapshotOf(repository).scenes[0]!.arrivalPoint).toBeNull();
  });
});

describe('A2 bundle compatibility', () => {
  it('round-trips created scenes and arrival points byte-stably', async () => {
    const factory = new IDBFactory();
    const source = await open({ factory });
    await run(source, create());
    await run(
      source,
      create({
        sceneId: 'scene-tavern',
        name: 'Tavern',
        mapImageUrl: 'https://example.test/tavern.webp',
        mapImageSize: { w: 10, h: 20 },
      })
    );
    await run(source, {
      type: 'scene.setArrivalPoint',
      sceneId: 'scene-tavern',
      point: { x: 5, y: 6 },
      at: AT,
    });
    const raw = await exportTableBundle(source);
    await expect(
      importTableBundle({
        factory,
        account: selection.account,
        activeWorkspaceKey: source.workspaceIdentity,
        targetCampaignCode: 'CAMP-A',
        raw,
        newWorkspaceId: () => 'scenes-import',
        now: () => AT,
      })
    ).resolves.toMatchObject({ status: 'imported' });
    const target = new TableRepository({
      factory,
      selection: {
        account: selection.account,
        workspace: {
          localWorkspaceId: 'scenes-import',
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
    const sorted = (scenes: readonly TableSceneRecordV1[]) =>
      [...scenes].sort((a, b) => a.sceneId.localeCompare(b.sceneId)).map(strip);
    expect(sorted(loaded.snapshot.scenes)).toEqual(
      sorted(snapshotOf(source).scenes)
    );
  });
});
