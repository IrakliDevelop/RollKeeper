'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import {
  acquireTableControl,
  getTableAuthoritySessionId,
  prepareTableSceneRoom,
  sceneRoomMessage,
  type TableControlSession,
  type TableDescriptor,
  type TableSceneRoomInput,
  type TableSceneRoomResult,
} from '@/lib/table/authorityLifecycle';
import type { TableRepository } from '@/lib/table/repository';

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

export interface TableSceneRoomState {
  sceneId: string | null;
  /**
   * `registering`: A1b in flight (the canvas waits, Show disabled);
   * `ready`: registered and seeded; `local`: not holding control or A1b
   * refused/failed — the canvas mounts locally (R3-F6).
   */
  status: 'idle' | 'registering' | 'ready' | 'local';
  message: string | null;
}

const identityKey = (scene: TableSceneRoomInput) =>
  JSON.stringify([scene.sceneId, scene.sourceMapId, scene.workspaceInstanceId]);

/**
 * PR06 W3: ONE campaign control session per workspace page (PR03 D8). It
 * acquires once per page (and on an explicit Acquire) — never per scene —
 * and renews every 10 s; `controlEpoch` bumps only on (re)acquire. The
 * selected scene is registered and seeded through that session (A1b) once
 * per (scene, controlEpoch), only while holding control, one prepare at a
 * time; a prepare whose scene is no longer selected when its turn comes is
 * skipped, and a late result never replaces the selected scene's state.
 * Losing control never re-acquires or takes over; the session id is per
 * page load (module-global), never persisted.
 */
export function useTableWorkspaceAuthority(options: {
  repository: TableRepository | null;
  campaignCode: string;
  dmId: string;
  /** The selected scene's registry identity; null = no scene selected. */
  scene: TableSceneRoomInput | null;
}) {
  const { repository, campaignCode, dmId, scene } = options;
  const [state, setState] = useState<TableAuthorityState>({ phase: 'idle' });
  const [firstOutcome, setFirstOutcome] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** Increments on every successful (re)acquire: publication must hold. */
  const [controlEpoch, setControlEpoch] = useState(0);
  const epochCounter = useRef(0);
  /** Explicit acquires whose selected-scene room has settled (C6-2). */
  const [explicitAcquired, setExplicitAcquired] = useState(0);
  const pendingExplicit = useRef<number | null>(null);
  /** Latest descriptor of the page session (presentation status, P4). */
  const [descriptor, setDescriptor] = useState<TableDescriptor | null>(null);

  useEffect(() => {
    if (!repository) {
      setState({ phase: 'idle' });
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;
    const explicit = attempt > 0;
    setState({ phase: 'initializing' });
    void acquireTableControl({
      campaignCode,
      dmId,
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
      epochCounter.current += 1;
      if (explicit) pendingExplicit.current = epochCounter.current;
      setState({ phase: 'ready', session });
      setDescriptor(session.current());
      setControlEpoch(epochCounter.current);
      // P3.5: a lost result or descriptor change from ANY command (renew,
      // register, publish, show, …) updates the banner and status at once.
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
    // `attempt` is the explicit re-acquire trigger; never the scene.
  }, [attempt, campaignCode, dmId, repository]);

  // ─── A1b: per selected scene, once per (scene, controlEpoch) ─────────
  const session = state.phase === 'ready' ? state.session : null;
  const holding = session !== null && !session.isLost();
  const sceneKey = scene ? identityKey(scene) : null;
  const roomKey = sceneKey === null ? null : `${controlEpoch}:${sceneKey}`;
  const latestScene = useRef(scene);
  latestScene.current = scene;
  const selectedRoomKey = useRef(roomKey);
  selectedRoomKey.current = roomKey;
  const results = useRef(new Map<string, TableSceneRoomResult>());
  const started = useRef(new Set<string>());
  const chain = useRef<Promise<void>>(Promise.resolve());
  const [, settled] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    const input = latestScene.current;
    if (!holding || !session || !input || roomKey === null) return;
    if (results.current.has(roomKey) || started.current.has(roomKey)) return;
    started.current.add(roomKey);
    const key = roomKey;
    chain.current = chain.current.then(async () => {
      // One prepare at a time; skip a scene that is no longer selected
      // (A→B→A: B never starts). A reselect queues it again.
      if (selectedRoomKey.current !== key || session.isLost()) {
        started.current.delete(key);
        return;
      }
      const result = await prepareTableSceneRoom(session, input, {
        campaignCode,
        dmId,
      });
      started.current.delete(key);
      results.current.set(key, result);
      settled();
    });
  }, [campaignCode, dmId, holding, roomKey, session]);

  const result = roomKey === null ? undefined : results.current.get(roomKey);
  const room: TableSceneRoomState =
    scene === null
      ? { sceneId: null, status: 'idle', message: null }
      : !holding
        ? { sceneId: scene.sceneId, status: 'local', message: null }
        : !result
          ? { sceneId: scene.sceneId, status: 'registering', message: null }
          : result.status === 'ready'
            ? { sceneId: scene.sceneId, status: 'ready', message: null }
            : {
                sceneId: scene.sceneId,
                status: 'local',
                message: sceneRoomMessage(result),
              };

  // C6-2: after an explicit acquire the canvas re-mints only once A1b has
  // settled for that epoch (register first, then one remount, then live).
  const roomStatus = room.status;
  useEffect(() => {
    const epoch = pendingExplicit.current;
    if (epoch === null || epoch !== controlEpoch) return;
    if (state.phase !== 'ready' || roomStatus === 'registering') return;
    pendingExplicit.current = null;
    setExplicitAcquired(value => value + 1);
  }, [controlEpoch, roomStatus, state.phase]);

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
  const workOffline = useCallback(() => setState({ phase: 'offline' }), []);

  return {
    state,
    firstOutcome,
    controlEpoch,
    explicitAcquired,
    session,
    descriptor,
    room,
    /** R3-F6: Show only for a registered, selected scene while holding. */
    canShow: holding && room.status === 'ready',
    waitSeconds: waiting ? Math.ceil((leaseUntil! - now) / 1_000) : 0,
    acquire,
    workOffline,
  };
}
