import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { openTableDatabase, requestResult } from './database';
import { openTableWorkspace } from './sceneAdapter';

import type {
  TableActorRecordV1,
  TableSceneMemberV1,
  TableSceneRecordV1,
  TableWorkspaceSnapshotV1,
} from './schema';
import { readTableShopEntityIds, tableShopEntityIds } from './shopLinks';

const workspaceKey = 'guest/workspace:shop-links';
const NPC = 'npc-merchant';

function actor(
  actorId: string,
  profile?: TableActorRecordV1['profile']
): TableActorRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId,
    actorKind: 'dm-managed',
    liveStats: {
      name: 'Merchant',
      currentHp: 10,
      maxHp: 10,
      tempHp: 0,
      armorClass: 12,
      conditions: [],
    },
    playerReference: null,
    cachedPlayerData: null,
    playerConditionOverlay: null,
    ...(profile ? { profile } : {}),
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
  };
}

function scene(
  sceneId: string,
  members: TableSceneMemberV1[]
): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    sceneId,
    originalMapId: null,
    map: {
      name: sceneId,
      mapImageUrl: '',
      mapImageSize: { w: 1, h: 1 },
      gridEnabled: false,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint: null,
    members,
    arrivalPoint: null,
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
  };
}

function snapshot(
  parts: Partial<TableWorkspaceSnapshotV1>
): TableWorkspaceSnapshotV1 {
  return {
    workspaceKey,
    campaign: null,
    scenes: [],
    actors: [],
    encounters: [],
    logs: [],
    sources: [],
    tombstones: [],
    ...parts,
  };
}

const npcProfile = {
  category: 'npc' as const,
  sourceKind: 'campaign-npc' as const,
  sourceId: NPC,
};

describe('tableShopEntityIds (repair 09 D2)', () => {
  it('links a Table member whose actor came from the campaign NPC', () => {
    expect(
      tableShopEntityIds(
        snapshot({
          actors: [actor('actor-1', npcProfile)],
          scenes: [
            scene('scene-1', [
              { actorId: 'actor-1', tokenIds: [], sceneMemberId: 'member-1' },
            ]),
          ],
        }),
        NPC
      )
    ).toEqual(['member-1']);
  });

  it('links the member in every scene, once each', () => {
    expect(
      tableShopEntityIds(
        snapshot({
          actors: [actor('actor-1', npcProfile)],
          scenes: [
            scene('scene-1', [
              { actorId: 'actor-1', tokenIds: [], sceneMemberId: 'member-1' },
              { actorId: 'actor-1', tokenIds: [], sceneMemberId: 'member-1' },
            ]),
            scene('scene-2', [
              { actorId: 'actor-1', tokenIds: [], sceneMemberId: 'member-2' },
            ]),
          ],
        }),
        NPC
      )
    ).toEqual(['member-1', 'member-2']);
  });

  it.each([
    [
      'a removed member',
      {
        actorId: 'actor-1',
        tokenIds: [],
        sceneMemberId: 'member-1',
        removedAt: '2026-10-15T01:00:00.000Z',
      },
    ],
    ['a member without a member id', { actorId: 'actor-1', tokenIds: [] }],
    [
      'a player-controlled member',
      {
        actorId: 'actor-1',
        tokenIds: [],
        sceneMemberId: 'member-1',
        control: { kind: 'player' as const, legacyPlayerId: 'player-a' },
      },
    ],
  ])('skips %s', (_label, member) => {
    expect(
      tableShopEntityIds(
        snapshot({
          actors: [actor('actor-1', npcProfile)],
          scenes: [scene('scene-1', [member])],
        }),
        NPC
      )
    ).toEqual([]);
  });

  it.each([
    [
      'a bestiary creature with the same id',
      {
        category: 'monster' as const,
        sourceKind: 'bestiary' as const,
        sourceId: NPC,
      },
    ],
    ['another campaign NPC', { ...npcProfile, sourceId: 'npc-other' }],
    [
      'a manual creature',
      { category: 'npc' as const, sourceKind: 'manual' as const },
    ],
  ])('skips %s', (_label, profile) => {
    expect(
      tableShopEntityIds(
        snapshot({
          actors: [actor('actor-1', profile)],
          scenes: [
            scene('scene-1', [
              { actorId: 'actor-1', tokenIds: [], sceneMemberId: 'member-1' },
            ]),
          ],
        }),
        NPC
      )
    ).toEqual([]);
  });

  it('links an adopted encounter NPC by its member id and its legacy entity id', () => {
    const encounterId = 'encounter-1';
    const entityId = 'entity-merchant';
    const actorId = `${encounterId}:${entityId}`;
    expect(
      tableShopEntityIds(
        snapshot({
          actors: [actor(actorId)],
          encounters: [
            {
              schemaVersion: 1,
              workspaceKey,
              runId: 'run-1',
              sceneId: 'scene-1',
              sourceEncounterId: encounterId,
              runGeneration: 'generation-1',
              participants: [],
              round: 0,
              currentActorId: null,
              isActive: false,
              createdAt: '2026-10-15T00:00:00.000Z',
              updatedAt: '2026-10-15T00:00:00.000Z',
            },
          ],
          sources: [
            {
              schemaVersion: 1,
              workspaceKey,
              sourceKey: `encounter:${encounterId}`,
              sourceKind: 'encounter',
              sourceId: encounterId,
              rawJson: JSON.stringify({
                id: encounterId,
                entities: [
                  { id: entityId, npcSourceId: NPC },
                  { id: 'entity-guard', npcSourceId: 'npc-other' },
                ],
              }),
              sha256: 'x',
              byteCount: 1,
              capturedAt: '2026-10-15T00:00:00.000Z',
            },
          ],
          scenes: [
            scene('scene-1', [
              { actorId, tokenIds: [], sceneMemberId: 'member-adopted' },
              {
                actorId: `${encounterId}:entity-guard`,
                tokenIds: [],
                sceneMemberId: 'member-guard',
              },
            ]),
          ],
        }),
        NPC
      )
    ).toEqual(['member-adopted', entityId]);
  });

  it('caps the list at 50 like the shop route', () => {
    const members = Array.from({ length: 60 }, (_, index) => ({
      actorId: 'actor-1',
      tokenIds: [],
      sceneMemberId: `member-${index}`,
    }));
    const ids = tableShopEntityIds(
      snapshot({
        actors: [actor('actor-1', npcProfile)],
        scenes: [scene('scene-1', members)],
      }),
      NPC
    );
    expect(ids).toHaveLength(50);
    expect(ids[0]).toBe('member-0');
  });
});

