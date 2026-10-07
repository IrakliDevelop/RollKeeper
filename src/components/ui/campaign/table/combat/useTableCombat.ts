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
 * Repository-backed scene combat state for the Table route: selected run,
 * read model and ONE serialized command queue. While a command is pending,
 * further user intents are refused with "Saving…" (never queued); background
 * commands (acknowledgements, prunes) wait their turn. A conflict refreshes
 * and offers a deliberate retry of the same intent; nothing auto-replans.
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
  const [notice, setNotice] = useState<TableCombatNotice | null>(null);
  /** A user intent is pending: further user intents are refused. */
  const busy = useRef(false);
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

  const execute = useCallback(
    (intent: TableCombatIntent): Promise<TableCombatResult | null> => {
      if (busy.current) {
        setNotice({ tone: 'info', message: 'Saving…' });
        return Promise.resolve(null);
      }
      busy.current = true;
      setSaving(true);
      const task = queue.current.then(async () => {
        try {
          const result = await run(intent);
          if (result.status === 'committed' || result.status === 'unchanged') {
            setNotice(null);
          } else {
            if (result.status === 'conflict') await repository.reload();
            setNotice({
              tone: 'error',
              message: combatFailureMessage(result),
              // Deliberate retry of the same intent on the newest state.
              retry: () => void execute(intent),
              ...(result.status === 'rejected' &&
              result.reason === 'invalid-reference'
                ? {
                    link: {
                      href: `/dm/campaign/${encodeURIComponent(options.campaignCode)}/battlemaps`,
                      label: 'Export Table bundle',
                    },
                  }
                : {}),
            });
          }
          return result;
        } finally {
          busy.current = false;
          setSaving(false);
        }
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [repository, run, options.campaignCode]
  );

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
      show: () => Promise<{ ok: true } | { ok: false; reason: string }>
    ): Promise<TableCombatResult | null> => {
      if (busy.current) {
        setNotice({ tone: 'info', message: 'Saving…' });
        return Promise.resolve(null);
      }
      busy.current = true;
      setSaving(true);
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
              message: 'Scene changed locally — review and retry',
            });
            return null;
          }
          const shown = await show();
          if (!shown.ok) {
            setNotice({
              tone: 'error',
              message: `Scene not shown — combat did not start: ${shown.reason}`,
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
          busy.current = false;
          setSaving(false);
        }
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [repository]
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
