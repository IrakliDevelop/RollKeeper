import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import { PLAYER_TOKEN_KIND } from '@/components/ui/campaign/location-map/PlayerTokenTool';
import { ANNOTATIONS_LAYER_ID } from '@/components/ui/campaign/location-map/layerContract';
import { COMBATANT_TOKEN_KIND } from '@/components/ui/campaign/location-map/tokenIdentity';

import { TableRepository, type TableWorkspaceSelection } from './repository';
import {
  deriveSceneRoster,
  dmTokenFields,
  partyTokenFields,
  runRosterCommand,
  tokenControlPatch,
  tokenMatchesControl,
  verifyPlayerIdentity,
  type TableCampaignPlayer,
  type TableRosterCommandV1,
} from './roster';
import type {
  JsonObject,
  TableActorLiveStatsV1,
  TableActorRecordV1,
  TableSceneRecordV1,
} from './schema';

const AT = '2026-10-06T00:00:00.000Z';
const selection: TableWorkspaceSelection = {
  account: { kind: 'authenticated', accountId: 'account-a' },
  workspace: { localWorkspaceId: 'workspace-roster' },
};
const players: TableCampaignPlayer[] = [
  { playerId: 'legacy-a', characterId: 'legacy-a', name: 'Aria' },
  { playerId: 'legacy-b', characterId: 'character-b', name: 'Bran' },
];
const repositories: TableRepository[] = [];
afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

const stats = (name = 'Goblin', currentHp = 7): TableActorLiveStatsV1 => ({
  name,
  currentHp,
  maxHp: 7,
  tempHp: 0,
  armorClass: 15,
  conditions: [],
});

function scene(
  workspaceKey: string,
  sceneId = 'tavern',
  members: TableSceneRecordV1['members'] = [],
  elements: JsonObject[] = []
): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    sceneId,
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
    canvasCheckpoint:
      elements.length === 0
        ? null
        : {
            protocolVersion: 1,
            generation: 'generation-1',
            revision: 3,
            capturedAt: AT,
            state: {
              elements,
              layers: [],
              extensions: {
                fog: { pluginName: 'fog', version: 1, data: null },
              },
            },
          },
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
    liveStats: stats(actorId),
    playerReference: null,
    cachedPlayerData: null,
    playerConditionOverlay: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

