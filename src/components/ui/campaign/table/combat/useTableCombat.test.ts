import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  runCombatCommand,
  type TableCombatCommandV1,
  type TableCombatStatChange,
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

import { useTableCombat, type TableCombatIntent } from './useTableCombat';

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
          }) as TableCombatCommandV1,
        'Orc initiative'
      );
      second = result.current.execute(
        () =>
          ({
            type: 'combat.setHidden',
            runId: 'run-a',
            actorId: 'goblin',
            hidden: true,
            at: AT,
          }) as TableCombatCommandV1,
        'Goblin hidden'
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
      first = result.current.execute(create, 'New run');
      second = result.current.execute(create, 'New run');
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

  const mountHook = async (
    stage: 'prepared' | 'ready' | 'started' = 'prepared'
  ) => {
    const repository = await preparedRun();
    if (stage !== 'prepared') {
      for (const [actorId, value] of [
        ['goblin', 15],
        ['orc', 10],
      ] as const)
        await runCombatCommand(repository, {
          expectedRevision: revisionOf(repository),
          operationId: `init-${actorId}`,
          command: {
            type: 'combat.setInitiative',
            runId: 'run-a',
            actorId,
            value,
            at: AT,
          },
        });
      if (stage === 'started')
        await runCombatCommand(repository, {
          expectedRevision: revisionOf(repository),
          operationId: 'start',
          command: { type: 'combat.start', runId: 'run-a', at: AT },
        });
    }
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
  type Repository = Awaited<ReturnType<typeof preparedRun>>;
  /** The next storage write fails once (a transient, retryable failure). */
  const failOnce = (repository: Repository) =>
    vi.spyOn(repository, 'mutateWorkspace').mockResolvedValueOnce({
      status: 'failed',
      reason: 'indexeddb-unavailable',
    } as never);
  // Pure intents: fixed at click time, like the panel's.
  const hide =
    (actorId: string): TableCombatIntent =>
    () => ({
      type: 'combat.setHidden',
      runId: 'run-a',
      actorId,
      hidden: true,
      at: AT,
    });
  const initiative =
    (actorId: string, value: number): TableCombatIntent =>
    () => ({
      type: 'combat.setInitiative',
      runId: 'run-a',
      actorId,
      value,
      at: AT,
    });
  const stat =
    (change: TableCombatStatChange): TableCombatIntent =>
    () => ({
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'orc',
      change,
      at: AT,
    });
  const nextTurn: TableCombatIntent = () => ({
    type: 'combat.nextTurn',
    runId: 'run-a',
    at: AT,
  });
  const runOf = (repository: Repository) =>
    readySnapshot(repository).encounters.find(
      value => value.runId === 'run-a'
    )!;
  const participant = (repository: Repository, actorId: string) =>
    runOf(repository).participants.find(p => p.actorId === actorId)!;
  const orcHp = (repository: Repository) =>
    buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
    })!.participants.find(p => p.actorId === 'orc')!.entity.currentHp;

  it('keeps an earlier failure listed when an intent queued before it commits (review U1)', async () => {
    const { result } = await mountHook();
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.execute(hide('nobody'), 'Nobody hidden');
      second = result.current.execute(hide('goblin'), 'Goblin hidden');
    });
    await act(async () => {
      await first;
      await second;
    });
    expect(await second).toMatchObject({ status: 'committed' });
    expect(result.current.unsavedNotice?.message).toMatch(
      /^Nobody hidden wasn't saved\./
    );
  });

  it('X1a: a set fails, a newer set saves, no Retry is left and the newer value stays', async () => {
    const { repository, result } = await mountHook();
    failOnce(repository);
    await act(async () => {
      await result.current.execute(initiative('orc', 12), 'Orc initiative');
    });
    expect(result.current.unsavedNotice?.message).toBe(
      "Orc initiative wasn't saved. Table storage is unavailable on this device. Nothing was saved."
    );
    expect(result.current.unsavedNotice?.retry).toBeTypeOf('function');
    await act(async () => {
      await result.current.execute(initiative('orc', 18), 'Orc initiative');
    });
    expect(result.current.unsavedNotice).toBeNull();
    expect(participant(repository, 'orc').initiative).toBe(18);
  });

  it('X1b: damage fails, a manual HP set saves, the damage cannot be applied twice', async () => {
    const { repository, result } = await mountHook('started');
    const hp = orcHp(repository);
    failOnce(repository);
    await act(async () => {
      await result.current.execute(
        stat({ kind: 'damage', value: 5 }),
        'Orc damage'
      );
    });
    expect(orcHp(repository)).toBe(hp);
    expect(result.current.unsavedNotice?.retry).toBeTypeOf('function');
    await act(async () => {
      await result.current.execute(
        stat({ kind: 'setHp', value: hp - 5 }),
        'Orc HP'
      );
    });
    expect(result.current.unsavedNotice).toBeNull();
    expect(orcHp(repository)).toBe(hp - 5);
  });

  it('X1c: Next fails, Next again saves, no extra turn can follow', async () => {
    const { repository, result } = await mountHook('started');
    const before = runOf(repository);
    failOnce(repository);
    await act(async () => {
      await result.current.execute(nextTurn, 'Next turn');
    });
    expect(result.current.unsavedNotice?.retry).toBeTypeOf('function');
    await act(async () => {
      await result.current.execute(nextTurn, 'Next turn');
    });
    expect(result.current.unsavedNotice).toBeNull();
    const after = runOf(repository);
    expect(after.currentActorId).not.toBe(before.currentActorId);
    expect(after.round).toBe(before.round);
  });

  it('X2: a rejection offers no Retry and the next action clears it', async () => {
    const { result } = await mountHook();
    await act(async () => {
      await result.current.execute(nextTurn, 'Next turn');
    });
    expect(result.current.unsavedNotice).toMatchObject({
      tone: 'error',
      message: "Next turn wasn't saved. This run is not running here.",
    });
    expect(result.current.unsavedNotice?.retry).toBeUndefined();
    await act(async () => {
      await result.current.execute(hide('goblin'), 'Goblin hidden');
    });
    expect(result.current.unsavedNotice).toBeNull();
  });

  it('W1: two failures that piled up while queued are both named, with no Retry', async () => {
    const { result } = await mountHook();
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.execute(hide('nobody'), 'Nobody hidden');
      second = result.current.execute(
        initiative('ghost', 3),
        'Ghost initiative'
      );
    });
    await act(async () => {
      await first;
      await second;
    });
    expect(result.current.unsavedNotice?.message).toMatch(
      /^These changes weren't saved: Nobody hidden, Ghost initiative\. /
    );
    expect(result.current.unsavedNotice?.retry).toBeUndefined();
  });

  it('W2/X2: one-off notices show beside the unsaved change and never replace it', async () => {
    const { repository, result } = await mountHook('started');
    failOnce(repository);
    await act(async () => {
      await result.current.execute(
        stat({ kind: 'damage', value: 2 }),
        'Orc damage'
      );
    });
    act(() => {
      result.current.setNotice({
        tone: 'error',
        message: 'Scene is now shown; combat did not start.',
      });
    });
    expect(result.current.notice?.message).toBe(
      'Scene is now shown; combat did not start.'
    );
    expect(result.current.unsavedNotice?.message).toMatch(
      /^Orc damage wasn't saved\./
    );
    let saving!: Promise<unknown>;
    act(() => {
      // Queued behind a pending save, a turn step is refused (no start).
      saving = result.current.execute(
        stat({ kind: 'setArmorClass', value: 14 }),
        'Orc AC'
      );
    });
    act(() => {
      void result.current.execute(nextTurn, 'Next turn');
    });
    expect(result.current.notice?.message).toMatch(/Still saving/);
    await act(async () => {
      await saving;
    });
    expect(result.current.notice).toBeNull();
  });

  it('Show + Start outcome stays visible while an unsaved change is listed', async () => {
    const { result } = await mountHook('ready');
    let combined!: Promise<unknown>;
    let queued!: Promise<unknown>;
    act(() => {
      combined = result.current.showAndStart('run-a', async () => ({
        ok: false,
        reason: 'live play is off',
      }));
      // A value edit queued behind it fails after the outcome is set.
      queued = result.current.execute(hide('nobody'), 'Nobody hidden');
    });
    await act(async () => {
      await combined;
      await queued;
    });
    expect(result.current.notice?.message).toBe(
      "Scene not shown (live play is off), so combat didn't start."
    );
    expect(result.current.unsavedNotice?.message).toMatch(
      /^Nobody hidden wasn't saved\./
    );
  });

  it('V1: a Retry that commits clears the unsaved change', async () => {
    const { repository, result } = await mountHook();
    failOnce(repository);
    await act(async () => {
      await result.current.execute(hide('goblin'), 'Goblin hidden');
    });
    await act(async () => {
      result.current.unsavedNotice!.retry!();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(participant(repository, 'goblin').hidden).toBe(true);
    expect(result.current.unsavedNotice).toBeNull();
  });

  it('a double Retry press replays once', async () => {
    const { repository, result } = await mountHook('started');
    const hp = orcHp(repository);
    const write = failOnce(repository);
    await act(async () => {
      await result.current.execute(
        stat({ kind: 'damage', value: 3 }),
        'Orc damage'
      );
    });
    const retry = result.current.unsavedNotice!.retry!;
    act(() => {
      retry();
      retry();
    });
    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(orcHp(repository)).toBe(hp - 3);
    expect(write).toHaveBeenCalledTimes(2);
    expect(result.current.unsavedNotice).toBeNull();
  });

  it('V2: any success clears a "Still saving" info notice', async () => {
    const { result } = await mountHook();
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.execute(initiative('orc', 7), 'Orc initiative');
      void result.current.execute(
        () => ({
          type: 'combat.createRun',
          sceneId: SCENE_ID,
          runId: 'run-z',
          label: 'Refused',
          at: AT,
        }),
        'New run'
      );
    });
    expect(result.current.notice?.tone).toBe('info');
    await act(async () => {
      await first;
    });
    expect(result.current.notice).toBeNull();
  });
});
