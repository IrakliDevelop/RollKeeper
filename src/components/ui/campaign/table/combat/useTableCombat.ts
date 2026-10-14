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

/** A user intent that failed and is waiting for Retry. */
interface FailedIntent {
  intent: TableCombatIntent;
  message: string;
  link?: TableCombatNotice['link'];
}

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

const STILL_SAVING = 'Still saving the last change. Try again in a moment.';

/**
 * Repository-backed scene combat state for the Table route: selected run,
 * read model and ONE serialized command queue. User intents that set a
 * value (hide, initiative, HP, conditions, participants, selection) queue
 * in order behind a pending one, so a quick blur-commit followed by a click
 * applies both (PR08 desktop B3). Turn and lifecycle steps are refused while
 * one is saving ("Still saving…", cleared by the next success).
 *
 * Failed user intents are kept in order as "not saved" changes. While any
 * remain, the notice is one error naming how many, with a single Retry that
 * replays all of them in order through the queue (each re-plans on current
 * state, so delta edits stay safe). Only a successful replay removes one;
 * other successes never do. Info and one-off notices never hide that error.
 * Background commands (acknowledgements, prunes) wait their turn; nothing
 * auto-replans.
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
  /** One-off notices (info, Show + Start outcomes); never hides `failed`. */
  const [transient, setTransient] = useState<TableCombatNotice | null>(null);
  const transientTone = useRef<TableCombatNotice['tone'] | null>(null);
  const setNotice = useCallback((value: TableCombatNotice | null) => {
    transientTone.current = value?.tone ?? null;
    setTransient(value);
  }, []);
  /** Any success clears a passing info notice such as "Still saving". */
  const clearInfo = useCallback(() => {
    if (transientTone.current !== 'info') return;
    transientTone.current = null;
    setTransient(null);
  }, []);
  /** Failed user intents, oldest first (not-yet-saved changes). */
  const failed = useRef<FailedIntent[]>([]);
  const [failedVersion, bumpFailed] = useReducer((n: number) => n + 1, 0);
  /** A Retry replay is running: its button is hidden (single flight). */
  const replaying = useRef(false);
  const recordFailure = useCallback(
    (intent: TableCombatIntent, result: TableCombatResult) => {
      const entry: FailedIntent = {
        intent,
        message: combatFailureMessage(result),
        link:
          result.status === 'rejected' && result.reason === 'invalid-reference'
            ? {
                href: `/dm/campaign/${encodeURIComponent(options.campaignCode)}/battlemaps`,
                label: 'Export Table',
              }
            : undefined,
      };
      const index = failed.current.findIndex(item => item.intent === intent);
      if (index >= 0) failed.current[index] = entry;
      else failed.current.push(entry);
      bumpFailed();
    },
    [options.campaignCode]
  );
  const recordSuccess = useCallback((intent: TableCombatIntent) => {
    const before = failed.current.length;
    failed.current = failed.current.filter(item => item.intent !== intent);
    if (failed.current.length !== before) bumpFailed();
  }, []);
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

  /** Runs one user intent on the queue; failures join `failed`. */
  const enqueue = useCallback(
    (intent: TableCombatIntent): Promise<TableCombatResult> => {
      begin();
      const task = queue.current.then(async () => {
        try {
          const result = await run(intent);
          if (result.status === 'committed' || result.status === 'unchanged') {
            recordSuccess(intent);
            clearInfo();
          } else {
            if (result.status === 'conflict') await repository.reload();
            recordFailure(intent, result);
          }
          return result;
        } finally {
          finish();
        }
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [repository, run, begin, finish, recordSuccess, recordFailure, clearInfo]
  );

  const execute = useCallback(
    (intent: TableCombatIntent): Promise<TableCombatResult | null> => {
      if (pending.current > 0 && ONE_AT_A_TIME.has(intent().type))
        return refuse();
      // A new action supersedes a one-off notice: "Saving…" shows instead.
      if (transientTone.current !== null) setNotice(null);
      return enqueue(intent);
    },
    [refuse, enqueue, setNotice]
  );

  /** Retry: replays every failed intent in order (one replay at a time). */
  const retryFailed = useCallback(() => {
    if (replaying.current || failed.current.length === 0) return;
    replaying.current = true;
    bumpFailed();
    const replay = failed.current.map(item => enqueue(item.intent));
    void Promise.allSettled(replay).then(() => {
      replaying.current = false;
      bumpFailed();
    });
  }, [enqueue]);

  const failedNotice = useMemo((): TableCombatNotice | null => {
    const items = failed.current;
    if (items.length === 0) return null;
    const latest = items[items.length - 1]!;
    const message =
      items.length === 1
        ? `1 change wasn't saved. ${latest.message}`
        : `${items.length} changes weren't saved. ${latest.message} Retry saves them in order.`;
    return {
      tone: 'error',
      message,
      ...(replaying.current ? {} : { retry: retryFailed }),
      ...(items.find(item => item.link)?.link
        ? { link: items.find(item => item.link)!.link }
        : {}),
    };
    // failedVersion: the list and the replay flag change in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedVersion, retryFailed]);
  const notice = failedNotice ?? transient;

  /**
   * PR04 P8 / S2 combined Show + Start, inside the same busy/serialized
   * guard (Q10: no other combat command, background included, runs from this
   * tab meanwhile). (1) plan `combat.start` against the current snapshot and
   * capture its revision R — a refusal sends nothing; (2) re-read the
   * repository right before Show — a changed revision aborts, nothing sent;
   * (3) Show — not published → combat does not start; (4) commit start at R
   * with a fresh operation id — a refusal leaves the scene shown (no rollback
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
      begin();
      const task = queue.current.then(async () => {
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
          const result = await runCombatCommand(repository, {
            expectedRevision: revision,
            operationId,
            command,
          });
          if (result.status === 'committed') {
            setNotice({
              tone: 'success',
              message: 'Scene shown and combat started',
            });
          } else {
            if (result.status === 'conflict') await repository.reload();
            setNotice({
              tone: 'error',
              message: `Scene is now shown; combat did not start: ${combatFailureMessage(result)}`,
            });
          }
          return result;
        } finally {
          finish();
        }
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [repository, refuse, begin, finish, setNotice]
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
    notice,
    setNotice,
    execute,
    background,
    showAndStart,
  };
}
