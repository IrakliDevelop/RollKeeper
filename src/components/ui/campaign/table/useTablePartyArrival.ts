'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { dispositionColor } from '@/components/ui/campaign/dm-vtt/combatantToken';
import type { TableRepository } from '@/lib/table/repository';
import {
  deriveSceneRoster,
  newRosterIds,
  partyTokenFields,
  runRosterCommand,
  type TableCampaignPlayer,
  type TableRosterCommandV1,
} from '@/lib/table/roster';

import { representationFields } from './tableRepresentation';
import type { TableRosterCanvas } from './useTableRosterState';

export interface TableArrivalNotice {
  tone: 'success' | 'error' | 'info';
  message: string;
  retry?: () => void;
}

const NOT_LIVE = 'Waiting for a live connection before placing tokens.';

/**
 * PR06 W11 "Bring party here": idempotently adds campaign players who are
 * not yet scene members (existing `addPartyMember`), then places a token at
 * the scene's arrival point (deterministic fan, snapped) ONLY for party
 * members without a live token, through the existing bind → band → stamp
 * path. Members with tokens keep their positions; re-running is a no-op.
 */
export function useTablePartyArrival(options: {
  repository: TableRepository;
  sceneId: string;
  campaignCode: string;
  dmId: string;
  canvas: TableRosterCanvas | null;
  live: boolean;
  players: readonly TableCampaignPlayer[] | undefined;
  /**
   * Acceptance A1: fresh campaign players read right before bringing the
   * party (the snapshot may predate a player joining); null = unavailable.
   */
  reloadPlayers?: () => Promise<readonly TableCampaignPlayer[] | null>;
}) {
  const latest = useRef(options);
  latest.current = options;
  const [, onRepository] = useReducer((value: number) => value + 1, 0);
  useEffect(
    () => options.repository.subscribe(onRepository),
    [options.repository]
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<TableArrivalNotice | null>(null);
  const current = options.repository.getCurrent();
  const scene =
    current?.status === 'ready'
      ? current.snapshot.scenes.find(item => item.sceneId === options.sceneId)
      : undefined;
  const arrivalPoint = scene?.arrivalPoint ?? null;
  const disabledReason = !arrivalPoint
    ? 'Set an arrival point first.'
    : !options.live || !options.canvas?.stampAt
      ? NOT_LIVE
      : !options.players && !options.reloadPlayers
        ? 'The campaign party is still loading.'
        : null;

  const commit = useCallback(
    async (
      command: TableRosterCommandV1,
      players: readonly TableCampaignPlayer[]
    ) => {
      const { repository } = latest.current;
      const snapshot = repository.getCurrent();
      return runRosterCommand(repository, {
        expectedRevision:
          snapshot?.status === 'ready'
            ? (snapshot.snapshot.campaign?.revision ?? 0)
            : 0,
        operationId: crypto.randomUUID(),
        command,
        players,
      });
    },
    []
  );

  const bringParty = useCallback(async (): Promise<void> => {
    const { repository, sceneId, campaignCode, dmId, canvas, live } =
      latest.current;
    const read = () => {
      const value = repository.getCurrent();
      return value?.status === 'ready' ? value.snapshot : null;
    };
    const start = read();
    const point = start?.scenes.find(
      item => item.sceneId === sceneId
    )?.arrivalPoint;
    if (!start || !point || !live || !canvas?.stampAt) return;
    setBusy(true);
    const reloaded = latest.current.reloadPlayers
      ? await latest.current.reloadPlayers()
      : latest.current.players;
    if (!reloaded) {
      setBusy(false);
      setNotice({
        tone: 'error',
        message:
          'Campaign players are unavailable. Nothing was placed — try again.',
        retry: () => void bringParty(),
      });
      return;
    }
    const players = reloaded;
    const failed: string[] = [];
    try {
      const roster = () => {
        const snapshot = read();
        return snapshot
          ? deriveSceneRoster({
              snapshot,
              sceneId,
              players,
              canvasElements: canvas.elements(),
              dmPrincipals: [dmId],
            })
          : null;
      };
      const at = () => new Date().toISOString();
      // (1) Idempotent membership for every campaign player.
      for (const player of players) {
        const present = roster()?.entries.some(
          entry =>
            !entry.removed && entry.identityLegacyPlayerId === player.playerId
        );
        if (present) continue;
        const result = await commit(
          {
            type: 'roster.addPartyMember',
            sceneId,
            campaignId: campaignCode,
            legacyPlayerId: player.playerId,
            characterId: player.characterId,
            name: player.name,
            ...newRosterIds(),
            at: at(),
          },
          players
        );
        if (result.status !== 'committed' && result.status !== 'unchanged')
          failed.push(player.name);
      }
      // (2) Tokens only for party members without a live token.
      const liveIds = new Set(
        canvas
          .elements()
          .flatMap(element =>
            typeof element.id === 'string' ? [element.id] : []
          )
      );
      const targets = (roster()?.entries ?? []).filter(
        entry =>
          !entry.removed &&
          entry.control.kind === 'player' &&
          entry.sceneMemberId !== null &&
          ![...entry.boundTokenIds, ...entry.aliasTokenIds].some(id =>
            liveIds.has(id)
          )
      );
      let slot = 0;
      for (const entry of targets) {
        if (entry.control.kind !== 'player' || !entry.sceneMemberId) continue;
        let tokenId = entry.boundTokenIds[0];
        if (!tokenId) {
          tokenId = crypto.randomUUID();
          const bound = await commit(
            {
              type: 'roster.bindToken',
              sceneId,
              sceneMemberId: entry.sceneMemberId,
              tokenId,
              at: at(),
            },
            players
          );
          if (bound.status !== 'committed' && bound.status !== 'unchanged') {
            failed.push(entry.name);
            continue;
          }
        }
        canvas.ensurePlayerBand(entry.control.legacyPlayerId, entry.name);
        const placed = canvas.stampAt(
          {
            tokenId,
            sceneMemberId: entry.sceneMemberId,
            name: entry.name,
            ...(entry.avatarUrl ? { avatarUrl: entry.avatarUrl } : {}),
            color: dispositionColor({ type: 'player' }),
            tokenCells: entry.tokenCells,
            fields: {
              ...partyTokenFields(
                entry.sceneMemberId,
                entry.control.legacyPlayerId
              ),
              ...representationFields(entry),
            },
          },
          point,
          slot
        );
        slot += 1;
        if (!placed) failed.push(entry.name);
      }
      const partyMembers = (roster()?.entries ?? []).filter(
        entry => !entry.removed && entry.control.kind === 'player'
      ).length;
      if (failed.length === 0 && partyMembers === 0) {
        setNotice({
          tone: 'info',
          message: 'No players have joined this campaign yet.',
        });
        return;
      }
      setNotice(
        failed.length > 0
          ? {
              tone: 'error',
              message: `Not placed: ${failed.join(', ')}. The others arrived.`,
              retry: () => void bringParty(),
            }
          : {
              tone: 'success',
              message:
                targets.length === 0
                  ? 'The whole party is already here.'
                  : `${targets.length} party token${targets.length === 1 ? '' : 's'} placed at the arrival point.`,
            }
      );
    } finally {
      setBusy(false);
    }
  }, [commit]);

  return {
    arrivalPoint,
    canBring: disabledReason === null && !busy,
    disabledReason,
    busy,
    notice,
    bringParty,
  };
}
