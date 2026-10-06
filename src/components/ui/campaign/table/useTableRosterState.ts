'use client';

import { useEffect, useMemo, useReducer, useRef } from 'react';

import type { TableRepository } from '@/lib/table/repository';
import {
  deriveSceneRoster,
  runRosterCommand,
  type TableSceneRoster,
} from '@/lib/table/roster';

import { useTablePlayersSnapshot } from './useTablePlayersSnapshot';

/** Live canvas operations the roster needs (provided by the Table route). */
export interface TableRosterCanvas {
  elements(): readonly Record<string, unknown>[];
  subscribe(listener: () => void): () => void;
  select(tokenIds: string[]): void;
  armPlacement(request: TablePlacementRequest): void;
  applyTokenPatch(
    tokenId: string,
    patch: { set: Record<string, unknown>; unset: string[] }
  ): boolean;
  ensurePlayerBand(legacyPlayerId: string, name: string): void;
}

export interface TablePlacementRequest {
  tokenId: string;
  sceneMemberId: string;
  name: string;
  avatarUrl?: string;
  color: string;
  tokenCells: number;
  fields: Record<string, unknown>;
}

const NO_ELEMENTS: readonly Record<string, unknown>[] = [];

/**
 * Derived roster for one scene: repository snapshot + server-authorized
 * players + live canvas tokens (aliases use checkpoint provenance). PR01
 * members get stable ids through ONE persisted command on first load.
 */
export function useTableRosterState(options: {
  repository: TableRepository;
  sceneId: string;
  campaignCode: string;
  dmId: string;
  canvas: TableRosterCanvas | null;
}) {
  const { repository, sceneId, canvas, dmId } = options;
  const players = useTablePlayersSnapshot(options.campaignCode);
  const [repositoryTick, onRepository] = useReducer((n: number) => n + 1, 0);
  const [canvasTick, onCanvas] = useReducer((n: number) => n + 1, 0);
  useEffect(() => repository.subscribe(onRepository), [repository]);
  useEffect(() => canvas?.subscribe(onCanvas), [canvas]);

  const current = repository.getCurrent();
  const snapshot = current?.status === 'ready' ? current.snapshot : null;
  const playerList =
    players.snapshot.status === 'ready' ? players.snapshot.players : undefined;
  const canvasElements = useMemo(
    () => canvas?.elements() ?? NO_ELEMENTS,
    // canvasTick is the change signal for the canvas' live store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvas, canvasTick]
  );
  const roster = useMemo<TableSceneRoster | null>(
    () =>
      snapshot
        ? deriveSceneRoster({
            snapshot,
            sceneId,
            players: playerList,
            canvasElements: canvas ? canvasElements : undefined,
            dmPrincipals: [dmId],
          })
        : null,
    // repositoryTick refreshes when the repository reloads in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      snapshot,
      sceneId,
      playerList,
      canvas,
      canvasElements,
      dmId,
      repositoryTick,
    ]
  );
  const liveIds = useMemo(
    () =>
      new Set(
        canvasElements.flatMap(element =>
          typeof element.id === 'string' ? [element.id] : []
        )
      ),
    [canvasElements]
  );

  const ensuring = useRef(false);
  const needsIds = roster?.needsSceneMemberIds === true;
  useEffect(() => {
    if (!needsIds || ensuring.current) return;
    const latest = repository.getCurrent();
    if (latest?.status !== 'ready') return;
    const scene = latest.snapshot.scenes.find(item => item.sceneId === sceneId);
    if (!scene) return;
    ensuring.current = true;
    // Allocated here, once, before the transaction — never during render.
    const assignments = scene.members
      .filter(member => member.sceneMemberId === undefined)
      .map(member => ({
        actorId: member.actorId,
        sceneMemberId: crypto.randomUUID(),
      }));
    void runRosterCommand(repository, {
      expectedRevision: latest.snapshot.campaign?.revision ?? 0,
      operationId: crypto.randomUUID(),
      command: { type: 'roster.ensureSceneMemberIds', sceneId, assignments },
    }).finally(() => {
      ensuring.current = false;
    });
  }, [needsIds, repository, sceneId]);

  return { roster, liveIds, canvasElements, players, playerList };
}
