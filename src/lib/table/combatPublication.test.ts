import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseTableCommand } from '@/lib/tableServer/validation';
import { createMockCharacterState, createMockPlayerData } from '@/test/helpers';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';

import { runCombatCommand, type TableCombatCommandV1 } from './combat';
import {
  ADOPTED_PC,
  AT,
  SCENE_ID,
  openFixture,
  readySnapshot,
  repositories,
  revisionOf,
} from './combat.fixture';
import {
  buildScenePublication,
  publicationRunState,
} from './combatPublication';
import { buildCombatReadModel } from './combatReadModel';
import type { TableRepository } from './repository';

afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

let counter = 0;
async function commit(repository: TableRepository, command: unknown) {
  counter += 1;
  const result = await runCombatCommand(repository, {
    expectedRevision: revisionOf(repository),
    operationId: `publication-${counter}`,
    command: command as TableCombatCommandV1,
  });
  if (result.status !== 'committed') throw new Error(JSON.stringify(result));
}

async function fight(repository: TableRepository, actorIds: string[]) {
  await commit(repository, {
    type: 'combat.createRun',
    sceneId: SCENE_ID,
    runId: 'run-a',
    label: 'Secret ambush',
    at: AT,
  });
  await commit(repository, {
    type: 'combat.setParticipants',
    runId: 'run-a',
    actorIds,
    hiddenActorIds: ['orc'],
    at: AT,
  });
  for (const [index, actorId] of actorIds.entries())
    await commit(repository, {
      type: 'combat.setInitiative',
      runId: 'run-a',
      actorId,
      value: 30 - index * 5,
      at: AT,
    });
  await commit(repository, { type: 'combat.start', runId: 'run-a', at: AT });
}

const bran = () =>
  createMockPlayerData({
    playerId: 'legacy-bran',
    characterId: 'char-bran',
    characterName: 'Bran',
    characterData: createMockCharacterState({
      hitPoints: { current: 9, max: 30, temporary: 0, calculationMode: 'auto' },
    } as never),
  });

