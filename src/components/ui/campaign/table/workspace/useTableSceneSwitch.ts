'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TableRepository } from '@/lib/table/repository';
import {
  createTableSceneAdapter,
  type TableSceneAdapter,
} from '@/lib/table/sceneAdapter';

/** Bounded flush rounds before a switch gives up as "still saving" (R3-F4). */
const FLUSH_ROUNDS = 5;

export type TableSwitchNotice =
  | { kind: 'conflict'; sceneName: string }
  | { kind: 'saving'; sceneName: string };

export function switchNoticeText(notice: TableSwitchNotice): string {
  return notice.kind === 'conflict'
    ? `Resolve the unsaved change on ${notice.sceneName} before switching`
    : `Still saving ${notice.sceneName}. Try again in a moment.`;
}

/**
 * PR06 W4 / R3-F4 / C6-4: the one scene-switch machine. Every change of the
 * requested scene — click, push, Back/Forward, canonicalization — goes
 * through it: (1) freeze canvas input; (2) flush until the adapter's local
 * edit generation is stable after a flush (bounded); (3) a pending conflict
 * or unstable generation keeps the mounted scene and reverts the URL with a
 * notice; (4) capture the camera; (5) dispose the old adapter and mount the
 * new scene. The mounted scene is tracked apart from the requested one and
 * requests arriving mid-switch are serialized (the latest wins).
 */
export function useTableSceneSwitch(options: {
  repository: TableRepository | null;
  campaignCode: string;
  /** The URL-requested scene, already validated in the workspace. */
  requestedSceneId: string | null;
  sceneName: (sceneId: string) => string;
  /** Replace the URL back to the mounted scene (never a push). */
  onRevert: (sceneId: string | null) => void;
  /** Step 4: remember the outgoing scene's camera before unmount. */
  onBeforeUnmount: (sceneId: string) => void;
  /** Review F9: scene work in flight (Edit-map image) counts as saving. */
  isBusy?: () => boolean;
}) {
  const { repository, campaignCode, requestedSceneId } = options;
  const latest = useRef(options);
  latest.current = options;
  const [mounted, setMounted] = useState<{
    sceneId: string | null;
    adapter: TableSceneAdapter | null;
  }>({ sceneId: null, adapter: null });
  const mountedRef = useRef(mounted);
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState<TableSwitchNotice | null>(null);
  const requested = useRef(requestedSceneId);
  requested.current = requestedSceneId;
  const running = useRef(false);
  /** Bumps on repository change/unmount: a stale loop stops at once. */
  const generation = useRef(0);

  const commit = useCallback(
    (next: { sceneId: string | null; adapter: TableSceneAdapter | null }) => {
      mountedRef.current = next;
      setMounted(next);
    },
    []
  );

  const run = useCallback(async () => {
    if (running.current || !repository) return;
    running.current = true;
    const ticket = generation.current;
    const alive = () => ticket === generation.current;
    try {
      while (alive() && requested.current !== mountedRef.current.sceneId) {
        const current = mountedRef.current;
        if (current.adapter && current.sceneId) {
          setSwitching(true);
          const adapter = current.adapter;
          let stable = false;
          for (let round = 0; round < FLUSH_ROUNDS; round += 1) {
            const before = adapter.getLocalEditGeneration();
            await adapter.flush();
            if (adapter.getLocalEditGeneration() === before) {
              stable = true;
              break;
            }
          }
          if (!alive()) return;
          const name = latest.current.sceneName(current.sceneId);
          const blocked: TableSwitchNotice | null = adapter.getPendingConflict()
            ? { kind: 'conflict', sceneName: name }
            : !stable || latest.current.isBusy?.() === true
              ? { kind: 'saving', sceneName: name }
              : null;
          if (blocked) {
            setNotice(blocked);
            setSwitching(false);
            requested.current = current.sceneId;
            latest.current.onRevert(current.sceneId);
            return;
          }
          // C6-4: the latest request after the gate wins; returning to
          // the mounted scene mid-flush keeps it (nothing is disposed).
          if (requested.current === current.sceneId) break;
          latest.current.onBeforeUnmount(current.sceneId);
          adapter.dispose();
        }
        const target = requested.current;
        setNotice(null);
        commit({
          sceneId: target,
          adapter: target
            ? createTableSceneAdapter({
                repository,
                sceneId: target,
                campaignCode,
              })
            : null,
        });
      }
    } finally {
      if (alive()) {
        running.current = false;
        setSwitching(false);
      }
    }
  }, [campaignCode, commit, repository]);

  // A new repository (auth identity change) starts from nothing. Declared
  // before the run effect so its reset lands first.
  useEffect(() => {
    commit({ sceneId: null, adapter: null });
    return () => {
      generation.current += 1;
      running.current = false;
      mountedRef.current.adapter?.dispose();
      mountedRef.current = { sceneId: null, adapter: null };
    };
  }, [commit, repository]);

  useEffect(() => {
    void run();
  }, [requestedSceneId, run]);

  return {
    mountedSceneId: mounted.sceneId,
    adapter: mounted.adapter,
    switching,
    notice,
    clearNotice: useCallback(() => setNotice(null), []),
  };
}
