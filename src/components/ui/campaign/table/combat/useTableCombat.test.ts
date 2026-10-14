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

  it('still refuses a second lifecycle step while one saves, with a visible notice', async () => {
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
    // The refusal is visible while the first step saves.
    expect(result.current.notice?.message).toMatch(/try again/iu);
    await act(async () => {
      await first;
    });
    expect(await first).toMatchObject({ status: 'committed' });
    expect(await second).toBeNull();
    // Review V2: the "Still saving" notice ends with the save it refers to.
    expect(result.current.notice).toBeNull();
  });

  it('keeps an earlier queued intent error and Retry when a later one commits (review U1)', async () => {
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
      // A: an unknown participant is rejected.
      first = result.current.execute(
        () =>
          ({
            type: 'combat.setHidden',
            runId: 'run-a',
            actorId: 'nobody',
            hidden: true,
            at: AT,
          }) as TableCombatCommandV1
      );
      // B: a valid edit queued behind it commits.
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
    expect(await first).not.toMatchObject({ status: 'committed' });
    expect(await second).toMatchObject({ status: 'committed' });
    expect(result.current.notice?.tone).toBe('error');
    expect(result.current.notice?.retry).toBeTypeOf('function');
  });

  it('a later success still clears a "Still saving" info notice', async () => {
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
    act(() => {
      first = result.current.execute(
        () =>
          ({
            type: 'combat.setInitiative',
            runId: 'run-a',
            actorId: 'orc',
            value: 9,
            at: AT,
          }) as TableCombatCommandV1
      );
      void result.current.execute(
        () =>
          ({
            type: 'combat.createRun',
            sceneId: SCENE_ID,
            runId: 'run-c',
            label: 'Refused',
            at: AT,
          }) as TableCombatCommandV1
      );
    });
    expect(result.current.notice?.tone).toBe('info');
    let later!: Promise<unknown>;
    await act(async () => {
      await first;
      later = result.current.execute(
        () =>
          ({
            type: 'combat.setHidden',
            runId: 'run-a',
            actorId: 'goblin',
            hidden: true,
            at: AT,
          }) as TableCombatCommandV1
      );
      await later;
    });
    expect(result.current.notice).toBeNull();
  });

  const mountHook = async () => {
    const repository = await preparedRun();
    const view = renderHook(() =>
      useTableCombat({
        repository,
        sceneId: SCENE_ID,
        campaignCode: 'CAMP',
        requestedRunId: 'run-a',
      })
    );
    await waitFor(() =>
      expect(view.result.current.selectedRun?.runId).toBe('run-a')
    );
    return { repository, ...view };
  };
  const rejected = () =>
    ({
      type: 'combat.setHidden',
      runId: 'run-a',
      actorId: 'nobody',
      hidden: true,
      at: AT,
    }) as TableCombatCommandV1;

  it('a Retry that commits clears the error and its Retry (review V1)', async () => {
    const { repository, result } = await mountHook();
    // The intent targets an unknown participant until the cause is fixed.
    let actorId = 'nobody';
    const flaky = () =>
      ({
        type: 'combat.setHidden',
        runId: 'run-a',
        actorId,
        hidden: true,
        at: AT,
      }) as TableCombatCommandV1;
    await act(async () => {
      await result.current.execute(flaky);
    });
    expect(result.current.notice?.tone).toBe('error');
    const retry = result.current.notice!.retry!;
    actorId = 'goblin';
    await act(async () => {
      retry();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(result.current.saving).toBe(false));
    const run = readySnapshot(repository).encounters.find(
      value => value.runId === 'run-a'
    )!;
    expect(run.participants.find(p => p.actorId === 'goblin')?.hidden).toBe(
      true
    );
    expect(result.current.notice).toBeNull();
  });

  const hideIntent = (actor: () => string) =>
    vi.fn(
      () =>
        ({
          type: 'combat.setHidden',
          runId: 'run-a',
          actorId: actor(),
          hidden: true,
          at: AT,
        }) as TableCombatCommandV1
    );
  const hiddenOf = (
    repository: Awaited<ReturnType<typeof preparedRun>>,
    actorId: string
  ) =>
    readySnapshot(repository)
      .encounters.find(value => value.runId === 'run-a')!
      .participants.find(p => p.actorId === actorId)?.hidden;

  it('an edit started after the error commits but the unsaved change stays listed', async () => {
    const { result } = await mountHook();
    await act(async () => {
      await result.current.execute(rejected);
    });
    expect(result.current.notice?.tone).toBe('error');
    let later!: Promise<unknown>;
    act(() => {
      later = result.current.execute(
        () =>
          ({
            type: 'combat.setInitiative',
            runId: 'run-a',
            actorId: 'orc',
            value: 11,
            at: AT,
          }) as TableCombatCommandV1
      );
    });
    expect(result.current.saving).toBe(true);
    await act(async () => {
      await later;
    });
    expect(result.current.notice?.tone).toBe('error');
    expect(result.current.notice?.message).toMatch(/^1 change wasn't saved\./);
    expect(result.current.notice?.retry).toBeTypeOf('function');
  });

  it('two queued failures then one Retry applies both in order and clears the error (review W1)', async () => {
    const { repository, result } = await mountHook();
    let first = 'nobody';
    let second = 'nobody';
    const a = hideIntent(() => first);
    const b = hideIntent(() => second);
    let pa!: Promise<unknown>;
    let pb!: Promise<unknown>;
    act(() => {
      pa = result.current.execute(a);
      pb = result.current.execute(b);
    });
    await act(async () => {
      await pa;
      await pb;
    });
    expect(result.current.notice?.tone).toBe('error');
    expect(result.current.notice?.message).toMatch(
      /^2 changes weren't saved\..*Retry saves them in order\.$/
    );
    first = 'goblin';
    second = 'orc';
    await act(async () => {
      result.current.notice!.retry!();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(hiddenOf(repository, 'goblin')).toBe(true);
    expect(hiddenOf(repository, 'orc')).toBe(true);
    expect(result.current.notice).toBeNull();
  });

  it('a refused lifecycle step while the error shows keeps the error and Retry (review W2)', async () => {
    const { result } = await mountHook();
    await act(async () => {
      await result.current.execute(rejected);
    });
    let saving!: Promise<unknown>;
    act(() => {
      saving = result.current.execute(
        () =>
          ({
            type: 'combat.setInitiative',
            runId: 'run-a',
            actorId: 'orc',
            value: 4,
            at: AT,
          }) as TableCombatCommandV1
      );
      void result.current.execute(
        () =>
          ({
            type: 'combat.createRun',
            sceneId: SCENE_ID,
            runId: 'run-w2',
            label: 'Refused',
            at: AT,
          }) as TableCombatCommandV1
      );
    });
    expect(result.current.notice?.tone).toBe('error');
    expect(result.current.notice?.retry).toBeTypeOf('function');
    await act(async () => {
      await saving;
    });
    expect(result.current.notice?.tone).toBe('error');
    expect(result.current.notice?.retry).toBeTypeOf('function');
  });

  it('a Retry that fails again keeps the same count with no duplicate entries', async () => {
    const { result } = await mountHook();
    const a = hideIntent(() => 'nobody');
    const b = hideIntent(() => 'nobody');
    await act(async () => {
      await result.current.execute(a);
      await result.current.execute(b);
    });
    expect(result.current.notice?.message).toMatch(/^2 changes/);
    await act(async () => {
      result.current.notice!.retry!();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(result.current.saving).toBe(false));
    await waitFor(() =>
      expect(result.current.notice?.retry).toBeTypeOf('function')
    );
    expect(result.current.notice?.tone).toBe('error');
    expect(result.current.notice?.message).toMatch(/^2 changes/);
  });

  it('a Retry press replays once: its button hides while the replay runs', async () => {
    const { repository, result } = await mountHook();
    let actorId = 'nobody';
    const a = hideIntent(() => actorId);
    await act(async () => {
      await result.current.execute(a);
    });
    const calls = a.mock.calls.length;
    const retry = result.current.notice!.retry!;
    actorId = 'goblin';
    act(() => {
      retry();
      retry();
    });
    expect(result.current.notice?.retry).toBeUndefined();
    await waitFor(() => expect(result.current.saving).toBe(false));
    await waitFor(() => expect(result.current.notice).toBeNull());
    expect(a.mock.calls.length).toBe(calls + 1);
    expect(hiddenOf(repository, 'goblin')).toBe(true);
  });

  it('any success clears a "Still saving" info notice, even one raised later (review V2)', async () => {
    const { result } = await mountHook();
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.execute(
        () =>
          ({
            type: 'combat.setInitiative',
            runId: 'run-a',
            actorId: 'orc',
            value: 7,
            at: AT,
          }) as TableCombatCommandV1
      );
      void result.current.execute(
        () =>
          ({
            type: 'combat.createRun',
            sceneId: SCENE_ID,
            runId: 'run-z',
            label: 'Refused',
            at: AT,
          }) as TableCombatCommandV1
      );
    });
    expect(result.current.notice?.tone).toBe('info');
    await act(async () => {
      await first;
    });
    expect(result.current.notice).toBeNull();
  });
});
