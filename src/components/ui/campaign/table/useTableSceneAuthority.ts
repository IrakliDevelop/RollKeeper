'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  getTableAuthoritySessionId,
  prepareTableSceneAuthority,
  type TableControlSession,
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
      setControlEpoch(value => value + 1);
      if (attempt > 0) setExplicitAcquired(value => value + 1);
      timer = setInterval(() => {
        void session.renew().then(outcome => {
          if (cancelled || outcome.status !== 'lost') return;
          if (timer) clearInterval(timer);
          const descriptor = session.current();
          const foreign =
            descriptor.holderSessionId !== session.holderSessionId &&
            descriptor.leaseUntil > Date.now();
          setState({
            phase: 'lost',
            reason: outcome.reason,
            leaseUntil: foreign ? descriptor.leaseUntil : null,
            foreignHolder: foreign,
          });
        });
      }, RENEW_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
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
    waitSeconds: waiting ? Math.ceil((leaseUntil! - now) / 1_000) : 0,
    acquire,
    workOffline: () => setState({ phase: 'offline' }),
  };
}
