import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SharedInitiativeState } from '@/types/sharedState';

import {
  createCombatPublisher,
  type PublicationRunState,
  type PublicationStatus,
  type PublisherSession,
} from './combatPublisher';

const payload = (runId: string, round = 1): SharedInitiativeState => ({
  encounterId: runId,
  isActive: true,
  round,
  currentEntityId: 'm-goblin',
  turnOrder: [{ entityId: 'm-goblin', displayName: 'Goblin', type: 'monster' }],
  enemyHpMode: 'off',
  enemyConditionsMode: 'off',
  updatedAt: 'now',
});

function harness(options: { session?: PublisherSession | null } = {}) {
  const state: PublicationRunState = { active: null, pendingEnds: [] };
  let lost = false;
  const session: PublisherSession = {
    isLost: () => lost,
    publishInitiative: vi.fn(async () =>
      lost
        ? { status: 'lost' as const, reason: 'lease-lost' }
        : { status: 'committed' as const }
    ),
    endInitiative: vi.fn(async () =>
      lost
        ? { status: 'lost' as const, reason: 'lease-lost' }
        : { status: 'committed' as const }
    ),
  };
  const statuses: PublicationStatus[] = [];
  const acknowledge = vi.fn(async () => true);
  const buildPayload = vi.fn((runId: string) =>
    state.active?.runId === runId
      ? { status: 'ok' as const, initiative: payload(runId) }
      : { status: 'not-running' as const }
  );
  const publisher = createCombatPublisher({
    getSession: () =>
      options.session === undefined ? session : options.session,
    readState: () => structuredClone(state),
    buildPayload,
    acknowledge,
    onStatus: status => statuses.push(status),
  });
  return {
    state,
    session,
    publisher,
    acknowledge,
    buildPayload,
    statuses,
    lastStatus: () => statuses.at(-1),
    loseLease: () => {
      lost = true;
    },
  };
}

function startLocally(state: PublicationRunState, runId = 'run-a', gen = 1) {
  state.active = {
    runId,
    combatGeneration: gen,
    publication: {
      intent: 'publish',
      combatGeneration: gen,
      acknowledged: false,
    },
  };
}

