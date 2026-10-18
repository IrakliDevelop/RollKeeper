'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import {
  planCombatCommand,
  runCombatCommand,
  type TableCombatCommandV1,
  type TableCombatResult,
} from '@/lib/table/combat';
import { buildCombatReadModel } from '@/lib/table/combatReadModel';
import type { TableRepository } from '@/lib/table/repository';
import type { TableWorkspaceSnapshotV1 } from '@/lib/table/schema';

import { useTablePlayersSnapshot } from '../useTablePlayersSnapshot';
import { combatFailureMessage } from './tableCombatMessages';

export interface TableCombatNotice {
  tone: 'info' | 'success' | 'error';
  message: string;
  retry?: () => void;
  /** Recovery link (e.g. the Table bundle export on Battle Maps). */
  link?: { href: string; label: string };
}

/** Builds the command when it runs (fresh `at`); retries re-plan the intent. */
export type TableCombatIntent = () => TableCombatCommandV1;

const PLAYER_POLL_MS = 10_000;

/** A user intent that failed with no later action started since. */
interface UnsavedChange {
  intent: TableCombatIntent;
  label: string;
  result: TableCombatResult;
  /** Another intent committed after this failure: a replay may be stale. */
  superseded?: boolean;
}

/** Storage and conflict failures may pass on a second try; rejections won't. */
const retryable = (result: TableCombatResult) =>
  result.status === 'failed' || result.status === 'conflict';

