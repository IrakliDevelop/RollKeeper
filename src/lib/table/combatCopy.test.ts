import { afterEach, describe, expect, it, vi } from 'vitest';

import { useEncounterStore } from '@/store/encounterStore';
import type { Encounter } from '@/types/encounter';

import {
  encounterCopySnapshot,
  runCombatCommand,
  type TableCombatCommandV1,
} from './combat';
import {
  AT,
  SCENE_ID,
  openFixture,
  readySnapshot,
  repositories,
  revisionOf,
} from './combat.fixture';
import type { TableRepository } from './repository';
import { runSceneCommand } from './sceneCommands';

afterEach(() => {
  repositories.splice(0).forEach(repository => repository.dispose());
  vi.restoreAllMocks();
});

const ENCOUNTER: Encounter = {
  id: 'enc-library-1',
  name: 'Bandit ambush',
  entities: [
    {
      id: 'e-bandit',
      type: 'monster',
      name: 'Bandit',
      initiative: 14,
      initiativeModifier: 1,
      currentHp: 11,
      maxHp: 11,
      tempHp: 0,
      armorClass: 12,
      conditions: [],
    },
    {
      id: 'e-pc',
      type: 'player',
      name: 'Aria',
      initiative: 9,
      initiativeModifier: 2,
      currentHp: 20,
      maxHp: 20,
      tempHp: 0,
      armorClass: 15,
      conditions: [],
    },
    {
      id: 'e-captain',
      type: 'npc',
      name: 'Captain',
      initiative: null,
      initiativeModifier: 0,
      currentHp: 30,
      maxHp: 32,
      tempHp: 2,
      armorClass: 15,
      conditions: [],
    },
  ],
  currentTurn: 0,
  round: 2,
  isActive: true,
  sortOrder: 'initiative',
  createdAt: AT,
  updatedAt: AT,
} as unknown as Encounter;

function copy(
  overrides: Partial<
    Extract<TableCombatCommandV1, { type: 'combat.createRunFromEncounter' }>
  > = {}
): TableCombatCommandV1 {
  return {
    type: 'combat.createRunFromEncounter',
    sceneId: SCENE_ID,
    runId: 'run-copy-1',
    label: 'Bandit ambush',
    encounter: encounterCopySnapshot(ENCOUNTER),
    sceneMemberIds: ['member-bandit-1', 'member-captain-1'],
    at: AT,
    ...overrides,
  };
}

function run(
  repository: TableRepository,
  command: TableCombatCommandV1,
  operationId = `op-${crypto.randomUUID()}`
) {
  return runCombatCommand(repository, {
    expectedRevision: revisionOf(repository),
    operationId,
    command,
  });
}

