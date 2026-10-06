'use client';

import { useCallback, useRef, useState } from 'react';

import { dispositionColor } from '@/components/ui/campaign/dm-vtt/combatantToken';
import type { TableRepository } from '@/lib/table/repository';
import {
  dmTokenFields,
  newRosterIds,
  partyTokenFields,
  runRosterCommand,
  tokenControlPatch,
  type TableCampaignPlayer,
  type TableRosterCommandV1,
  type TableRosterEntry,
  type TableRosterResult,
} from '@/lib/table/roster';
import type {
  TableActorLiveStatsV1,
  TableActorProfileV1,
  TableMemberControlV1,
} from '@/lib/table/schema';

import type { TableRosterCanvas } from './useTableRosterState';

export interface TableRosterNotice {
  tone: 'info' | 'success' | 'error';
  message: string;
  retry?: () => void;
}

const REJECTIONS: Record<string, string> = {
  'control-unavailable':
    'Player control is unavailable for that identity. It stays with the DM.',
  'read-only': 'This character’s stats are read-only here.',
  'member-missing': 'That member is no longer in this scene.',
  'dm-only': 'This participant is DM-managed; players cannot control it.',
};

function failureMessage(result: TableRosterResult): string {
  if (result.status === 'conflict')
    return 'The scene changed elsewhere. Nothing was saved — review and retry.';
  if (result.status === 'rejected') {
    if (result.reason === 'limit-exceeded')
      return 'This scene is at its local size limit. Nothing was saved.';
    return REJECTIONS[result.detail ?? ''] ?? 'The change was rejected.';
  }
  if (result.status === 'failed') {
    if (result.reason === 'indexeddb-unavailable')
      return 'Table storage is unavailable on this device. Nothing was saved.';
    if (result.reason === 'quota-exceeded')
      return 'Device storage is full. Nothing was saved.';
    return 'Saving failed. Nothing was changed.';
  }
  return 'The change was not saved.';
}

const succeeded = (result: TableRosterResult) =>
  result.status === 'committed' || result.status === 'unchanged';

/**
 * Roster commands for the Table route. Every action commits through the
 * repository first and reports success only after the IndexedDB transaction
 * completed; canvas upserts (placement, control conversion) follow the
 * acknowledged commit and stay visibly repairable if they cannot apply.
 */
