import { afterEach, describe, expect, it } from 'vitest';

import { runCombatCommand, type TableCombatCommandV1 } from './combat';
import {
  AT,
  SCENE_ID,
  openFixture,
  readySnapshot,
  repositories,
  revisionOf,
} from './combat.fixture';
import {
  combatHistoryExport,
  combatHistoryText,
  listCombatArchives,
} from './combatHistory';
import type { TableRepository } from './repository';

afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

let counter = 0;
async function commit(repository: TableRepository, command: unknown) {
  counter += 1;
  const result = await runCombatCommand(repository, {
    expectedRevision: revisionOf(repository),
    operationId: `history-${counter}`,
    command: command as TableCombatCommandV1,
  });
  if (result.status !== 'committed') throw new Error(JSON.stringify(result));
}

describe('scene combat history (D7)', () => {
  it('lists archives and exports the documented JSON and text', async () => {
    const repository = await openFixture();
    await commit(repository, {
      type: 'combat.createRun',
      sceneId: SCENE_ID,
      runId: 'run-a',
      label: 'Bridge fight',
      at: AT,
    });
    await commit(repository, {
      type: 'combat.setParticipants',
      runId: 'run-a',
      actorIds: ['goblin'],
      at: AT,
    });
    await commit(repository, {
      type: 'combat.setInitiative',
      runId: 'run-a',
      actorId: 'goblin',
      value: 4,
      at: AT,
    });
    await commit(repository, { type: 'combat.start', runId: 'run-a', at: AT });
    await commit(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'damage', value: 3 },
      at: AT,
    });
    await commit(repository, { type: 'combat.end', runId: 'run-a', at: AT });
    const snapshot = readySnapshot(repository);

    expect(listCombatArchives(snapshot)).toEqual([
      {
        archiveId: 'run-a:1',
        runId: 'run-a',
        sceneId: SCENE_ID,
        sceneName: 'Secret Lair Of The Lich',
        label: 'Bridge fight',
        combatGeneration: 1,
        startedAt: AT,
        endedAt: AT,
        eventCount: 3,
        loggingPaused: false,
        active: false,
      },
    ]);
    const exported = combatHistoryExport(snapshot, 'run-a:1')!;
    expect(Object.keys(exported).sort()).toEqual(
      [
        'format',
        'version',
        'archiveId',
        'runId',
        'sceneId',
        'label',
        'combatGeneration',
        'startedAt',
        'endedAt',
        'loggingPaused',
        'events',
      ].sort()
    );
    expect(exported).toMatchObject({
      format: 'rollkeeper-table-combat-history',
      version: 1,
      archiveId: 'run-a:1',
      runId: 'run-a',
      sceneId: SCENE_ID,
      label: 'Bridge fight',
      combatGeneration: 1,
      loggingPaused: false,
    });
    expect(exported.events.map(event => event.type)).toEqual([
      'combat_start',
      'damage',
      'combat_end',
    ]);
    expect(combatHistoryText(snapshot, 'run-a:1')).toContain(
      '[R1] DM dealt 3 untyped damage to Goblin'
    );
    expect(combatHistoryExport(snapshot, 'missing')).toBeNull();
  });
});
