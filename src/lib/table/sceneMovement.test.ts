import { afterEach, expect, it } from 'vitest';
import { createTableSceneAdapter } from './sceneAdapter';
import { runCombatCommand, type TableCombatCommandV1 } from './combat';
import {
  AT,
  SCENE_ID,
  openFixture,
  repositories,
  revisionOf,
} from './combat.fixture';

afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

it('uses this scene active run, public member identity, and restart generation without resetting on HP edits', async () => {
  const repository = await openFixture();
  let operation = 0;
  const commit = async (command: TableCombatCommandV1) => {
    const result = await runCombatCommand(repository, {
      expectedRevision: revisionOf(repository),
      operationId: `movement-${++operation}`,
      command,
    });
    expect(result.status).toBe('committed');
  };
  const adapter = createTableSceneAdapter({
    repository,
    sceneId: SCENE_ID,
    campaignCode: 'TEST',
  });
  expect(adapter.getMovementTurn?.()).toBeNull();
  await commit({
    type: 'combat.createRun',
    runId: 'run-new',
    sceneId: SCENE_ID,
    label: 'Private label',
    at: AT,
  });
  await commit({
    type: 'combat.setParticipants',
    runId: 'run-new',
    actorIds: ['goblin'],
    at: AT,
  });
  await commit({
    type: 'combat.setInitiative',
    runId: 'run-new',
    actorId: 'goblin',
    value: 20,
    at: AT,
  });
  await commit({ type: 'combat.start', runId: 'run-new', at: AT });
  expect(adapter.getMovementTurn?.()).toEqual({
    epoch: 'run-new:1:1:m-goblin',
    entityIds: ['m-goblin'],
    playerIds: [],
  });
  await commit({
    type: 'combat.applyStat',
    runId: 'run-new',
    actorId: 'goblin',
    change: { kind: 'damage', value: 1 },
    at: AT,
  });
  expect(adapter.getMovementTurn?.()?.epoch).toBe('run-new:1:1:m-goblin');
  await commit({ type: 'combat.nextTurn', runId: 'run-new', at: AT });
  expect(adapter.getMovementTurn?.()?.epoch).toBe('run-new:1:2:m-goblin');
  await commit({ type: 'combat.end', runId: 'run-new', at: AT });
  expect(adapter.getMovementTurn?.()).toBeNull();
  await commit({ type: 'combat.start', runId: 'run-new', at: AT });
  expect(adapter.getMovementTurn?.()?.epoch).toBe('run-new:2:1:m-goblin');
  const otherScene = createTableSceneAdapter({
    repository,
    sceneId: 'unselected-scene',
    campaignCode: 'TEST',
  });
  expect(otherScene.getMovementTurn?.()).toBeNull();
  otherScene.dispose();
  adapter.dispose();
});