export function useTableRosterActions(options: {
  repository: TableRepository;
  sceneId: string;
  campaignCode: string;
  canvas: TableRosterCanvas | null;
  live: boolean;
  playerList: readonly TableCampaignPlayer[] | undefined;
  liveIds: ReadonlySet<string>;
  canvasElements: readonly Record<string, unknown>[];
}) {
  const [notice, setNotice] = useState<TableRosterNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(options);
  latest.current = options;

  const execute = useCallback(
    async (
      command: TableRosterCommandV1,
      messages: { success: string; unchanged?: string }
    ): Promise<TableRosterResult> => {
      const { repository, playerList } = latest.current;
      const current = repository.getCurrent();
      setBusy(true);
      const result = await runRosterCommand(repository, {
        expectedRevision:
          current?.status === 'ready'
            ? (current.snapshot.campaign?.revision ?? 0)
            : 0,
        operationId: crypto.randomUUID(),
        command,
        players: playerList,
      });
      setBusy(false);
      if (succeeded(result)) {
        setNotice({
          tone: 'success',
          message:
            result.status === 'unchanged'
              ? (messages.unchanged ?? messages.success)
              : messages.success,
        });
      } else {
        setNotice({
          tone: 'error',
          message: failureMessage(result),
          // Deliberate retry: the same intent on the newest state, never an
          // automatic replay.
          retry: () => void execute(command, messages),
        });
      }
      return result;
    },
    []
  );

  const applyControl = useCallback(
    (
      entry: TableRosterEntry,
      control: TableMemberControlV1,
      tokenIds: readonly string[]
    ): boolean => {
      const { canvas, canvasElements } = latest.current;
      if (!canvas || !entry.sceneMemberId) return false;
      let applied = true;
      for (const tokenId of tokenIds) {
        const token = canvasElements.find(element => element.id === tokenId);
        if (!token) continue;
        if (control.kind === 'player')
          canvas.ensurePlayerBand(control.legacyPlayerId, entry.name);
        applied =
          canvas.applyTokenPatch(
            tokenId,
            tokenControlPatch(token, entry.sceneMemberId, control)
          ) && applied;
      }
      return applied;
    },
    []
  );

  const reassign = useCallback(
    async (entry: TableRosterEntry, control: TableMemberControlV1) => {
      if (!entry.sceneMemberId) return;
      const result = await execute(
        {
          type: 'roster.reassignControl',
          sceneId: latest.current.sceneId,
          sceneMemberId: entry.sceneMemberId,
          control,
          at: new Date().toISOString(),
        },
        {
          success:
            control.kind === 'dm'
              ? `${entry.name} is DM-controlled.`
              : `${entry.name} is player-controlled.`,
        }
      );
      if (!succeeded(result)) return;
      const live = entry.boundTokenIds.filter(id =>
        latest.current.liveIds.has(id)
      );
      if (!applyControl(entry, control, live)) {
        setNotice({
          tone: 'error',
          message: `Saved, but ${entry.name}’s token was not updated on the map. Use Repair token to retry.`,
        });
      }
    },
    [applyControl, execute]
  );

  const at = () => new Date().toISOString();
  const sceneId = options.sceneId;

  return {
    notice,
    busy,
    clearNotice: () => setNotice(null),
    addParty: (player: TableCampaignPlayer) =>
      execute(
        {
          type: 'roster.addPartyMember',
          sceneId,
          campaignId: options.campaignCode,
          legacyPlayerId: player.playerId,
          characterId: player.characterId,
          name: player.name,
          ...newRosterIds(),
          at: at(),
        },
        {
          success: `${player.name} added to the scene.`,
          unchanged: `${player.name} is already in this scene.`,
        }
      ),
    addParticipant: (
      kind: 'roster.addCreatureInstance' | 'roster.addManualParticipant',
      stats: { liveStats: TableActorLiveStatsV1; profile: TableActorProfileV1 }
    ) =>
      execute(
        { type: kind, sceneId, ...stats, ...newRosterIds(), at: at() },
        { success: `${stats.liveStats.name} added to the scene.` }
      ),
    updateStats: (entry: TableRosterEntry, liveStats: TableActorLiveStatsV1) =>
      execute(
        {
          type: 'roster.updateActorStats',
          actorId: entry.actorId,
          liveStats,
          at: at(),
        },
        { success: `${entry.name}: stats saved.` }
      ),
    remove: (entry: TableRosterEntry) =>
      entry.sceneMemberId
        ? execute(
            {
              type: 'roster.removeMember',
              sceneId,
              sceneMemberId: entry.sceneMemberId,
              at: at(),
            },
            { success: `${entry.name} removed from the scene.` }
          )
        : undefined,
    bind: async (entry: TableRosterEntry, tokenId: string, bind: boolean) => {
      if (!entry.sceneMemberId) return;
      const result = await execute(
        {
          type: bind ? 'roster.bindToken' : 'roster.unbindToken',
          sceneId,
          sceneMemberId: entry.sceneMemberId,
          tokenId,
          at: at(),
        },
        { success: bind ? 'Token bound.' : 'Token unbound.' }
      );
      if (bind && succeeded(result))
        latest.current.canvas?.applyTokenPatch(tokenId, {
          set: { sceneMemberId: entry.sceneMemberId },
          unset: [],
        });
    },
    reassign,
    repair: (entry: TableRosterEntry) => {
      const control: TableMemberControlV1 =
        entry.control.kind === 'player'
          ? { kind: 'player', legacyPlayerId: entry.control.legacyPlayerId }
          : { kind: 'dm' };
      const applied = applyControl(entry, control, entry.mismatchedTokenIds);
      setNotice(
        applied
          ? { tone: 'success', message: `${entry.name}’s token repaired.` }
          : {
              tone: 'error',
              message: 'The map is not ready; the token was not repaired.',
            }
      );
    },
    place: async (entry: TableRosterEntry) => {
      const { canvas, live, liveIds } = latest.current;
      if (!entry.sceneMemberId) return;
      const present = [...entry.boundTokenIds, ...entry.aliasTokenIds].filter(
        id => liveIds.has(id)
      );
      if (canvas && present.length > 0) {
        canvas.select(present);
        return;
      }
      if (!canvas || !live) {
        setNotice({
          tone: 'info',
          message: 'Waiting for a live connection before placing tokens.',
        });
        return;
      }
      let tokenId = entry.boundTokenIds[0];
      if (!tokenId) {
        tokenId = crypto.randomUUID();
        const result = await execute(
          {
            type: 'roster.bindToken',
            sceneId,
            sceneMemberId: entry.sceneMemberId,
            tokenId,
            at: at(),
          },
          { success: `Click the map to place ${entry.name}.` }
        );
        if (!succeeded(result)) return;
      }
      const control = entry.control;
      if (control.kind === 'player')
        canvas.ensurePlayerBand(control.legacyPlayerId, entry.name);
      canvas.armPlacement({
        tokenId,
        sceneMemberId: entry.sceneMemberId,
        name: entry.name,
        ...(entry.avatarUrl ? { avatarUrl: entry.avatarUrl } : {}),
        color: dispositionColor({
          type: entry.category === 'pc' ? 'player' : entry.category,
        }),
        tokenCells: entry.tokenCells,
        fields:
          control.kind === 'player'
            ? partyTokenFields(entry.sceneMemberId, control.legacyPlayerId)
            : dmTokenFields(entry.sceneMemberId),
      });
    },
  };
}