describe('A3 combat.createRunFromEncounter', () => {
  it('copies creatures (not players) into a new inactive run of the scene', async () => {
    const repository = await openFixture();
    const before = readySnapshot(repository);
    const result = await run(repository, copy());
    expect(result).toMatchObject({ status: 'committed' });
    const snapshot = readySnapshot(repository);
    const created = snapshot.encounters.find(
      item => item.runId === 'run-copy-1'
    );
    expect(created).toMatchObject({
      runId: 'run-copy-1',
      sceneId: SCENE_ID,
      sourceEncounterId: 'enc-library-1',
      runGeneration: 'run-copy-1',
      round: 0,
      currentActorId: null,
      isActive: false,
      label: 'Bandit ambush',
      participants: [
        { actorId: 'run-copy-1:e-bandit', initiative: null },
        { actorId: 'run-copy-1:e-captain', initiative: null },
      ],
    });
    const actors = snapshot.actors.filter(actor =>
      actor.actorId.startsWith('run-copy-1:')
    );
    expect(actors.map(actor => actor.actorId)).toEqual([
      'run-copy-1:e-bandit',
      'run-copy-1:e-captain',
    ]);
    expect(actors.every(actor => actor.actorKind === 'dm-managed')).toBe(true);
    expect(actors[1]!.liveStats).toMatchObject({
      name: 'Captain',
      currentHp: 30,
      maxHp: 32,
      tempHp: 2,
      armorClass: 15,
    });
    const scene = snapshot.scenes.find(item => item.sceneId === SCENE_ID)!;
    expect(scene.members.slice(-2)).toEqual([
      {
        actorId: 'run-copy-1:e-bandit',
        tokenIds: [],
        sceneMemberId: 'member-bandit-1',
      },
      {
        actorId: 'run-copy-1:e-captain',
        tokenIds: [],
        sceneMemberId: 'member-captain-1',
      },
    ]);
    expect(snapshot.campaign?.selectedRunId).toBe('run-copy-1');
    expect(snapshot.campaign?.activeRunId).toBe(before.campaign?.activeRunId);
    expect(snapshot.actors.some(actor => actor.actorId.endsWith(':e-pc'))).toBe(
      false
    );
    expect(snapshot.campaign?.sourceMappings).toEqual(
      before.campaign?.sourceMappings
    );
  });

  it('never mutates the library definition or the encounter store', async () => {
    const repository = await openFixture();
    const setState = vi.spyOn(useEncounterStore, 'setState');
    const library = structuredClone(ENCOUNTER);
    const snapshot = encounterCopySnapshot(library);
    await run(repository, copy({ encounter: snapshot }));
    expect(library).toEqual(ENCOUNTER);
    expect(setState).not.toHaveBeenCalled();
  });

  it('allocates distinct actor ids for a second copy into another scene', async () => {
    const repository = await openFixture();
    await runSceneCommand(repository, {
      expectedRevision: revisionOf(repository),
      operationId: 'create-scene-2',
      command: {
        type: 'scene.create',
        sceneId: 'scene-2',
        name: 'Forest',
        mapImageUrl: '',
        mapImageSize: { w: 0, h: 0 },
        at: AT,
      },
    });
    await run(repository, copy());
    await expect(
      run(
        repository,
        copy({
          sceneId: 'scene-2',
          runId: 'run-copy-2',
          sceneMemberIds: ['member-bandit-2', 'member-captain-2'],
        })
      )
    ).resolves.toMatchObject({ status: 'committed' });
    const snapshot = readySnapshot(repository);
    const ids = snapshot.actors
      .map(actor => actor.actorId)
      .filter(id => id.startsWith('run-copy-'));
    expect(new Set(ids).size).toBe(4);
    expect(
      snapshot.encounters.filter(
        item => item.sourceEncounterId === 'enc-library-1'
      )
    ).toHaveLength(2);
    const second = snapshot.scenes.find(item => item.sceneId === 'scene-2')!;
    expect(second.members.map(member => member.actorId)).toEqual([
      'run-copy-2:e-bandit',
      'run-copy-2:e-captain',
    ]);
  });

  it('replays the same operation id idempotently and never overwrites actors', async () => {
    const repository = await openFixture();
    const first = await run(repository, copy(), 'copy-op');
    const revision = revisionOf(repository);
    const replay = await runCombatCommand(repository, {
      expectedRevision: revision - 1,
      operationId: 'copy-op',
      command: copy(),
    });
    expect(replay).toEqual(first);
    expect(revisionOf(repository)).toBe(revision);
    const again = await run(repository, copy({ label: 'Another' }));
    expect(again).toMatchObject({ status: 'rejected' });
    expect(
      readySnapshot(repository).encounters.filter(
        item => item.runId === 'run-copy-1'
      )
    ).toHaveLength(1);
  });

  it.each([
    ['an unknown scene', { sceneId: 'nowhere' }],
    ['mismatched member ids', { sceneMemberIds: ['only-one'] }],
    ['an empty label', { label: '' }],
  ])('rejects %s and writes nothing', async (_label, overrides) => {
    const repository = await openFixture();
    const before = revisionOf(repository);
    await expect(run(repository, copy(overrides))).resolves.toMatchObject({
      status: 'rejected',
    });
    expect(revisionOf(repository)).toBe(before);
  });

  it('produces a JSON-only snapshot of the library definition', () => {
    const snapshot = encounterCopySnapshot({
      ...ENCOUNTER,
      entities: [{ ...ENCOUNTER.entities[0]!, concentrationSpell: undefined }],
    });
    expect(snapshot).toEqual({
      id: 'enc-library-1',
      name: 'Bandit ambush',
      entities: [JSON.parse(JSON.stringify(ENCOUNTER.entities[0]))],
    });
  });
});