async function open(factory = new IDBFactory(), options = {}) {
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

function revision(repository: TableRepository): number {
  const current = repository.getCurrent();
  if (current?.status !== 'ready') throw new Error('repository not ready');
  return current.snapshot.campaign?.revision ?? 0;
}

function snapshot(repository: TableRepository) {
  const current = repository.getCurrent();
  if (current?.status !== 'ready') throw new Error('repository not ready');
  return current.snapshot;
}

function sceneOf(repository: TableRepository, sceneId = 'tavern') {
  const found = snapshot(repository).scenes.find(
    value => value.sceneId === sceneId
  );
  if (!found) throw new Error(`missing scene ${sceneId}`);
  return found;
}

let operation = 0;
async function run(
  repository: TableRepository,
  command: TableRosterCommandV1,
  overrides: { operationId?: string; expectedRevision?: number } = {}
) {
  return runRosterCommand(repository, {
    expectedRevision: overrides.expectedRevision ?? revision(repository),
    operationId: overrides.operationId ?? `roster-op-${(operation += 1)}`,
    command,
    players,
  });
}

const party = (
  sceneId: string,
  legacyPlayerId: string,
  suffix: string
): TableRosterCommandV1 => {
  const player = players.find(entry => entry.playerId === legacyPlayerId);
  return {
    type: 'roster.addPartyMember',
    sceneId,
    campaignId: 'CAMP',
    legacyPlayerId,
    characterId: player?.characterId ?? legacyPlayerId,
    name: player?.name ?? 'Unknown',
    actorId: `party-actor-${suffix}`,
    sceneMemberId: `party-member-${suffix}`,
    at: AT,
  };
};

const creature = (
  sceneId: string,
  suffix: string,
  type:
    | 'roster.addCreatureInstance'
    | 'roster.addManualParticipant' = 'roster.addCreatureInstance'
): TableRosterCommandV1 => ({
  type,
  sceneId,
  actorId: `creature-actor-${suffix}`,
  sceneMemberId: `creature-member-${suffix}`,
  liveStats: stats(`Goblin ${suffix}`),
  profile:
    type === 'roster.addManualParticipant'
      ? { category: 'pc', sourceKind: 'manual' }
      : { category: 'monster', sourceKind: 'bestiary', sourceId: 'goblin' },
  at: AT,
});

describe('roster identity', () => {
  it('verifies a player only by exact playerId or a unique characterId mapping', () => {
    expect(verifyPlayerIdentity(players, 'legacy-a')).toEqual({
      status: 'verified',
      legacyPlayerId: 'legacy-a',
      characterId: 'legacy-a',
    });
    expect(verifyPlayerIdentity(players, 'character-b')).toEqual({
      status: 'verified',
      legacyPlayerId: 'legacy-b',
      characterId: 'character-b',
    });
    expect(verifyPlayerIdentity(players, 'Aria')).toEqual({
      status: 'missing',
    });
    expect(
      verifyPlayerIdentity(
        [
          ...players,
          { playerId: 'legacy-c', characterId: 'character-b', name: 'C' },
        ],
        'character-b'
      )
    ).toEqual({ status: 'ambiguous' });
    expect(
      verifyPlayerIdentity(
        [players[0]!, { ...players[0]!, name: 'Duplicate' }],
        'legacy-a'
      )
    ).toEqual({ status: 'ambiguous' });
  });

  it('builds DM-created party and DM-managed token fields (R1, R9, C6)', () => {
    expect(PLAYER_TOKEN_KIND).toBe('player');
    expect(partyTokenFields('member-a', 'legacy-a')).toEqual({
      tokenKind: PLAYER_TOKEN_KIND,
      characterId: 'legacy-a',
      layerId: 'player-legacy-a',
      sceneMemberId: 'member-a',
    });
    expect(dmTokenFields('member-n')).toEqual({
      tokenKind: COMBATANT_TOKEN_KIND,
      entityId: 'member-n',
      sceneMemberId: 'member-n',
      layerId: ANNOTATIONS_LAYER_ID,
    });
    const playerToken = {
      id: 'token-a',
      tokenKind: 'player',
      characterId: 'legacy-a',
      layerId: 'player-legacy-a',
      sceneMemberId: 'member-a',
    };
    expect(tokenControlPatch(playerToken, 'member-a', { kind: 'dm' })).toEqual({
      set: {
        tokenKind: COMBATANT_TOKEN_KIND,
        entityId: 'member-a',
        sceneMemberId: 'member-a',
        layerId: ANNOTATIONS_LAYER_ID,
      },
      unset: ['characterId'],
    });
    const adopted = {
      id: 'token-legacy',
      tokenKind: 'combatant',
      entityId: 'entity-1',
      layerId: ANNOTATIONS_LAYER_ID,
    };
    expect(
      tokenControlPatch(adopted, 'member-x', {
        kind: 'player',
        legacyPlayerId: 'legacy-b',
      })
    ).toEqual({
      set: {
        tokenKind: PLAYER_TOKEN_KIND,
        characterId: 'legacy-b',
        layerId: 'player-legacy-b',
        sceneMemberId: 'member-x',
      },
      unset: ['entityId'],
    });
    expect(
      tokenMatchesControl(playerToken, {
        kind: 'player',
        legacyPlayerId: 'legacy-a',
      })
    ).toBe(true);
    expect(tokenMatchesControl(playerToken, { kind: 'dm' })).toBe(false);
    expect(tokenMatchesControl(adopted, { kind: 'dm' })).toBe(true);
  });
});

describe('roster commands', () => {
  it('assigns sceneMemberIds once through one persisted idempotent command', async () => {
    const factory = new IDBFactory();
    const repository = await open(factory);
    const key = repository.workspaceIdentity;
    await repository.mutateWorkspace(0, 'seed', {
      actors: { put: [managed(key, 'pr01-a'), managed(key, 'pr01-b')] },
      scenes: {
        put: [
          scene(key, 'tavern', [
            { actorId: 'pr01-a', tokenIds: [] },
            { actorId: 'pr01-b', tokenIds: [] },
          ]),
        ],
      },
    });
    const before = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
      players,
    });
    expect(before.entries.map(entry => entry.sceneMemberId)).toEqual([
      null,
      null,
    ]);
    expect(before.needsSceneMemberIds).toBe(true);
    expect(revision(repository)).toBe(1);

    const ensure: TableRosterCommandV1 = {
      type: 'roster.ensureSceneMemberIds',
      sceneId: 'tavern',
      assignments: [
        { actorId: 'pr01-a', sceneMemberId: 'member-1' },
        { actorId: 'pr01-b', sceneMemberId: 'member-2' },
      ],
    };
    await expect(run(repository, ensure)).resolves.toMatchObject({
      status: 'committed',
      revision: 2,
    });
    await expect(
      run(repository, {
        ...ensure,
        assignments: [
          { actorId: 'pr01-a', sceneMemberId: 'other-1' },
          { actorId: 'pr01-b', sceneMemberId: 'other-2' },
        ],
      })
    ).resolves.toEqual({ status: 'unchanged', revision: 2 });

    const reloaded = await open(factory);
    expect(
      sceneOf(reloaded).members.map(member => member.sceneMemberId)
    ).toEqual(['member-1', 'member-2']);
    expect(
      deriveSceneRoster({
        snapshot: snapshot(reloaded),
        sceneId: 'tavern',
        players,
      }).needsSceneMemberIds
    ).toBe(false);
  });

  it('adds a party member idempotently per workspace player and reuses the actor across scenes', async () => {
    const repository = await open();
    const key = repository.workspaceIdentity;
    await repository.mutateWorkspace(0, 'seed', {
      scenes: { put: [scene(key, 'tavern'), scene(key, 'road')] },
    });
    await expect(
      run(repository, party('tavern', 'legacy-b', '1'))
    ).resolves.toMatchObject({ status: 'committed' });
    await expect(
      run(repository, party('tavern', 'legacy-b', '2'))
    ).resolves.toMatchObject({ status: 'unchanged' });
    await expect(
      run(repository, party('road', 'legacy-b', '3'))
    ).resolves.toMatchObject({ status: 'committed' });
    const state = snapshot(repository);
    const references = state.actors.filter(
      value => value.actorKind === 'player-reference'
    );
    expect(references).toHaveLength(1);
    expect(references[0]!.playerReference).toEqual({
      campaignId: 'CAMP',
      playerId: 'legacy-b',
      legacyPlayerId: 'legacy-b',
      characterId: 'character-b',
    });
    expect(sceneOf(repository, 'tavern').members).toEqual([
      {
        actorId: 'party-actor-1',
        tokenIds: [],
        sceneMemberId: 'party-member-1',
        control: {
          kind: 'player',
          legacyPlayerId: 'legacy-b',
          characterId: 'character-b',
        },
      },
    ]);
    expect(sceneOf(repository, 'road').members).toEqual([
      expect.objectContaining({
        actorId: 'party-actor-1',
        sceneMemberId: 'party-member-3',
      }),
    ]);
  });

  it('refuses an unverified party identity and never infers by name', async () => {
    const repository = await open();
    await repository.mutateWorkspace(0, 'seed', {
      scenes: { put: [scene(repository.workspaceIdentity)] },
    });
    for (const forged of [
      { ...party('tavern', 'legacy-x', 'x'), name: 'Aria' },
      { ...party('tavern', 'legacy-b', 'y'), characterId: 'legacy-a' },
    ]) {
      await expect(run(repository, forged)).resolves.toMatchObject({
        status: 'rejected',
        detail: 'control-unavailable',
      });
    }
    expect(revision(repository)).toBe(1);
  });

  it('links a verified adopted PC instead of duplicating it and keeps its stats read-only (R8)', async () => {
    const repository = await open();
    const key = repository.workspaceIdentity;
    const encounterRaw = JSON.stringify({
      id: 'enc-1',
      entities: [
        {
          id: 'pc-entity',
          type: 'player',
          name: 'Aria',
          playerCharacterId: 'legacy-a',
        },
        {
          id: 'ghost-entity',
          type: 'player',
          name: 'Ghost',
          playerCharacterId: 'nobody',
        },
        { id: 'orc-entity', type: 'monster', name: 'Orc' },
      ],
    });
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(encounterRaw)
    );
    await repository.mutateWorkspace(0, 'seed', {
      actors: {
        put: [
          managed(key, 'enc-1:pc-entity'),
          managed(key, 'enc-1:ghost-entity'),
          managed(key, 'enc-1:orc-entity'),
        ],
      },
      scenes: {
        put: [
          scene(key, 'tavern', [
            { actorId: 'enc-1:pc-entity', tokenIds: [] },
            { actorId: 'enc-1:ghost-entity', tokenIds: [] },
            { actorId: 'enc-1:orc-entity', tokenIds: [] },
          ]),
        ],
      },
      encounters: {
        put: [
          {
            schemaVersion: 1,
            workspaceKey: key,
            runId: 'run-1',
            sceneId: 'tavern',
            sourceEncounterId: 'enc-1',
            runGeneration: 'generation-1',
            participants: [],
            round: 0,
            currentActorId: null,
            isActive: false,
            createdAt: AT,
            updatedAt: AT,
          },
        ],
      },
      sources: {
        put: [
          {
            schemaVersion: 1,
            workspaceKey: key,
            sourceKey: 'encounter:enc-1',
            sourceKind: 'encounter',
            sourceId: 'enc-1',
            rawJson: encounterRaw,
            sha256: [...new Uint8Array(digest)]
              .map(byte => byte.toString(16).padStart(2, '0'))
              .join(''),
            byteCount: new TextEncoder().encode(encounterRaw).byteLength,
            capturedAt: AT,
          },
        ],
      },
    });
    await run(repository, {
      type: 'roster.ensureSceneMemberIds',
      sceneId: 'tavern',
      assignments: [
        { actorId: 'enc-1:pc-entity', sceneMemberId: 'adopted-pc' },
        { actorId: 'enc-1:ghost-entity', sceneMemberId: 'adopted-ghost' },
        { actorId: 'enc-1:orc-entity', sceneMemberId: 'adopted-orc' },
      ],
    });
    const roster = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
      players,
    });
    const byMember = new Map(
      roster.entries.map(entry => [entry.sceneMemberId, entry])
    );
    expect(byMember.get('adopted-pc')).toMatchObject({
      adoptedPc: true,
      category: 'pc',
      statsEditable: false,
      verifiedLegacyPlayerId: 'legacy-a',
      control: { kind: 'dm' },
    });
    expect(byMember.get('adopted-ghost')).toMatchObject({
      adoptedPc: true,
      statsEditable: false,
      control: { kind: 'unavailable', reason: 'identity-unresolved' },
    });
    expect(byMember.get('adopted-orc')).toMatchObject({
      adoptedPc: false,
      category: 'monster',
      statsEditable: true,
    });

    await expect(
      run(repository, party('tavern', 'legacy-a', 'dup'))
    ).resolves.toMatchObject({ status: 'committed' });
    const linked = snapshot(repository);
    expect(linked.actors).toHaveLength(3);
    expect(sceneOf(repository).members).toHaveLength(3);
    expect(
      sceneOf(repository).members.find(
        member => member.sceneMemberId === 'adopted-pc'
      )?.control
    ).toEqual({
      kind: 'player',
      legacyPlayerId: 'legacy-a',
      characterId: 'legacy-a',
    });
    await expect(
      run(repository, party('tavern', 'legacy-a', 'again'))
    ).resolves.toMatchObject({ status: 'unchanged' });
    await expect(
      run(repository, {
        type: 'roster.updateActorStats',
        actorId: 'enc-1:pc-entity',
        liveStats: stats('Aria', 1),
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'rejected', detail: 'read-only' });
  });

  it('creates a new actor and member for every creature or manual participant', async () => {
    const repository = await open();
    await repository.mutateWorkspace(0, 'seed', {
      scenes: { put: [scene(repository.workspaceIdentity)] },
    });
    await run(repository, creature('tavern', '1'));
    await run(repository, creature('tavern', '2'));
    await run(
      repository,
      creature('tavern', 'pc', 'roster.addManualParticipant')
    );
    const roster = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
      players,
    });
    expect(
      roster.entries.map(entry => [entry.category, entry.control])
    ).toEqual([
      ['monster', { kind: 'dm' }],
      ['monster', { kind: 'dm' }],
      ['pc', { kind: 'dm' }],
    ]);
    expect(snapshot(repository).actors).toHaveLength(3);
  });

  it('binds tokens uniquely, unbinds them and keeps stat edits immutable and atomic', async () => {
    const repository = await open();
    await repository.mutateWorkspace(0, 'seed', {
      scenes: { put: [scene(repository.workspaceIdentity)] },
    });
    await run(repository, creature('tavern', '1'));
    await run(repository, creature('tavern', '2'));
    await run(repository, {
      type: 'roster.bindToken',
      sceneId: 'tavern',
      sceneMemberId: 'creature-member-1',
      tokenId: 'token-x',
      at: AT,
    });
    await run(repository, {
      type: 'roster.bindToken',
      sceneId: 'tavern',
      sceneMemberId: 'creature-member-2',
      tokenId: 'token-x',
      at: AT,
    });
    expect(sceneOf(repository).members.map(member => member.tokenIds)).toEqual([
      [],
      ['token-x'],
    ]);
    await expect(
      run(repository, {
        type: 'roster.bindToken',
        sceneId: 'tavern',
        sceneMemberId: 'creature-member-2',
        tokenId: 'token-x',
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'unchanged' });
    await run(repository, {
      type: 'roster.unbindToken',
      sceneId: 'tavern',
      sceneMemberId: 'creature-member-2',
      tokenId: 'token-x',
      at: AT,
    });
    expect(sceneOf(repository).members[1]!.tokenIds).toEqual([]);

    const previous = snapshot(repository);
    const previousStats = previous.actors.find(
      value => value.actorId === 'creature-actor-1'
    )!.liveStats;
    await expect(
      run(repository, {
        type: 'roster.updateActorStats',
        actorId: 'creature-actor-1',
        liveStats: stats('Goblin boss', 3),
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'committed' });
    expect(previousStats).toEqual(stats('Goblin 1'));
    expect(Object.isFrozen(previousStats)).toBe(true);
    expect(
      snapshot(repository).actors.find(
        value => value.actorId === 'creature-actor-1'
      )!.liveStats
    ).toEqual(stats('Goblin boss', 3));
  });

  it('keeps party actors read-only and reassigns control explicitly', async () => {
    const repository = await open();
    await repository.mutateWorkspace(0, 'seed', {
      scenes: { put: [scene(repository.workspaceIdentity)] },
    });
    await run(repository, party('tavern', 'legacy-a', 'a'));
    await expect(
      run(repository, {
        type: 'roster.updateActorStats',
        actorId: 'party-actor-a',
        liveStats: stats('Aria'),
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'rejected', detail: 'read-only' });
    await run(repository, {
      type: 'roster.reassignControl',
      sceneId: 'tavern',
      sceneMemberId: 'party-member-a',
      control: { kind: 'player', legacyPlayerId: 'legacy-b' },
      at: AT,
    });
    expect(sceneOf(repository).members[0]!.control).toEqual({
      kind: 'player',
      legacyPlayerId: 'legacy-b',
      characterId: 'character-b',
    });
    await expect(
      run(repository, {
        type: 'roster.reassignControl',
        sceneId: 'tavern',
        sceneMemberId: 'party-member-a',
        control: { kind: 'player', legacyPlayerId: 'legacy-z' },
        at: AT,
      })
    ).resolves.toMatchObject({
      status: 'rejected',
      detail: 'control-unavailable',
    });
    await run(repository, {
      type: 'roster.reassignControl',
      sceneId: 'tavern',
      sceneMemberId: 'party-member-a',
      control: { kind: 'dm' },
      at: AT,
    });
    expect(
      deriveSceneRoster({
        snapshot: snapshot(repository),
        sceneId: 'tavern',
        players,
      }).entries[0]!.control
    ).toEqual({ kind: 'dm' });
  });

  it('refuses player control for DM-managed creatures and manual PCs', async () => {
    const repository = await open();
    await repository.mutateWorkspace(0, 'seed', {
      scenes: { put: [scene(repository.workspaceIdentity)] },
    });
    await run(repository, creature('tavern', 'npc'));
    await run(
      repository,
      creature('tavern', 'manual', 'roster.addManualParticipant')
    );
    for (const sceneMemberId of [
      'creature-member-npc',
      'creature-member-manual',
    ]) {
      await expect(
        run(repository, {
          type: 'roster.reassignControl',
          sceneId: 'tavern',
          sceneMemberId,
          control: { kind: 'player', legacyPlayerId: 'legacy-a' },
          at: AT,
        })
      ).resolves.toMatchObject({ status: 'rejected', detail: 'dm-only' });
    }
  });

  it('tombstones membership only and restores the same member on re-add', async () => {
    const repository = await open();
    await repository.mutateWorkspace(0, 'seed', {
      scenes: { put: [scene(repository.workspaceIdentity)] },
    });
    await run(repository, party('tavern', 'legacy-a', 'a'));
    await run(repository, {
      type: 'roster.bindToken',
      sceneId: 'tavern',
      sceneMemberId: 'party-member-a',
      tokenId: 'token-a',
      at: AT,
    });
    await run(repository, {
      type: 'roster.removeMember',
      sceneId: 'tavern',
      sceneMemberId: 'party-member-a',
      at: AT,
    });
    expect(sceneOf(repository).members[0]).toMatchObject({
      sceneMemberId: 'party-member-a',
      tokenIds: [],
      removedAt: AT,
    });
    expect(snapshot(repository).actors).toHaveLength(1);
    expect(
      deriveSceneRoster({
        snapshot: snapshot(repository),
        sceneId: 'tavern',
        players,
      }).entries[0]!.removed
    ).toBe(true);
    await run(repository, party('tavern', 'legacy-a', 'again'));
    expect(sceneOf(repository).members).toHaveLength(1);
    expect(sceneOf(repository).members[0]).not.toHaveProperty('removedAt');
    expect(sceneOf(repository).members[0]!.sceneMemberId).toBe(
      'party-member-a'
    );
  });

  it('enforces caps, CAS, replay and digest checks before any write', async () => {
    const repository = await open();
    const key = repository.workspaceIdentity;
    const actors = Array.from({ length: 500 }, (_, index) =>
      managed(key, `bulk-${index}`)
    );
    await repository.mutateWorkspace(0, 'seed', {
      actors: { put: actors },
      scenes: {
        put: [
          scene(
            key,
            'tavern',
            actors.map(value => ({ actorId: value.actorId, tokenIds: [] }))
          ),
          scene(key, 'road'),
        ],
      },
    });
    await expect(run(repository, creature('tavern', 'cap'))).resolves.toEqual(
      expect.objectContaining({ status: 'rejected', reason: 'limit-exceeded' })
    );
    expect(revision(repository)).toBe(1);

    const first = creature('road', 'r1');
    await expect(
      run(repository, first, { operationId: 'op-replay' })
    ).resolves.toMatchObject({ status: 'committed', revision: 2 });
    await expect(
      run(repository, first, { operationId: 'op-replay', expectedRevision: 1 })
    ).resolves.toMatchObject({ status: 'committed', revision: 2 });
    await expect(
      run(repository, creature('road', 'r2'), {
        operationId: 'op-replay',
        expectedRevision: 1,
      })
    ).resolves.toMatchObject({
      status: 'rejected',
      reason: 'operation-digest-mismatch',
    });
    await expect(
      run(repository, creature('road', 'r3'), { expectedRevision: 1 })
    ).resolves.toEqual({ status: 'conflict', actualRevision: 2 });
    expect(snapshot(repository).actors).toHaveLength(501);
  });

  it('leaves state untouched on quota or abort and reports unavailable storage', async () => {
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
        if (operationId === 'abort') transaction.abort();
      },
    });
    await repository.mutateWorkspace(0, 'seed', {
      scenes: { put: [scene(repository.workspaceIdentity)] },
    });
    await expect(
      run(repository, creature('tavern', 'q'), { operationId: 'quota' })
    ).resolves.toMatchObject({ status: 'failed', reason: 'quota-exceeded' });
    await expect(
      run(repository, creature('tavern', 'a'), { operationId: 'abort' })
    ).resolves.toMatchObject({
      status: 'failed',
      reason: 'transaction-failed',
    });
    const reloaded = await repository.reload();
    if (reloaded.status !== 'ready') throw new Error('not ready');
    expect(reloaded.snapshot.actors).toEqual([]);
    expect(reloaded.snapshot.campaign?.revision).toBe(1);

    const unavailable = new TableRepository({
      factory: null,
      selection,
      broadcastChannel: null,
      events: null,
    });
    repositories.push(unavailable);
    await unavailable.start();
    await expect(
      runRosterCommand(unavailable, {
        expectedRevision: 0,
        operationId: 'offline',
        command: creature('tavern', 'o'),
        players,
      })
    ).resolves.toMatchObject({ status: 'failed' });
  });
});

