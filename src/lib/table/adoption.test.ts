import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TableRepository,
  resolveTableWorkspaceKey,
  type TableWorkspaceSelection,
} from './repository';
import {
  adoptTableScene,
  captureAdoptionPreview,
  createPersistedLegacyTableAdoptionSource,
  type TableAdoptionSource,
} from './adoption';

const selection: TableWorkspaceSelection = {
  account: { kind: 'authenticated', accountId: 'account-a' },
  workspace: { localWorkspaceId: 'workspace-a' },
};

const mapRaw =
  '{\n  "id":"map-1", "campaignCode":"CAMP", "name":"Crypt",' +
  ' "mapImageUrl":"/maps/crypt.webp", "mapImageSize":{"w":1200,"h":800},' +
  ' "canvasState":"{\\"elements\\":[{\\"id\\":\\"token-original\\",\\"type\\":\\"token\\",\\"layerId\\":\\"tokens-original\\"}],\\"layers\\":[{\\"id\\":\\"tokens-original\\"}]}",' +
  ' "dmOnlyElements":{"token-original":true}, "gridEnabled":true,' +
  ' "gridSettings":{"size":50}, "linkedEncounterIds":["enc-1","enc-2"],' +
  ' "markers":[], "createdAt":"2026-10-05T00:00:00.000Z",' +
  ' "updatedAt":"2026-10-05T00:00:00.000Z"\n}';

const encounterRaw = (id: string) =>
  JSON.stringify({
    id,
    name: 'Same template name',
    entities: [
      {
        id: 'entity-1',
        name: 'Guard',
        currentHp: 11,
        maxHp: 11,
        tempHp: 0,
        armorClass: 16,
        conditions: [],
        initiative: null,
      },
    ],
    round: 0,
    currentTurn: 0,
    isActive: false,
  });

function source(readMap = () => mapRaw): TableAdoptionSource {
  return {
    readCampaign: vi.fn(async () => '{"code":"CAMP", "name":"Campaign"}'),
    readMap: vi.fn(async () => readMap()),
    readEncounter: vi.fn(async (_campaignId, id) => encounterRaw(id)),
  };
}

const repositories: TableRepository[] = [];

afterEach(() => {
  repositories.splice(0).forEach(repository => repository.dispose());
});