describe('readTableShopEntityIds (repair 09 D2)', () => {
  async function seeded(factory: IDBFactory) {
    const { repository } = await openTableWorkspace({
      factory,
      account: { kind: 'guest' },
      sourceCampaignCode: 'CAMP',
    });
    const key = repository.workspaceIdentity;
    const npcActor = { ...actor('actor-1', npcProfile), workspaceKey: key };
    const result = await repository.mutateWorkspace(0, 'seed', {
      actors: { put: [npcActor] },
      scenes: {
        put: [
          {
            ...scene('scene-1', [
              { actorId: 'actor-1', tokenIds: [], sceneMemberId: 'member-1' },
            ]),
            workspaceKey: key,
          },
        ],
      },
    });
    expect(result.status).toBe('committed');
    repository.dispose();
  }

  it("reads the campaign's Table for the same account", async () => {
    const factory = new IDBFactory();
    await seeded(factory);
    await expect(
      readTableShopEntityIds({
        factory,
        account: { kind: 'guest' },
        sourceCampaignCode: 'CAMP',
        npcId: NPC,
      })
    ).resolves.toEqual(['member-1']);
    await expect(
      readTableShopEntityIds({
        factory,
        account: { kind: 'authenticated', accountId: 'someone-else' },
        sourceCampaignCode: 'CAMP',
        npcId: NPC,
      })
    ).resolves.toEqual([]);
  });

  it('never creates a Table for a campaign that has none', async () => {
    const factory = new IDBFactory();
    await expect(
      readTableShopEntityIds({
        factory,
        account: { kind: 'guest' },
        sourceCampaignCode: 'NONE',
        npcId: NPC,
      })
    ).resolves.toEqual([]);
    const database = await openTableDatabase({ factory });
    const campaigns = await requestResult(
      database.transaction('campaigns').objectStore('campaigns').getAll()
    );
    database.close();
    expect(campaigns).toEqual([]);
  });
});
