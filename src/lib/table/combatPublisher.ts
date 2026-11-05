import type { SharedInitiativeState } from '@/types/sharedState';

import type { TableControlOutcome } from './authorityLifecycle';
import type { TableRunPublicationV1 } from './schema';

/**
 * Scene combat publisher (D8, R2-5, R2-7, C3-7, C3-8, C3-9).
 *
 * The lease-holding Table tab publishes `campaign.activeRunId`'s run through
 * the page's single control session. It is deliberately free of runtime
 * imports so the real-Redis integration script can drive it unchanged.
 *
 * Holding: after any (re)acquire or a Not-broadcasting failure the publisher
 * "holds" the intent it saw at that moment; nothing is published until the
 * DM explicitly publishes current state, except a NEW start/end intent that
 * appears afterwards (e.g. committed by another tab). A lost lease publishes
 * nothing at all.
 */

export interface PublicationRunState {
  /** `campaign.activeRunId`'s run, only while it is running here. */
  active: {
    runId: string;
    combatGeneration: number;
    publication: TableRunPublicationV1 | null;
  } | null;
  /** Every run whose end intent is not yet acknowledged. */
  pendingEnds: Array<{ runId: string; combatGeneration: number }>;
}

export interface PublisherSession {
  isLost(): boolean;
  lostReason?(): string | null;
  publishInitiative(
    runId: string,
    initiative: SharedInitiativeState
  ): Promise<TableControlOutcome>;
  endInitiative(): Promise<TableControlOutcome>;
}

export type PublicationPayload =
  | { status: 'ok'; initiative: SharedInitiativeState }
  | { status: 'invalid-identity' }
  /** A player participant has no live data yet: hold, send nothing. */
  | { status: 'waiting-player-data' }
  | { status: 'not-running' };

export interface PublicationAck {
  runId: string;
  combatGeneration: number;
  intent: 'publish' | 'end';
}

export type PublicationStatus =
  | { kind: 'saved-locally' }
  | { kind: 'broadcasting'; runId: string }
  /** Acquire wiped the public initiative: "Publish current state". */
  | { kind: 'cleared' }
  | {
      kind: 'not-broadcasting';
      reason: string;
      /** A start intent not yet published: "Started locally · not broadcasting". */
      pending: 'publish' | null;
    }
  /** An end intent not yet published: "Remote initiative may be stale". */
  | { kind: 'stale'; reason: string | null }
  | { kind: 'blocked'; reason: 'invalid-identity' | 'too-large' }
  /** Publication held until required player data loads (no request sent). */
  | { kind: 'waiting'; reason: 'player-data' }
  | { kind: 'publishing' };

export interface CombatPublisher {
  /** Repository or read-model change (any tab): maybe publish. */
  changed(): void;
  /** Explicit "Publish current state" / Retry. */
  publishCurrentState(): Promise<void>;
  /** After a (re)acquire: hold everything currently pending. */
  hold(): void;
  status(): PublicationStatus;
  dispose(): void;
}

const MIN_PUBLISH_INTERVAL_MS = 1_000;

function intentKey(state: PublicationRunState): string | null {
  const publication = state.active?.publication;
  if (
    state.active &&
    publication &&
    !publication.acknowledged &&
    publication.intent === 'publish' &&
    publication.combatGeneration === state.active.combatGeneration
  )
    return `publish:${state.active.runId}:${state.active.combatGeneration}`;
  if (state.pendingEnds.length > 0)
    return `end:${state.pendingEnds
      .map(end => `${end.runId}:${end.combatGeneration}`)
      .sort()
      .join(',')}`;
  return null;
}

function pendingPublish(state: PublicationRunState): boolean {
  const publication = state.active?.publication;
  return Boolean(
    publication &&
      !publication.acknowledged &&
      publication.intent === 'publish' &&
      publication.combatGeneration === state.active?.combatGeneration
  );
}