describe('Table scene adoption', () => {
  it('reads exact persisted record bytes before hydration, including whitespace, key order and escaped Unicode', async () => {
    const campaign =
      '{ "name" : "Caf\\u00e9", "code" : "CAMP", "notes" : "\\ud83c\\udf19" }';
    const map =
      '{ "name" : "Crypt", "id" : "map-1", "campaignCode" : "CAMP", "canvasState" : "{}", "mapImageUrl" : "", "mapImageSize" : {"h":800,"w":1200}, "gridEnabled" : false, "linkedEncounterIds" : ["enc-1"], "markers" : [], "dmOnlyElements" : {}, "createdAt" : "2026-10-05T00:00:00.000Z", "updatedAt" : "2026-10-05T00:00:00.000Z" }';
    const encounter =
      '{ "name" : "Garde \\u00e9lite", "id" : "enc-1", "entities" : [] }';
    const persisted = new Map([
      [
        'rollkeeper-dm-data',
        `{ "state" : { "campaigns" : [ ${campaign} ], "dmId":"dm" }, "version" : 1 }`,
      ],
      [
        'rollkeeper-battlemap-data',
        `{ "version" : 0, "state" : { "battleMaps" : { "CAMP" : { "map-1" : ${map} } } } }`,
      ],
      [
        'rollkeeper-encounter-data',
        `{ "state" : { "encounters" : [ ${encounter} ] }, "version" : 5 }`,
      ],
    ]);
    const input = createPersistedLegacyTableAdoptionSource({
      storage: { getItem: key => persisted.get(key) ?? null },
    });

    expect(await input.readCampaign('CAMP')).toBe(campaign);
    expect(await input.readMap('CAMP', 'map-1')).toBe(map);
    expect(await input.readEncounter('CAMP', 'enc-1')).toBe(encounter);

    const preview = await captureAdoptionPreview({
      source: input,
      workspaceKey: resolveTableWorkspaceKey(selection),
      sourceCampaignId: 'CAMP',
      sourceMapId: 'map-1',
      newId: vi
        .fn<() => string>()
        .mockReturnValueOnce('scene-exact')
        .mockReturnValueOnce('run-exact')
        .mockReturnValueOnce('generation-exact'),
    });
    expect(preview.sources.map(value => value.raw)).toEqual([
      campaign,
      map,
      encounter,
    ]);
  });

  it('preserves exact source bytes and canvas token/layer ids and creates distinct same-template runs', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    const input = source();
    const ids = vi
      .fn<() => string>()
      .mockReturnValueOnce('scene-1')
      .mockReturnValueOnce('run-1')
      .mockReturnValueOnce('generation-1')
      .mockReturnValueOnce('run-2')
      .mockReturnValueOnce('generation-2');

    const preview = await captureAdoptionPreview({
      source: input,
      workspaceKey: resolveTableWorkspaceKey(selection),
      sourceCampaignId: 'CAMP',
      sourceMapId: 'map-1',
      newId: ids,
      now: () => '2026-10-05T01:00:00.000Z',
    });
    const result = await adoptTableScene({
      repository,
      source: input,
      preview,
      expectedRevision: 0,
      operationId: 'adopt-map-1',
    });

    expect(result).toMatchObject({ status: 'committed', sceneId: 'scene-1' });
    const loaded = await repository.reload();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    expect(loaded.snapshot.sources.map(record => record.rawJson)).toEqual([
      '{"code":"CAMP", "name":"Campaign"}',
      encounterRaw('enc-1'),
      encounterRaw('enc-2'),
      mapRaw,
    ]);
    expect(loaded.snapshot.scenes[0]?.canvasCheckpoint?.state).toMatchObject({
      elements: [{ id: 'token-original', layerId: 'tokens-original' }],
      layers: [{ id: 'tokens-original' }],
    });
    expect(loaded.snapshot.encounters.map(run => run.runId)).toEqual([
      'run-1',
      'run-2',
    ]);
    expect(loaded.snapshot.actors.map(actor => actor.actorId)).toEqual([
      'enc-1:entity-1',
      'enc-2:entity-1',
    ]);
  });

  it('is idempotent and isolates later legacy writes from Table state', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    let currentMap = mapRaw;
    const input = source(() => currentMap);
    const preview = await captureAdoptionPreview({
      source: input,
      workspaceKey: resolveTableWorkspaceKey(selection),
      sourceCampaignId: 'CAMP',
      sourceMapId: 'map-1',
      newId: vi
        .fn<() => string>()
        .mockReturnValueOnce('scene-1')
        .mockReturnValueOnce('run-1')
        .mockReturnValueOnce('generation-1')
        .mockReturnValueOnce('run-2')
        .mockReturnValueOnce('generation-2'),
      now: () => '2026-10-05T01:00:00.000Z',
    });

    const first = await adoptTableScene({
      repository,
      source: input,
      preview,
      expectedRevision: 0,
      operationId: 'adopt-map-1',
    });
    const replay = await adoptTableScene({
      repository,
      source: input,
      preview,
      expectedRevision: 0,
      operationId: 'adopt-map-1',
    });
    expect(replay).toEqual(first);

    currentMap = mapRaw.replace('Crypt', 'Old tab overwrite');
    const afterOldTabWrite = await repository.reload();
    if (afterOldTabWrite.status !== 'ready') throw new Error('expected ready');
    expect(afterOldTabWrite.snapshot.scenes).toHaveLength(1);
    expect(afterOldTabWrite.snapshot.scenes[0]?.map.name).toBe('Crypt');
  });

  it('detects a source change immediately before commit and leaves the repository untouched', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    let currentMap = mapRaw;
    const input = source(() => currentMap);
    const preview = await captureAdoptionPreview({
      source: input,
      workspaceKey: resolveTableWorkspaceKey(selection),
      sourceCampaignId: 'CAMP',
      sourceMapId: 'map-1',
      newId: () => crypto.randomUUID(),
    });
    currentMap = mapRaw.replace('Crypt', 'Changed');

    await expect(
      adoptTableScene({
        repository,
        source: input,
        preview,
        expectedRevision: 0,
        operationId: 'adopt-map-1',
      })
    ).resolves.toMatchObject({ status: 'source-changed' });
    const loaded = await repository.reload();
    expect(loaded.status === 'ready' && loaded.snapshot.scenes).toHaveLength(0);
  });
});

describe('W9 never-opened map adoption', () => {
  it.each(['', '   '])(
    'adopts a map whose canvasState is %j as an empty adoption checkpoint',
    async canvasState => {
      const neverOpened = JSON.stringify({
        id: 'map-blank',
        campaignCode: 'CAMP',
        name: 'Fresh map',
        mapImageUrl: '/maps/fresh.webp',
        mapImageSize: { w: 640, h: 480 },
        canvasState,
        dmOnlyElements: {},
        gridEnabled: false,
        linkedEncounterIds: [],
        markers: [],
        createdAt: '2026-10-05T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
      });
      const repository = new TableRepository({
        factory: new IDBFactory(),
        selection,
      });
      repositories.push(repository);
      await repository.start();
      const input = source(() => neverOpened);
      const preview = await captureAdoptionPreview({
        source: input,
        workspaceKey: repository.workspaceIdentity,
        sourceCampaignId: 'CAMP',
        sourceMapId: 'map-blank',
      });
      expect(preview.scene.canvasCheckpoint?.state).toEqual({});
      expect(preview.scene.map.mapImageUrl).toBe('/maps/fresh.webp');
      await expect(
        adoptTableScene({
          repository,
          source: input,
          preview,
          expectedRevision: 0,
          operationId: 'adopt-blank',
        })
      ).resolves.toMatchObject({ status: 'committed' });
    }
  );
});
