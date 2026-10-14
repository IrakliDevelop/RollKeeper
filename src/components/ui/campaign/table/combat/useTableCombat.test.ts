import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  runCombatCommand,
  type TableCombatCommandV1,
} from '@/lib/table/combat';
import { buildCombatReadModel } from '@/lib/table/combatReadModel';
import {
  AT,
  SCENE_ID,
  openFixture,
  readySnapshot,
  repositories,
  revisionOf,
} from '@/lib/table/combat.fixture';
import { buildSharedInitiative } from '@/utils/buildSharedInitiative';

import { useTableCombat } from './useTableCombat';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 503 }))
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  repositories.splice(0).forEach(repository => repository.dispose());
});

async function preparedRun() {
  const repository = await openFixture();
  let n = 0;
  const command = (value: unknown) =>
    runCombatCommand(repository, {
      expectedRevision: revisionOf(repository),
      operationId: `seed-${++n}`,
      command: value as TableCombatCommandV1,
    });
  await command({
    type: 'combat.createRun',
    sceneId: SCENE_ID,
    runId: 'run-a',
    label: 'Privacy R2',
    at: AT,
  });
  await command({
    type: 'combat.setParticipants',
    runId: 'run-a',
    actorIds: ['goblin', 'orc'],
    at: AT,
  });
  await command({ type: 'combat.selectRun', runId: 'run-a', at: AT });
  return repository;
}

describe('useTableCombat user intents (PR08 desktop B3)', () => {
  it('applies a Hide that arrives while an initiative save is in flight, in order', async () => {
    const repository = await preparedRun();
    const { result } = renderHook(() =>
      useTableCombat({
        repository,
        sceneId: SCENE_ID,
        campaignCode: 'CAMP',
        requestedRunId: 'run-a',
      })
    );
    await waitFor(() =>
      expect(result.current.selectedRun?.runId).toBe('run-a')
    );
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.execute(
        () =>
          ({
            type: 'combat.setInitiative',
            runId: 'run-a',
            actorId: 'orc',
            value: 14,
            at: AT,
          }) as TableCombatCommandV1
      );
      second = result.current.execute(
        () =>
          ({
            type: 'combat.setHidden',
            runId: 'run-a',
            actorId: 'goblin',
            hidden: true,
            at: AT,
          }) as TableCombatCommandV1
      );
    });
    await act(async () => {
      await first;
      await second;
    });
    expect(await second).toMatchObject({ status: 'committed' });
    const snapshot = readySnapshot(repository);
    const run = snapshot.encounters.find(value => value.runId === 'run-a')!;
    expect(run.participants.find(p => p.actorId === 'orc')?.initiative).toBe(
      14
    );
    expect(run.participants.find(p => p.actorId === 'goblin')?.hidden).toBe(
      true
    );
    expect(result.current.notice).toBeNull();
    expect(result.current.saving).toBe(false);
    // The published initiative masks the hidden goblin.
    const model = buildCombatReadModel({ snapshot, runId: 'run-a' });
    const published = buildSharedInitiative(model!.encounter);
    const goblin = published.turnOrder.find(
      entry =>
        entry.entityId ===
        model!.participants.find(p => p.actorId === 'goblin')!.entityId
    );
    expect(goblin?.displayName).toBe('Enemy');
  });

  it('still refuses a second lifecycle step while one saves, and keeps that notice', async () => {
    const repository = await preparedRun();
    const { result } = renderHook(() =>
      useTableCombat({
        repository,
        sceneId: SCENE_ID,
        campaignCode: 'CAMP',
        requestedRunId: 'run-a',
      })
    );
    await waitFor(() =>
      expect(result.current.selectedRun?.runId).toBe('run-a')
    );
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    const create = () =>
      ({
        type: 'combat.createRun',
        sceneId: SCENE_ID,
        runId: 'run-b',
        label: 'Second run',
        at: AT,
      }) as TableCombatCommandV1;
    act(() => {
      first = result.current.execute(create);
      second = result.current.execute(create);
    });
    await act(async () => {
      await first;
    });
    expect(await first).toMatchObject({ status: 'committed' });
    expect(await second).toBeNull();
    // The refusal is not erased by the earlier intent's success.
    expect(result.current.notice?.message).toMatch(/try again/iu);
  });
});