export function createCombatPublisher(options: {
  getSession: () => PublisherSession | null;
  readState: () => PublicationRunState;
  buildPayload: (runId: string) => PublicationPayload;
  acknowledge: (targets: PublicationAck[]) => Promise<boolean>;
  onStatus: (status: PublicationStatus) => void;
  now?: () => number;
}): CombatPublisher {
  const now = options.now ?? (() => Date.now());
  let held = true;
  let holdKey: string | null = null;
  let broadcasting = false;
  let lastPublishAt = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let dirty = false;
  let disposed = false;
  let failure: string | null = null;
  let blocked: 'invalid-identity' | 'too-large' | null = null;
  /** A publish is wanted but required player data has not loaded (F1). */
  let awaitingData = false;
  /**
   * Run generation + canonical payload last sent (F6): an automatic publish
   * of the same public state is skipped. Explicit publishes and pending
   * start intents (ack still owed) always send; `hold()` (every reacquire)
   * resets it, because the server cleared what was sent before (R03-1).
   */
  let lastSentKey: string | null = null;
  const canonical = (initiative: SharedInitiativeState) => {
    const { updatedAt: _ignored, ...rest } = initiative;
    void _ignored;
    return JSON.stringify(rest);
  };
  let current: PublicationStatus = { kind: 'saved-locally' };
  /** End intents already cleared remotely whose local ack may still lag. */
  const clearedEnds = new Set<string>();
  const endKey = (end: { runId: string; combatGeneration: number }) =>
    `${end.runId}:${end.combatGeneration}`;
  const read = (): PublicationRunState => {
    const state = options.readState();
    return {
      ...state,
      pendingEnds: state.pendingEnds.filter(
        end => !clearedEnds.has(endKey(end))
      ),
    };
  };

  const emit = (status: PublicationStatus) => {
    current = status;
    if (!disposed) options.onStatus(status);
  };

  const describe = (state: PublicationRunState): PublicationStatus => {
    const session = options.getSession();
    const pending = pendingPublish(state) ? ('publish' as const) : null;
    const lostReason = !session
      ? 'no-control'
      : session.isLost()
        ? (session.lostReason?.() ?? 'lease-lost')
        : null;
    if (lostReason !== null) {
      // Without the lease nothing is broadcast by this tab (former
      // controllers included); local combat stays fully usable.
      return state.active || state.pendingEnds.length > 0
        ? { kind: 'not-broadcasting', reason: lostReason, pending }
        : { kind: 'saved-locally' };
    }
    if (blocked) return { kind: 'blocked', reason: blocked };
    if (awaitingData && state.active)
      return { kind: 'waiting', reason: 'player-data' };
    if (state.active) {
      if (broadcasting && !held)
        return { kind: 'broadcasting', runId: state.active.runId };
      if (pending || failure)
        return {
          kind: 'not-broadcasting',
          reason: failure ?? 'not-published',
          pending,
        };
      return { kind: 'cleared' };
    }
    if (state.pendingEnds.length > 0) return { kind: 'stale', reason: failure };
    return { kind: 'saved-locally' };
  };

  const holdNow = (state: PublicationRunState) => {
    held = true;
    awaitingData = false;
    holdKey = intentKey(state);
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const sendEnd = async (state: PublicationRunState): Promise<void> => {
    const session = options.getSession();
    if (!session || session.isLost()) {
      emit(describe(state));
      return;
    }
    emit({ kind: 'publishing' });
    const outcome = await session.endInitiative();
    const fresh = read();
    if (outcome.status === 'committed') {
      broadcasting = false;
      failure = null;
      held = false;
      for (const end of fresh.pendingEnds) clearedEnds.add(endKey(end));
      const targets = fresh.pendingEnds.map(end => ({
        runId: end.runId,
        combatGeneration: end.combatGeneration,
        intent: 'end' as const,
      }));
      if (targets.length > 0) await options.acknowledge(targets);
      emit(describe(read()));
      return;
    }
    failure = outcome.reason;
    broadcasting = false;
    holdNow(fresh);
    emit({ kind: 'stale', reason: outcome.reason });
  };

  const sendPublish = async (
    state: PublicationRunState,
    explicit: boolean
  ): Promise<void> => {
    const session = options.getSession();
    const active = state.active;
    if (!active) return;
    if (!session || session.isLost()) {
      broadcasting = false;
      emit(describe(state));
      return;
    }
    const payload = options.buildPayload(active.runId);
    if (payload.status === 'invalid-identity') {
      blocked = 'invalid-identity';
      broadcasting = false;
      holdNow(state);
      emit({ kind: 'blocked', reason: 'invalid-identity' });
      return;
    }
    if (payload.status === 'waiting-player-data') {
      awaitingData = true;
      emit({ kind: 'waiting', reason: 'player-data' });
      return;
    }
    if (payload.status !== 'ok') return;
    awaitingData = false;
    const sentKey = `${active.runId}:${active.combatGeneration}:${canonical(payload.initiative)}`;
    if (!explicit && !pendingPublish(state) && lastSentKey === sentKey) {
      emit({ kind: 'broadcasting', runId: active.runId });
      return;
    }
    emit({ kind: 'publishing' });
    lastPublishAt = now();
    const outcome = await session.publishInitiative(
      active.runId,
      payload.initiative
    );
    if (outcome.status === 'committed') {
      broadcasting = true;
      held = false;
      lastSentKey = sentKey;
      failure = null;
      blocked = null;
      const publication = active.publication;
      if (
        publication &&
        !publication.acknowledged &&
        publication.intent === 'publish' &&
        publication.combatGeneration === active.combatGeneration
      ) {
        await options.acknowledge([
          {
            runId: active.runId,
            combatGeneration: active.combatGeneration,
            intent: 'publish',
          },
        ]);
      }
      emit({ kind: 'broadcasting', runId: active.runId });
      return;
    }
    broadcasting = false;
    if (outcome.status === 'failed' && outcome.reason === 'too-large') {
      blocked = 'too-large';
      holdNow(state);
      emit({ kind: 'blocked', reason: 'too-large' });
      return;
    }
    failure = outcome.reason;
    holdNow(read());
    emit(describe(read()));
  };

  const perform = async (explicit: boolean): Promise<void> => {
    const state = read();
    if (explicit) {
      held = false;
      blocked = null;
    }
    if (state.active) return sendPublish(state, explicit);
    if (state.pendingEnds.length > 0) return sendEnd(state);
    if (broadcasting) broadcasting = false;
    emit(describe(state));
  };

  const drain = (explicit: boolean): Promise<void> => {
    if (inFlight) {
      dirty = true;
      return inFlight;
    }
    inFlight = perform(explicit)
      .catch(() => {
        failure = 'unexpected';
      })
      .finally(() => {
        inFlight = null;
        if (dirty && !disposed) {
          dirty = false;
          changed();
        }
      });
    return inFlight;
  };

  const changed = () => {
    if (disposed) return;
    const lagging = options
      .readState()
      .pendingEnds.filter(end => clearedEnds.has(endKey(end)));
    if (lagging.length > 0 && !inFlight)
      // Remote already cleared; only the idempotent local ack is retried.
      void options.acknowledge(
        lagging.map(end => ({ ...end, intent: 'end' as const }))
      );
    const state = read();
    const key = intentKey(state);
    const session = options.getSession();
    if (!session || session.isLost()) {
      emit(describe(state));
      return;
    }
    if (held && key !== null && key !== holdKey) {
      // A new start/end intent this tab was never told to hold (C3-8).
      held = false;
      failure = null;
      blocked = null;
    }
    if (held) {
      emit(describe(state));
      return;
    }
    if (!state.active) {
      if (state.pendingEnds.length > 0) void drain(false);
      else {
        broadcasting = false;
        emit(describe(state));
      }
      return;
    }
    if (!broadcasting && !pendingPublish(state) && !awaitingData) {
      emit(describe(state));
      return;
    }
    const wait = lastPublishAt + MIN_PUBLISH_INTERVAL_MS - now();
    if (pendingPublish(state) || awaitingData || wait <= 0) {
      if (timer) clearTimeout(timer);
      timer = null;
      void drain(false);
      return;
    }
    if (!timer)
      timer = setTimeout(() => {
        timer = null;
        changed();
      }, wait);
  };

  return {
    changed,
    publishCurrentState: async () => {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      timer = null;
      if (inFlight) await inFlight;
      const session = options.getSession();
      const state = read();
      if (!session || session.isLost()) {
        emit(describe(state));
        return;
      }
      await drain(true);
    },
    hold: () => {
      const state = read();
      broadcasting = false;
      // R03-1: a (re)acquire wiped the public initiative, so nothing sent
      // before it may dedupe a later (even non-explicit) publish.
      lastSentKey = null;
      failure = null;
      blocked = null;
      holdNow(state);
      emit(describe(state));
    },
    status: () => current,
    dispose: () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