const flush = async () => {
  for (let index = 0; index < 5; index += 1)
    await vi.advanceTimersByTimeAsync(0);
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Table combat publisher (D8, R2-5, R2-7, C3-8, C3-9)', () => {
  it('publishes a start intent and acknowledges it exactly once', async () => {
    const h = harness();
    h.publisher.hold();
    startLocally(h.state);
    h.publisher.changed();
    await flush();
    expect(h.session.publishInitiative).toHaveBeenCalledWith(
      'run-a',
      payload('run-a')
    );
    expect(h.acknowledge).toHaveBeenCalledTimes(1);
    expect(h.acknowledge).toHaveBeenCalledWith([
      { runId: 'run-a', combatGeneration: 1, intent: 'publish' },
    ]);
    expect(h.lastStatus()).toEqual({ kind: 'broadcasting', runId: 'run-a' });
  });

  it('debounces turn publishes to at most one per second and never acknowledges them', async () => {
    const h = harness();
    h.publisher.hold();
    startLocally(h.state);
    h.publisher.changed();
    await flush();
    h.state.active!.publication!.acknowledged = true;
    h.acknowledge.mockClear();
    vi.mocked(h.session.publishInitiative).mockClear();
    // A real change (next round); identical payloads are skipped (F6).
    h.buildPayload.mockImplementation((runId: string) => ({
      status: 'ok' as const,
      initiative: payload(runId, 2),
    }));
    h.publisher.changed();
    h.publisher.changed();
    h.publisher.changed();
    await flush();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1_000);
    await flush();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
    expect(h.acknowledge).not.toHaveBeenCalled();
  });

  it('keeps a local start pending as "Started locally" after a remote failure and retries the same generation', async () => {
    const h = harness();
    h.publisher.hold();
    startLocally(h.state, 'run-a', 3);
    vi.mocked(h.session.publishInitiative).mockResolvedValueOnce({
      status: 'failed',
      reason: 'network',
    });
    h.publisher.changed();
    await flush();
    expect(h.lastStatus()).toMatchObject({
      kind: 'not-broadcasting',
      pending: 'publish',
    });
    expect(h.acknowledge).not.toHaveBeenCalled();
    // Further local turns do not publish behind the DM's back.
    h.publisher.changed();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
    await h.publisher.publishCurrentState();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(2);
    expect(h.acknowledge).toHaveBeenCalledWith([
      { runId: 'run-a', combatGeneration: 3, intent: 'publish' },
    ]);
    expect(h.lastStatus()).toEqual({ kind: 'broadcasting', runId: 'run-a' });
  });

  it('reports "Remote initiative may be stale" after a failed end and acknowledges all ends on retry', async () => {
    const h = harness();
    h.publisher.hold();
    h.state.pendingEnds = [
      { runId: 'run-a', combatGeneration: 1 },
      { runId: 'run-b', combatGeneration: 2 },
    ];
    vi.mocked(h.session.endInitiative).mockResolvedValueOnce({
      status: 'failed',
      reason: 'network',
    });
    h.publisher.changed();
    await flush();
    expect(h.lastStatus()).toMatchObject({ kind: 'stale' });
    await h.publisher.publishCurrentState();
    expect(h.session.endInitiative).toHaveBeenCalledTimes(2);
    expect(h.acknowledge).toHaveBeenCalledTimes(1);
    expect(h.acknowledge).toHaveBeenCalledWith([
      { runId: 'run-a', combatGeneration: 1, intent: 'end' },
      { runId: 'run-b', combatGeneration: 2, intent: 'end' },
    ]);
    expect(h.lastStatus()).toEqual({ kind: 'saved-locally' });
  });

  it('after a takeover a delayed retry is refused and never republishes the ended run', async () => {
    const h = harness();
    h.publisher.hold();
    startLocally(h.state);
    h.publisher.changed();
    await flush();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
    h.loseLease();
    h.state.active = null;
    h.state.pendingEnds = [{ runId: 'run-a', combatGeneration: 1 }];
    h.publisher.changed();
    await flush();
    await h.publisher.publishCurrentState();
    await flush();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
    expect(h.lastStatus()).toMatchObject({
      kind: 'not-broadcasting',
      reason: 'lease-lost',
    });
    expect(h.acknowledge).toHaveBeenCalledTimes(1); // only the original start
  });

  it('restores a pending start after reload and waits for explicit publication', async () => {
    const h = harness();
    startLocally(h.state);
    h.publisher.hold();
    expect(h.lastStatus()).toMatchObject({
      kind: 'not-broadcasting',
      pending: 'publish',
    });
    h.publisher.changed();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.session.publishInitiative).not.toHaveBeenCalled();
    await h.publisher.publishCurrentState();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
  });

  it('publishes a start committed by another tab from the lease-holding tab', async () => {
    const h = harness();
    h.publisher.hold();
    expect(h.lastStatus()).toEqual({ kind: 'saved-locally' });
    // Repository invalidation from tab B: a new start intent appears.
    startLocally(h.state, 'run-b', 1);
    h.publisher.changed();
    await flush();
    expect(h.session.publishInitiative).toHaveBeenCalledWith(
      'run-b',
      payload('run-b')
    );
  });

  it('never publishes from a tab without the lease', async () => {
    const h = harness({ session: null });
    h.publisher.hold();
    startLocally(h.state);
    h.publisher.changed();
    await h.publisher.publishCurrentState();
    await flush();
    expect(h.session.publishInitiative).not.toHaveBeenCalled();
    expect(h.lastStatus()).toMatchObject({
      kind: 'not-broadcasting',
      reason: 'no-control',
    });
  });

  it('after a reacquire shows the cleared initiative and waits for explicit publication', async () => {
    const h = harness();
    h.publisher.hold();
    startLocally(h.state);
    h.publisher.changed();
    await flush();
    h.state.active!.publication!.acknowledged = true;
    vi.mocked(h.session.publishInitiative).mockClear();
    h.publisher.hold();
    expect(h.lastStatus()).toEqual({ kind: 'cleared' });
    h.publisher.changed();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.session.publishInitiative).not.toHaveBeenCalled();
  });

  it('blocks visibly on an invalid identity without a request', async () => {
    const h = harness();
    h.buildPayload.mockReturnValue({ status: 'invalid-identity' } as never);
    h.publisher.hold();
    startLocally(h.state);
    h.publisher.changed();
    await flush();
    expect(h.session.publishInitiative).not.toHaveBeenCalled();
    expect(h.lastStatus()).toEqual({
      kind: 'blocked',
      reason: 'invalid-identity',
    });
  });

  it('waits visibly for player data without a request, then publishes when it arrives (F1)', async () => {
    const h = harness();
    let waiting = true;
    h.buildPayload.mockImplementation((runId: string) =>
      waiting
        ? ({ status: 'waiting-player-data' } as never)
        : { status: 'ok' as const, initiative: payload(runId) }
    );
    h.publisher.hold();
    startLocally(h.state);
    h.publisher.changed();
    await flush();
    expect(h.session.publishInitiative).not.toHaveBeenCalled();
    expect(h.lastStatus()).toEqual({ kind: 'waiting', reason: 'player-data' });
    waiting = false;
    h.publisher.changed();
    await flush();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
    expect(h.lastStatus()).toEqual({ kind: 'broadcasting', runId: 'run-a' });
  });

  it('keeps an explicit publish waiting for player data and sends it once data arrives (F1)', async () => {
    const h = harness();
    let waiting = true;
    h.buildPayload.mockImplementation((runId: string) =>
      waiting
        ? ({ status: 'waiting-player-data' } as never)
        : { status: 'ok' as const, initiative: payload(runId) }
    );
    startLocally(h.state);
    h.state.active!.publication!.acknowledged = true;
    h.publisher.hold();
    await h.publisher.publishCurrentState();
    expect(h.session.publishInitiative).not.toHaveBeenCalled();
    expect(h.lastStatus()).toEqual({ kind: 'waiting', reason: 'player-data' });
    waiting = false;
    h.publisher.changed();
    await flush();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
  });

  it('skips automatic publishes whose canonical payload is unchanged, but an explicit publish always sends (F6)', async () => {
    const h = harness();
    h.publisher.hold();
    startLocally(h.state);
    h.publisher.changed();
    await flush();
    h.state.active!.publication!.acknowledged = true;
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
    // Players poll: new data identity, identical payload (updatedAt aside).
    await vi.advanceTimersByTimeAsync(5_000);
    h.publisher.changed();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
    // A real change publishes.
    h.buildPayload.mockImplementation((runId: string) => ({
      status: 'ok' as const,
      initiative: payload(runId, 2),
    }));
    h.publisher.changed();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(2);
    // After a reacquire the identical state must be sent again explicitly.
    h.publisher.hold();
    await h.publisher.publishCurrentState();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(3);
  });

  it('pins the dedupe guards: explicit, generation, and pending ack retry (N4)', async () => {
    const h = harness();
    h.publisher.hold();
    startLocally(h.state);
    h.publisher.changed();
    await flush();
    h.state.active!.publication!.acknowledged = true;
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(1);
    // Explicit publish while broadcasting with an identical payload sends.
    await h.publisher.publishCurrentState();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(2);
    // Same run, next generation, identical payload, intent already acked:
    // still a different public state (generation) → sends.
    startLocally(h.state, 'run-a', 2);
    h.state.active!.publication!.acknowledged = true;
    await vi.advanceTimersByTimeAsync(2_000);
    h.publisher.changed();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(3);
    // Pending intent whose ack failed: identical payload is re-sent and
    // re-acknowledged rather than silently skipped.
    startLocally(h.state, 'run-a', 3);
    h.acknowledge.mockResolvedValueOnce(false);
    await vi.advanceTimersByTimeAsync(2_000);
    h.publisher.changed();
    await flush();
    const sends = vi.mocked(h.session.publishInitiative).mock.calls.length;
    await vi.advanceTimersByTimeAsync(2_000);
    h.publisher.changed();
    await flush();
    expect(h.session.publishInitiative).toHaveBeenCalledTimes(sends + 1);
    expect(h.acknowledge).toHaveBeenLastCalledWith([
      { runId: 'run-a', combatGeneration: 3, intent: 'publish' },
    ]);
  });
});