describe('unavailable player verification (review F4)', () => {
  it('never reports player control without a current players snapshot but keeps identity for aliases', async () => {
    const repository = await open();
    await repository.mutateWorkspace(0, 'seed', {
      scenes: {
        put: [
          scene(
            repository.workspaceIdentity,
            'tavern',
            [],
            [{ id: 'self-token', tokenKind: 'player', characterId: 'legacy-a' }]
          ),
        ],
      },
    });
    await run(repository, party('tavern', 'legacy-a', 'a'));
    const roster = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
    });
    expect(roster.entries[0]).toMatchObject({
      control: { kind: 'unavailable', reason: 'verification-unavailable' },
      identityLegacyPlayerId: 'legacy-a',
      aliasTokenIds: ['self-token'],
    });
  });
});

describe('legacy token aliases', () => {
  async function aliasFixture(elements: JsonObject[]) {
    const repository = await open();
    const key = repository.workspaceIdentity;
    await repository.mutateWorkspace(0, 'seed', {
      actors: {
        put: [
          managed(key, 'enc-1:entity-1'),
          managed(key, 'enc-2:entity-1'),
          managed(key, 'enc-1:entity-2'),
        ],
      },
      scenes: {
        put: [
          scene(
            key,
            'tavern',
            [
              { actorId: 'enc-1:entity-1', tokenIds: [], sceneMemberId: 'm1' },
              { actorId: 'enc-2:entity-1', tokenIds: [], sceneMemberId: 'm2' },
              { actorId: 'enc-1:entity-2', tokenIds: [], sceneMemberId: 'm3' },
            ],
            elements
          ),
        ],
      },
      encounters: {
        put: ['enc-1', 'enc-2'].map(id => ({
          schemaVersion: 1 as const,
          workspaceKey: key,
          runId: `run-${id}`,
          sceneId: 'tavern',
          sourceEncounterId: id,
          runGeneration: `generation-${id}`,
          participants: [],
          round: 0,
          currentActorId: null,
          isActive: false,
          createdAt: AT,
          updatedAt: AT,
        })),
      },
    });
    await run(repository, party('tavern', 'legacy-a', 'a'));
    return repository;
  }

  it('matches player tokens by exact characterId and keeps every duplicate visible', async () => {
    const repository = await aliasFixture([
      {
        id: 'player-token-1',
        tokenKind: 'player',
        characterId: 'legacy-a',
        ownerId: 'legacy-a',
      },
      {
        id: 'player-token-2',
        tokenKind: 'player',
        characterId: 'legacy-a',
        ownerId: 'legacy-a',
      },
      { id: 'named-token', tokenKind: 'player', name: 'Aria' },
    ]);
    const roster = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
      players,
      dmPrincipals: ['dm-a'],
    });
    const aria = roster.entries.find(
      entry => entry.sceneMemberId === 'party-member-a'
    )!;
    expect(aria.aliasTokenIds).toEqual(['player-token-1', 'player-token-2']);
    expect(aria.boundTokenIds).toEqual([]);
    expect(roster.unmatchedTokenIds).toContain('named-token');
  });

  it('matches adopted combatants only with DM provenance and leaves ambiguity unbound', async () => {
    const repository = await aliasFixture([
      {
        id: 'dm-orc',
        tokenKind: 'combatant',
        entityId: 'entity-2',
        ownerId: 'dm-a',
      },
      {
        id: 'player-forged',
        tokenKind: 'combatant',
        entityId: 'entity-2',
        ownerId: 'legacy-a',
      },
      { id: 'legacy-no-owner', tokenKind: 'combatant', entityId: 'entity-2' },
      {
        id: 'two-encounters',
        tokenKind: 'combatant',
        entityId: 'entity-1',
        ownerId: 'dm-a',
      },
    ]);
    const roster = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
      players,
      dmPrincipals: ['dm-a'],
    });
    const byMember = new Map(
      roster.entries.map(entry => [entry.sceneMemberId, entry])
    );
    expect(byMember.get('m3')!.aliasTokenIds).toEqual(['dm-orc']);
    expect(roster.unmatchedTokenIds).toEqual(
      expect.arrayContaining(['player-forged', 'legacy-no-owner'])
    );
    expect(roster.ambiguousTokenIds).toEqual(['two-encounters']);
    expect(byMember.get('m1')!.aliasTokenIds).toEqual([]);
    expect(byMember.get('m2')!.aliasTokenIds).toEqual([]);

    await run(repository, {
      type: 'roster.bindToken',
      sceneId: 'tavern',
      sceneMemberId: 'm2',
      tokenId: 'two-encounters',
      at: AT,
    });
    const bound = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
      players,
      dmPrincipals: ['dm-a'],
    });
    expect(
      bound.entries.find(entry => entry.sceneMemberId === 'm2')!.boundTokenIds
    ).toEqual(['two-encounters']);
    expect(bound.ambiguousTokenIds).toEqual([]);
  });

  it('surfaces a control/token mismatch for explicit repair instead of fixing it', async () => {
    const repository = await aliasFixture([
      {
        id: 'bound-token',
        tokenKind: 'combatant',
        entityId: 'party-member-a',
        sceneMemberId: 'party-member-a',
        ownerId: 'dm-a',
      },
    ]);
    await run(repository, {
      type: 'roster.bindToken',
      sceneId: 'tavern',
      sceneMemberId: 'party-member-a',
      tokenId: 'bound-token',
      at: AT,
    });
    const roster = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
      players,
      dmPrincipals: ['dm-a'],
    });
    expect(
      roster.entries.find(entry => entry.sceneMemberId === 'party-member-a')
    ).toMatchObject({
      boundTokenIds: ['bound-token'],
      mismatchedTokenIds: ['bound-token'],
    });
  });

  it('prefers live canvas fields while keeping checkpoint provenance', async () => {
    const repository = await aliasFixture([
      {
        id: 'dm-orc',
        tokenKind: 'combatant',
        entityId: 'entity-2',
        ownerId: 'dm-a',
      },
    ]);
    const roster = deriveSceneRoster({
      snapshot: snapshot(repository),
      sceneId: 'tavern',
      players,
      dmPrincipals: ['dm-a'],
      canvasElements: [
        { id: 'dm-orc', tokenKind: 'combatant', entityId: 'entity-2' },
        {
          id: 'live-player',
          tokenKind: 'player',
          characterId: 'legacy-a',
        },
      ],
    });
    expect(
      roster.entries.find(entry => entry.sceneMemberId === 'm3')!.aliasTokenIds
    ).toEqual(['dm-orc']);
    expect(
      roster.entries.find(entry => entry.sceneMemberId === 'party-member-a')!
        .aliasTokenIds
    ).toEqual(['live-player']);
  });
});