function sceneRunsOf(
  snapshot: TableWorkspaceSnapshotV1 | null,
  sceneId: string
) {
  if (!snapshot) return [];
  const deleted = new Set(
    snapshot.tombstones
      .filter(tombstone => tombstone.kind === 'encounter')
      .map(tombstone => tombstone.id)
  );
  return snapshot.encounters
    .filter(run => run.sceneId === sceneId && !deleted.has(run.runId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/**
 * Turn and lifecycle steps run one at a time: a second click while one is
 * saving is refused visibly (a double click must not advance two turns).
 */
const ONE_AT_A_TIME = new Set<TableCombatCommandV1['type']>([
  'combat.start',
  'combat.end',
  'combat.nextTurn',
  'combat.prevTurn',
  'combat.createRun',
  'combat.deleteArchive',
]);

/**
 * After a successful Show, a start that did not commit. The scene did
 * change, so the storage messages' "Nothing was saved/changed" is dropped.
 */
function shownButNotStarted(result: TableCombatResult): string {
  const reason = combatFailureMessage(result).replace(
    / Nothing was (saved|changed)\.$/u,
    ''
  );
  return `Scene is now shown; combat did not start: ${reason}`;
}

const STILL_SAVING = 'Still saving the last change. Try again in a moment.';

/**
 * Repository-backed scene combat state for the Table route: selected run,
 * read model and ONE serialized command queue. User intents that set a
 * value (hide, initiative, HP, conditions, participants, selection) queue
 * in order behind a pending one, so a quick blur-commit followed by a click
 * applies both (PR08 desktop B3). Turn and lifecycle steps are refused while
 * one is saving ("Still saving…", cleared by the next success).
 *
 * Unsaved record: each user intent carries a short label ("Orc initiative").
 * A failure joins the record; the next action the DM starts (Retry
 * included) clears it, because the DM is now acting on the current state.
 * Intents queued before the failure do not clear it, but once any intent
 * commits after it the entry stays named without Retry (state moved on).
 * One storage or conflict failure (a thrown write counts) with no later
 * commit offers a one-shot Retry of that intent while nothing is saving; a
 * rejection never does;
 * two or more failures are named with no Retry and the DM redoes them. Old
 * intents are never batch-replayed. One-off notices (Still saving, notify,
 * Show + Start outcomes) show alongside the record. Background commands
 * (acknowledgements, prunes) wait their turn; nothing auto-replans.
 */
export function useTableCombat(options: {
  repository: TableRepository;
  sceneId: string;
  campaignCode: string;
  requestedRunId: string | null;
}) {
  const { repository, sceneId } = options;
  const [tick, onRepository] = useReducer((n: number) => n + 1, 0);
  useEffect(() => repository.subscribe(onRepository), [repository]);
  const current = repository.getCurrent();
  const snapshot = current?.status === 'ready' ? current.snapshot : null;
  const campaign = snapshot?.campaign ?? null;
  const runs = useMemo(
    () => sceneRunsOf(snapshot, sceneId),
    // tick: the repository reloads in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, sceneId, tick]
  );
  const inScene = (runId: string | null | undefined) =>
    runId ? runs.some(run => run.runId === runId) : false;
  const selectedRunId = inScene(campaign?.selectedRunId)
    ? campaign!.selectedRunId
    : inScene(campaign?.activeRunId)
      ? campaign!.activeRunId
      : null;
  const selectedRun = runs.find(run => run.runId === selectedRunId) ?? null;
  const running = Boolean(
    selectedRun?.isActive && campaign?.activeRunId === selectedRun.runId
  );

  const players = useTablePlayersSnapshot(options.campaignCode, {
    pollMs: running ? PLAYER_POLL_MS : null,
    refreshKey: running
      ? `${selectedRun?.round}:${selectedRun?.currentActorId}`
      : undefined,
  });
  const playerData =
    players.snapshot.status === 'ready' ? players.snapshot.data : undefined;
  const model = useMemo(
    () =>
      snapshot && selectedRunId
        ? buildCombatReadModel({
            snapshot,
            runId: selectedRunId,
            players: playerData,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, selectedRunId, playerData, tick]
  );

  const [saving, setSaving] = useState(false);
  /** One-off notices (info, Show + Start outcomes), shown beside `unsaved`. */
  const [transient, setTransient] = useState<TableCombatNotice | null>(null);
  const transientTone = useRef<TableCombatNotice['tone'] | null>(null);
  /** The one-off notice is the "Still saving" refusal (a commit ends it). */
  const stillSaving = useRef(false);
  const setNotice = useCallback((value: TableCombatNotice | null) => {
    transientTone.current = value?.tone ?? null;
    stillSaving.current = false;
    setTransient(value);
  }, []);
  /** A refused click explained (e.g. "Not available here"); kept on commit. */
  const notify = useCallback(
    (message: string) => setNotice({ tone: 'info', message }),
    [setNotice]
  );
  /** Any success clears the "Still saving" refusal, and only that. */
  const clearStillSaving = useCallback(() => {
    if (!stillSaving.current) return;
    stillSaving.current = false;
    transientTone.current = null;
    setTransient(null);
  }, []);
  /** Failures with no later action started since, oldest first. */
  const unsaved = useRef<UnsavedChange[]>([]);
  const [unsavedVersion, bumpUnsaved] = useReducer((n: number) => n + 1, 0);
  /** Synchronous guard: one Retry press replays once. */
  const retried = useRef<UnsavedChange | null>(null);
  const clearUnsaved = useCallback(() => {
    if (unsaved.current.length === 0) return;
    unsaved.current = [];
    bumpUnsaved();
  }, []);
  /** State moved on: listed failures stay named but lose their Retry. */
  const markSuperseded = useCallback(() => {
    const live = unsaved.current.filter(item => !item.superseded);
    if (live.length === 0) return;
    unsaved.current = unsaved.current.map(item => ({
      ...item,
      superseded: true,
    }));
    bumpUnsaved();
  }, []);
  const recordFailure = useCallback(
    (intent: TableCombatIntent, label: string, result: TableCombatResult) => {
      unsaved.current = [...unsaved.current, { intent, label, result }];
      bumpUnsaved();
    },
    []
  );
  /** User intents queued or running. */
  const pending = useRef(0);
  const begin = useCallback(() => {
    pending.current += 1;
    setSaving(true);
  }, []);
  const finish = useCallback(() => {
    pending.current -= 1;
    if (pending.current === 0) setSaving(false);
  }, []);
  const refuse = useCallback(() => {
    setNotice({ tone: 'info', message: STILL_SAVING });
    stillSaving.current = true;
    return Promise.resolve(null);
  }, [setNotice]);
  /** Serializes user intents and background commands (acks, prunes). */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const run = useCallback(
    async (intent: TableCombatIntent): Promise<TableCombatResult> => {
      const latest = repository.getCurrent();
      const expectedRevision =
        latest?.status === 'ready'
          ? (latest.snapshot.campaign?.revision ?? 0)
          : 0;
      return runCombatCommand(repository, {
        expectedRevision,
        operationId: crypto.randomUUID(),
        command: intent(),
      });
    },
    [repository]
  );

  /** Runs one user intent on the queue; a failure joins `unsaved`. */
  const enqueue = useCallback(
    (intent: TableCombatIntent, label: string): Promise<TableCombatResult> => {
      begin();
      const task = queue.current.then(async () => {
        try {
          // A throw (repository error) is a storage failure, listed too.
          const result: TableCombatResult = await run(intent).catch(
            () => ({ status: 'failed', reason: 'transaction-failed' }) as const
          );
          if (result.status === 'committed' || result.status === 'unchanged') {
            clearStillSaving();
            markSuperseded();
          } else {
            if (result.status === 'conflict') await repository.reload();
            recordFailure(intent, label, result);
          }
          return result;
        } finally {
          finish();
        }
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [
      repository,
      run,
      begin,
      finish,
      recordFailure,
      clearStillSaving,
      markSuperseded,
    ]
  );

  /** Starts a user intent now, or null when refused (nothing started). */
  const startIntent = useCallback(
    (
      intent: TableCombatIntent,
      label: string
    ): Promise<TableCombatResult> | null => {
      if (pending.current > 0 && ONE_AT_A_TIME.has(intent().type)) {
        void refuse();
        return null;
      }
      // The DM acts on the current state: older failures and their Retry go.
      clearUnsaved();
      // A new action supersedes a one-off notice: "Saving…" shows instead.
      if (transientTone.current !== null) setNotice(null);
      return enqueue(intent, label);
    },
    [refuse, clearUnsaved, enqueue, setNotice]
  );

  const execute = useCallback(
    (
      intent: TableCombatIntent,
      label: string
    ): Promise<TableCombatResult | null> =>
      startIntent(intent, label) ?? Promise.resolve(null),
    [startIntent]
  );

  const unsavedNotice = useMemo((): TableCombatNotice | null => {
    const items = unsaved.current;
    if (items.length === 0) return null;
    const latest = items[items.length - 1]!;
    const reason = combatFailureMessage(latest.result);
    const link = items.some(
      item =>
        item.result.status === 'rejected' &&
        item.result.reason === 'invalid-reference'
    )
      ? {
          link: {
            href: `/dm/campaign/${encodeURIComponent(options.campaignCode)}/battlemaps`,
            label: 'Export Table',
          },
        }
      : {};
    if (items.length > 1)
      return {
        tone: 'error',
        message: `These changes weren't saved: ${[...new Set(items.map(item => item.label))].join(', ')}. ${reason}`,
        ...link,
      };
    const retry =
      // Y1: never while an earlier intent still saves (it may set the same
      // field after the failure); the button returns once saving ends.
      retryable(latest.result) && !latest.superseded && !saving
        ? {
            retry: () => {
              // Y2: a captured Retry is dead once its entry left the record.
              if (
                retried.current === latest ||
                !unsaved.current.includes(latest) ||
                latest.superseded ||
                pending.current > 0
              )
                return;
              retried.current = latest;
              if (!startIntent(latest.intent, latest.label))
                retried.current = null;
            },
          }
        : {};
    return {
      tone: 'error',
      message: `${latest.label} wasn't saved. ${reason}`,
      ...retry,
      ...link,
    };
    // unsavedVersion: the record changes in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsavedVersion, startIntent, options.campaignCode, saving]);

  /**
   * PR04 P8 / S2 combined Show + Start, inside the same busy/serialized
   * guard (Q10: no other combat command, background included, runs from this
   * tab meanwhile). (1) plan `combat.start` against the current snapshot and
   * capture its revision R, a refusal sends nothing; (2) re-read the
   * repository right before Show, a changed revision aborts, nothing sent;
   * (3) Show, not published → combat does not start; (4) commit start at R
   * with a fresh operation id, a refusal leaves the scene shown (no rollback
   * of a revealed scene). Both halves are reported in one result.
   */
  const showAndStart = useCallback(
    (
      runId: string,
      show: () => Promise<
        { ok: true } | { ok: false; reason: string; uncertain?: boolean }
      >
    ): Promise<TableCombatResult | null> => {
      if (pending.current > 0) return refuse();
      clearUnsaved();
      begin();
      const task = queue.current.then(async () => {
        // FR5: a throw is never silent; the copy depends on how far it got.
        let phase: 'before-show' | 'showing' | 'shown' = 'before-show';
        try {
          const latest = repository.getCurrent();
          if (latest?.status !== 'ready') {
            setNotice({
              tone: 'error',
              message: 'Table storage is unavailable. Nothing was sent.',
            });
            return null;
          }
          const revision = latest.snapshot.campaign?.revision ?? 0;
          const operationId = crypto.randomUUID();
          const command: TableCombatCommandV1 = {
            type: 'combat.start',
            runId,
            at: new Date().toISOString(),
          };
          const plan = planCombatCommand(latest.snapshot, command, operationId);
          if (plan.status === 'rejected') {
            setNotice({ tone: 'error', message: combatFailureMessage(plan) });
            return plan;
          }
          const reread = await repository.reload();
          if (
            reread.status !== 'ready' ||
            (reread.snapshot.campaign?.revision ?? 0) !== revision
          ) {
            setNotice({
              tone: 'error',
              message: 'The scene just changed. Check it and try again.',
            });
            return null;
          }
          phase = 'showing';
          const shown = await show();
          if (!shown.ok) {
            setNotice({
              tone: 'error',
              message: shown.uncertain
                ? "Couldn't confirm the scene is shown, so combat didn't start. Check what players see."
                : `Scene not shown (${shown.reason}), so combat didn't start.`,
            });
            return null;
          }
          phase = 'shown';
          const result: TableCombatResult = await runCombatCommand(repository, {
            expectedRevision: revision,
            operationId,
            command,
          }).catch(
            () => ({ status: 'failed', reason: 'transaction-failed' }) as const
          );
          if (result.status === 'committed') {
            setNotice({
              tone: 'success',
              message: 'Scene shown and combat started',
            });
          } else {
            if (result.status === 'conflict') await repository.reload();
            setNotice({
              tone: 'error',
              message: shownButNotStarted(result),
            });
          }
          return result;
        } catch {
          if (phase === 'shown') {
            // CC5: the scene is shown; report a failed start consistently.
            const failed = {
              status: 'failed',
              reason: 'transaction-failed',
            } as const;
            setNotice({ tone: 'error', message: shownButNotStarted(failed) });
            return failed;
          }
          setNotice({
            tone: 'error',
            message:
              phase === 'before-show'
                ? "Couldn't start combat. Nothing was sent."
                : "Couldn't confirm the scene is shown, so combat didn't start. Check what players see.",
          });
          return null;
        } finally {
          finish();
        }
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [repository, refuse, clearUnsaved, begin, finish, setNotice]
  );

  /** Background commands (acks, prunes, URL selection): queued, not refused. */
  const background = useCallback(
    (intent: TableCombatIntent): Promise<TableCombatResult> => {
      // Not a user intent: it never refuses or blocks the DM; a user intent
      // simply runs after it with the then-current revision.
      const task = queue.current.then(async () => {
        let result = await run(intent);
        if (result.status === 'conflict') {
          await repository.reload();
          result = await run(intent);
        }
        return result;
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [repository, run]
  );

  // `?run=` from "Open scene run": select it once (explicit user intent).
  const requested = useRef<string | null>(null);
  useEffect(() => {
    const target = options.requestedRunId;
    if (!target || requested.current === target || !snapshot) return;
    if (!inScene(target)) return;
    requested.current = target;
    if (campaign?.selectedRunId === target) return;
    void background(() => ({
      type: 'combat.selectRun',
      runId: target,
      at: new Date().toISOString(),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.requestedRunId, snapshot, background]);

  // C3-5 / A-4: persist the prune when the player no longer has a name.
  const pruned = useRef(new Set<string>());
  useEffect(() => {
    for (const view of model?.participants ?? []) {
      if (view.staleSuppressions.length === 0 || !view.playerConditionNames)
        continue;
      const key = `${view.actorId}:${view.staleSuppressions.join(',')}`;
      if (pruned.current.has(key)) continue;
      pruned.current.add(key);
      const names = [...view.playerConditionNames];
      void background(() => ({
        type: 'combat.pruneSuppressions',
        actorId: view.actorId,
        playerConditionNames: names,
        at: new Date().toISOString(),
      }));
    }
  }, [model, background]);

  return {
    snapshot,
    campaign,
    runs,
    selectedRun,
    running,
    model,
    players,
    playerData,
    tick,
    saving,
    notice: transient,
    unsavedNotice,
    setNotice,
    notify,
    execute,
    background,
    showAndStart,
  };
}