describe('scene initiative publication payload (D8, R2-1)', () => {
  it('masks hidden participants, carries no scene/actor identity, and passes the real validator', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', 'orc', 'knight', ADOPTED_PC]);
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [bran()],
    })!;
    const built = buildScenePublication(model, DEFAULT_COMBAT_CONFIG);
    if (built.status !== 'ok') throw new Error(built.status);
    const initiative = built.initiative;
    expect(initiative.encounterId).toBe('run-a');
    expect(initiative.currentEntityId).toBe('m-goblin');
    expect(initiative.turnOrder.map(entry => entry.entityId)).toEqual([
      'm-goblin',
      'm-orc',
      'm-knight',
      'm-pc1',
    ]);
    expect(initiative.turnOrder[1]).toMatchObject({
      displayName: 'Enemy',
      type: 'npc',
    });
    // Verified adopted PC publishes its live player HP.
    expect(initiative.turnOrder[3]).toMatchObject({
      type: 'player',
      playerCharacterId: 'char-bran',
      currentHp: 9,
      maxHp: 30,
    });
    const raw = JSON.stringify(initiative);
    for (const forbidden of [
      'Orc',
      'Secret ambush',
      'Secret Lair Of The Lich',
      SCENE_ID,
      ADOPTED_PC,
      'enc-1',
    ])
      expect(raw).not.toContain(forbidden);
    const command = parseTableCommand({
      type: 'publishInitiative',
      operationId: 'op-1',
      expectedEpoch: '10000000-0000-4000-8000-000000000001',
      expectedRevision: 1,
      expectedFence: 1,
      holderSessionId: 'table-session',
      runId: 'run-a',
      initiative: JSON.parse(raw),
    });
    expect(command).not.toBeNull();
  });

  it('matches the committed adopted-actor fixture used by the real-Redis scenario', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', ADOPTED_PC]);
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [bran()],
    })!;
    const built = buildScenePublication(model, DEFAULT_COMBAT_CONFIG);
    if (built.status !== 'ok') throw new Error(built.status);
    const fixture = JSON.parse(
      readFileSync(
        path.join(__dirname, 'combatPublication.fixture.json'),
        'utf8'
      )
    ) as { runId: string; initiative: Record<string, unknown> };
    expect(fixture.runId).toBe('run-a');
    expect({ ...built.initiative, updatedAt: 'fixture' }).toEqual(
      fixture.initiative
    );
    expect(
      parseTableCommand({
        type: 'publishInitiative',
        operationId: 'op-2',
        expectedEpoch: '10000000-0000-4000-8000-000000000001',
        expectedRevision: 1,
        expectedFence: 1,
        holderSessionId: 'table-session',
        runId: fixture.runId,
        initiative: fixture.initiative,
      })
    ).not.toBeNull();
  });

  it('blocks publication visibly when an identity fails the server grammar', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin']);
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
    })!;
    const broken = {
      ...model,
      participants: model.participants.map(view => ({
        ...view,
        validIdentity: false,
      })),
    };
    expect(buildScenePublication(broken, DEFAULT_COMBAT_CONFIG)).toEqual({
      status: 'invalid-identity',
    });
  });

  it('refuses to build for a run that is not running here', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin']);
    await commit(repository, { type: 'combat.end', runId: 'run-a', at: AT });
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
    })!;
    expect(buildScenePublication(model, DEFAULT_COMBAT_CONFIG)).toEqual({
      status: 'not-running',
    });
  });

  it('derives publication inputs from campaign.activeRunId and unacknowledged ends', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin']);
    expect(publicationRunState(readySnapshot(repository))).toEqual({
      active: {
        runId: 'run-a',
        combatGeneration: 1,
        publication: {
          intent: 'publish',
          combatGeneration: 1,
          acknowledged: false,
        },
      },
      pendingEnds: [],
    });
    await commit(repository, { type: 'combat.end', runId: 'run-a', at: AT });
    expect(publicationRunState(readySnapshot(repository))).toEqual({
      active: null,
      pendingEnds: [{ runId: 'run-a', combatGeneration: 1 }],
    });
  });

  it('holds publication while a player participant has no live data (F1)', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', 'aria', ADOPTED_PC]);
    const missing = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
    })!;
    expect(
      missing.participants.find(view => view.actorId === 'aria')
    ).toMatchObject({ missingPlayerData: true });
    // Unverified adopted PC shows its adoption stats: not waiting.
    expect(
      missing.participants.find(view => view.actorId === ADOPTED_PC)
    ).toMatchObject({ missingPlayerData: false });
    expect(buildScenePublication(missing, DEFAULT_COMBAT_CONFIG)).toEqual({
      status: 'waiting-player-data',
    });
    const ready = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [
        createMockPlayerData({
          playerId: 'legacy-aria',
          characterId: 'char-aria',
          characterData: createMockCharacterState({
            hitPoints: {
              current: 12,
              max: 20,
              temporary: 0,
              calculationMode: 'auto',
            },
          } as never),
        }),
      ],
    })!;
    const built = buildScenePublication(ready, DEFAULT_COMBAT_CONFIG);
    if (built.status !== 'ok') throw new Error(built.status);
    const aria = built.initiative.turnOrder.find(
      entry => entry.entityId === 'm-aria'
    );
    expect(aria).toMatchObject({ currentHp: 12, maxHp: 20, isDead: false });
  });

  it('publishes a loaded-but-unavailable player without HP fields and passes the real validator (N1)', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', 'aria']);
    const validate = (initiative: unknown) =>
      parseTableCommand({
        type: 'publishInitiative',
        operationId: 'op-n1',
        expectedEpoch: '10000000-0000-4000-8000-000000000001',
        expectedRevision: 1,
        expectedFence: 1,
        holderSessionId: 'table-session',
        runId: 'run-a',
        initiative,
      });
    // (b1) snapshot loaded, aria's player left the campaign (identity unresolved).
    const unresolved = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [bran()],
    })!;
    // (b2) snapshot loaded, aria present without synced character data.
    const noSheet = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [
        createMockPlayerData({
          playerId: 'legacy-aria',
          characterId: 'char-aria',
          characterData: null as never,
        }),
      ],
    })!;
    for (const model of [unresolved, noSheet]) {
      expect(
        model.participants.find(view => view.actorId === 'aria')
      ).toMatchObject({
        missingPlayerData: false,
        playerDataUnavailable: true,
      });
      const built = buildScenePublication(model, DEFAULT_COMBAT_CONFIG);
      if (built.status !== 'ok') throw new Error(built.status);
      const aria = built.initiative.turnOrder.find(
        entry => entry.entityId === 'm-aria'
      )!;
      expect(aria.type).toBe('player');
      for (const field of [
        'currentHp',
        'maxHp',
        'hpPercent',
        'hpState',
        'hpTier',
        'isDead',
        'hpMode',
      ])
        expect(aria).not.toHaveProperty(field);
      expect(
        validate(JSON.parse(JSON.stringify(built.initiative)))
      ).not.toBeNull();
    }
    const unresolvedEntry = (
      buildScenePublication(unresolved, DEFAULT_COMBAT_CONFIG) as unknown as {
        initiative: { turnOrder: Array<Record<string, unknown>> };
      }
    ).initiative.turnOrder.find(entry => entry.entityId === 'm-aria')!;
    expect(unresolvedEntry).not.toHaveProperty('playerCharacterId');
    // (a) never loaded: still held.
    expect(
      buildScenePublication(
        buildCombatReadModel({
          snapshot: readySnapshot(repository),
          runId: 'run-a',
        })!,
        DEFAULT_COMBAT_CONFIG
      )
    ).toEqual({ status: 'waiting-player-data' });
  });
});
