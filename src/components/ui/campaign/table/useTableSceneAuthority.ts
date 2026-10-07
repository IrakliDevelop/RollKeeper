'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  getTableAuthoritySessionId,
  prepareTableSceneAuthority,
  type TableControlSession,
  type TableDescriptor,
} from '@/lib/table/authorityLifecycle';
import { sceneCheckpointToViewportState } from '@/lib/table/checkpoint';
import type { TableRepository } from '@/lib/table/repository';
import type { TableSceneAdapter } from '@/lib/table/sceneAdapter';

const RENEW_MS = 10_000;

export type TableAuthorityState =
  | { phase: 'idle' }
  | { phase: 'initializing' }
  | { phase: 'ready'; session: TableControlSession }
  | {
      phase: 'failed' | 'lost';
      reason: string;
      leaseUntil: number | null;
      foreignHolder: boolean;
    }
  | { phase: 'offline' };

/**
 * Table page live-control lifecycle (D8, R2-3, C3-7). The first prepare
 * gates canvas mounting; afterwards the canvas and combat stay mounted
 * whatever happens to control. Losing the lease never re-acquires or takes
 * over; "Acquire live control" is explicit and non-forcing. The session id
 * is per page load (module-global), never persisted.
 */
export function useTableSceneAuthority(options: {
  repository: TableRepository | null;
  adapter: TableSceneAdapter | null;
  campaignCode: string;
  dmId: string;
  sceneId: string;
}) {
  const { repository, adapter, campaignCode, dmId, sceneId } = options;
  const [state, setState] = useState<TableAuthorityState>({ phase: 'idle' });
  const [firstOutcome, setFirstOutcome] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** Increments on every successful (re)acquire: publication must hold. */
  const [controlEpoch, setControlEpoch] = useState(0);
  const [explicitAcquired, setExplicitAcquired] = useState(0);
  /** Latest descriptor of the page session (presentation status, P4). */
  const [descriptor, setDescriptor] = useState<TableDescriptor | null>(null);

  useEffect(() => {
    if (!repository || !adapter) {
      setState({ phase: 'idle' });
      return;
    }
    const current = repository.getCurrent();
    if (current?.status !== 'ready') return;
    const scene = current.snapshot.scenes.find(
      value => value.sceneId === sceneId
    );
    if (!scene) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;
    setState({ phase: 'initializing' });
    void prepareTableSceneAuthority({
      campaignCode,
      dmId,
      sceneId,
      sourceMapId: scene.originalMapId ?? sceneId,
      workspaceInstanceId:
        repository.workspaceSelection.workspace.localWorkspaceId,
      contentRevision: current.snapshot.campaign?.revision ?? 0,
      safeLabel: scene.map.name,
      canvasState: scene.canvasCheckpoint
        ? sceneCheckpointToViewportState(scene.canvasCheckpoint)
        : {},
      holderSessionId: getTableAuthoritySessionId(),
    }).then(result => {
      if (cancelled) return;
      setFirstOutcome(true);
      if (result.status === 'failed') {
        setState({
          phase: 'failed',
          reason: result.reason,
          leaseUntil: result.leaseUntil ?? null,
          foreignHolder: result.reason === 'controller-active',
        });
        return;
      }
      const session = result.session;
      setState({ phase: 'ready', session });
      setDescriptor(session.current());
      setControlEpoch(value => value + 1);
      if (attempt > 0) setExplicitAcquired(value => value + 1);
      // P3.5: a lost result or descriptor change from ANY command (renew,
      // publish, show, …) updates the banner and status immediately.
      const markLost = (reason: string) => {
        if (timer) clearInterval(timer);
        timer = null;
        const current = session.current();
        const foreign =
          current.holderSessionId !== session.holderSessionId &&
          current.leaseUntil > Date.now();
        setState({
          phase: 'lost',
          reason,
          leaseUntil: foreign ? current.leaseUntil : null,
          foreignHolder: foreign,
        });
      };
      unsubscribe = session.subscribe(() => {
        if (cancelled) return;
        setDescriptor(session.current());
        if (session.isLost()) markLost(session.lostReason() ?? 'conflict');
      });
      timer = setInterval(() => {
        void session.renew().then(outcome => {
          if (cancelled || outcome.status !== 'lost') return;
          markLost(outcome.reason);
        });
      }, RENEW_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      unsubscribe?.();
    };
    // `attempt` is the explicit re-acquire trigger.
  }, [adapter, attempt, campaignCode, dmId, repository, sceneId]);

  // Countdown until an observed foreign lease expires (advisory clock).
  const leaseUntil =
    state.phase === 'failed' || state.phase === 'lost'
      ? state.leaseUntil
      : null;
  const [now, setNow] = useState(() => Date.now());
  const waiting = leaseUntil !== null && leaseUntil > now;
  useEffect(() => {
    if (leaseUntil === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [leaseUntil]);

  const acquire = useCallback(() => {
    setNow(Date.now());
    setAttempt(value => value + 1);
  }, []);

  return {
    state,
    firstOutcome,
    controlEpoch,
    explicitAcquired,
    session: state.phase === 'ready' ? state.session : null,
    descriptor,
    waitSeconds: waiting ? Math.ceil((leaseUntil! - now) / 1_000) : 0,
    acquire,
    workOffline: () => setState({ phase: 'offline' }),
  };
}
