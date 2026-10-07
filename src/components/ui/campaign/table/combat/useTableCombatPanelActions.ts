'use client';

import { useMemo, useState } from 'react';

import {
  judgePresentationOutcome,
  presentationMayHaveCommitted,
  type TableControlSession,
} from '@/lib/table/authorityLifecycle';
import { combatArchiveId, type TableCombatCommandV1 } from '@/lib/table/combat';
import { deriveSceneRoster } from '@/lib/table/roster';

import { presentationReasonWords } from '../presentation/TablePresentationControls.utils';

import type { TableParticipantOption } from './TableParticipantDialog';
import {
  createTableEntityActions,
  tableDetailCapabilities,
  type TableCombatDraft,
} from './tableEntityActions';
import type { useTableCombat } from './useTableCombat';

const CATEGORY = { pc: 'Player character', npc: 'NPC', monster: 'Creature' };
const now = () => new Date().toISOString();

type Combat = ReturnType<typeof useTableCombat>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** View state and user intents of the Table combat panel (one command each). */
export function useTableCombatPanelActions(options: {
  combat: Combat;
  sceneId: string;
  campaignCode: string;
  /** Imported-workspace route selection, kept in cross-scene links. */
  tableWorkspaceId: string | null;
  /** The page control session (combined Show + Start, P8). */
  controlSession?: TableControlSession | null;
}) {
  const { combat, sceneId } = options;
  const { snapshot, model, selectedRun, execute, setNotice } = combat;
  const runId = selectedRun?.runId ?? null;
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [newRunKey, setNewRunKey] = useState(0);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsKey, setParticipantsKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [missing, setMissing] = useState<{
    runId: string;
    actorIds: string[];
  } | null>(null);

  const roster = useMemo(
    () =>
      snapshot
        ? deriveSceneRoster({
            snapshot,
            sceneId,
            players: combat.playerData?.map(player => ({
              playerId: player.playerId,
              characterId: player.characterId,
              name:
                player.characterName || player.playerName || player.playerId,
            })),
          })
        : null,
    [snapshot, sceneId, combat.playerData]
  );
  const scene = snapshot?.scenes.find(value => value.sceneId === sceneId);
  const members = (roster?.entries ?? []).filter(
    entry => !entry.removed && entry.sceneMemberId !== null
  );
  const participantIds = new Set(
    selectedRun?.participants.map(participant => participant.actorId) ?? []
  );
  const elements = new Map(
    (Array.isArray(record(scene?.canvasCheckpoint?.state)?.elements)
      ? (record(scene?.canvasCheckpoint?.state)!.elements as unknown[])
      : []
    )
      .map(record)
      .filter((value): value is Record<string, unknown> => value !== null)
      .map(element => [element.id, element] as const)
  );
  const dmOnly = (tokenId: string) =>
    scene?.map.dmOnlyElements[tokenId] === true ||
    elements.get(tokenId)?.audience === 'dm';
  const participantOptions: TableParticipantOption[] = members.map(entry => ({
    actorId: entry.actorId,
    name: entry.name,
    detail: CATEGORY[entry.category],
    hiddenByDefault:
      entry.boundTokenIds.length > 0 && entry.boundTokenIds.every(dmOnly),
  }));
  const bystanders = members
    .filter(entry => !participantIds.has(entry.actorId))
    .map(entry => ({ actorId: entry.actorId, name: entry.name }));

  const activeRunId = combat.campaign?.activeRunId ?? null;
  // F2: the campaign pointer is workspace-wide; the active run may live in
  // another scene of this workspace.
  const activeRun = snapshot?.encounters.find(run => run.runId === activeRunId);
  const activeScene = activeRun
    ? snapshot?.scenes.find(value => value.sceneId === activeRun.sceneId)
    : undefined;
  const activeQuery = new URLSearchParams();
  if (options.tableWorkspaceId)
    activeQuery.set('tableWorkspace', options.tableWorkspaceId);
  if (activeRun) activeQuery.set('run', activeRun.runId);
  const activeSummary = activeRun
    ? {
        runId: activeRun.runId,
        label: activeRun.label ?? 'Imported run',
        sameScene: activeRun.sceneId === sceneId,
        sceneName: activeScene?.map.name ?? 'another scene',
        href: `/dm/campaign/${encodeURIComponent(options.campaignCode)}/table/${encodeURIComponent(activeRun.sceneId)}?${activeQuery.toString()}`,
      }
    : null;
  const activeElsewhere =
    activeSummary && activeSummary.runId !== runId ? activeSummary : null;
  const log = selectedRun
    ? snapshot?.logs.find(
        value =>
          value.archiveId ===
          combatArchiveId(selectedRun.runId, selectedRun.combatGeneration ?? 0)
      )
    : undefined;

  const withRun = (build: (runId: string) => TableCombatCommandV1) => () => {
    if (!runId) return Promise.resolve(null);
    const target = runId;
    return execute(() => build(target));
  };

  const entityActions = useMemo(
    () =>
      createTableEntityActions({
        model: model ?? {
          run: null as never,
          encounter: null as never,
          participants: [],
          running: false,
          importedActive: false,
          actorIdByEntityId: new Map(),
        },
        dispatch: (draft: TableCombatDraft) => {
          if (!model) return;
          const target = model.run.runId;
          void execute(
            () =>
              ({ ...draft, runId: target, at: now() }) as TableCombatCommandV1
          );
        },
        notify: message => setNotice({ tone: 'info', message }),
      }),
    [model, execute, setNotice]
  );

  const nameOf = (actorId: string) =>
    model?.participants.find(view => view.actorId === actorId)?.entity.name ??
    actorId;
  const start = async () => {
    if (!model || !runId) return;
    const lacking = model.run.participants
      .filter(participant => participant.initiative === null)
      .map(participant => participant.actorId);
    if (lacking.length > 0) {
      setMissing({ runId, actorIds: lacking });
      return;
    }
    setMissing(null);
    const result = await execute(() => ({
      type: 'combat.start',
      runId,
      at: now(),
    }));
    if (result?.status === 'rejected' && result.reason === 'missing-initiative')
      setMissing({ runId, actorIds: result.actorIds ?? [] });
  };
  /** P8 step (3): Show through the page session, judged per Q1. */
  const showScene = async (): Promise<
    { ok: true } | { ok: false; reason: string; uncertain?: boolean }
  > => {
    const session = options.controlSession;
    if (!session || session.isLost())
      return { ok: false, reason: 'live control is required' };
    const outcome = await session.show(sceneId, `show-${crypto.randomUUID()}`);
    switch (outcome.status) {
      case 'committed':
        return judgePresentationOutcome(
          { type: 'show', sceneId },
          outcome.current ?? session.current()
        ) === 'published'
          ? { ok: true }
          : { ok: false, reason: 'the audience changed in the meantime' };
      case 'rejected':
        return { ok: false, reason: presentationReasonWords(outcome.reason) };
      case 'lost':
        return { ok: false, reason: 'live control was lost' };
      case 'unconfirmed':
      case 'failed':
        // N1: a sent Show whose outcome is uncertain may have committed —
        // never claim "not shown"; combat still does not start.
        return presentationMayHaveCommitted(outcome)
          ? { ok: false, reason: 'not-confirmed', uncertain: true }
          : {
              ok: false,
              reason:
                outcome.status === 'failed' && outcome.httpStatus === 400
                  ? 'the request was rejected'
                  : 'live control is unavailable',
            };
    }
  };
  const showAndStart = async () => {
    if (!model || !runId) return;
    const lacking = model.run.participants
      .filter(participant => participant.initiative === null)
      .map(participant => participant.actorId);
    if (lacking.length > 0) {
      setMissing({ runId, actorIds: lacking });
      return;
    }
    setMissing(null);
    const result = await combat.showAndStart(runId, showScene);
    if (result?.status === 'rejected' && result.reason === 'missing-initiative')
      setMissing({ runId, actorIds: result.actorIds ?? [] });
  };
  // Only participants still lacking a value stay in the prompt.
  const missingPrompt =
    missing && missing.runId === runId && model
      ? model.run.participants
          .filter(participant => participant.initiative === null)
          .map(participant => nameOf(participant.actorId))
      : null;

  return {
    entityActions,
    capabilities: (model?.participants ?? []).map(view => ({
      entityId: view.entityId,
      caps: tableDetailCapabilities(view),
    })),
    participantOptions,
    bystanders,
    activeElsewhere,
    activeSummary,
    hpUnknownEntityIds: new Set(
      (model?.participants ?? [])
        .filter(view => view.missingPlayerData || view.playerDataUnavailable)
        .map(view => view.entityId)
    ),
    playerNotices: (model?.participants ?? [])
      .filter(view => view.playerDataUnavailable)
      .map(
        view =>
          `${view.entity.name}: player data unavailable — HP not broadcast`
      ),
    loggingPaused: log?.loggingPaused === true,
    missingPrompt,
    newRunOpen,
    newRunKey,
    setNewRunOpen,
    openNewRun: () => {
      setNewRunKey(value => value + 1);
      setNewRunOpen(true);
    },
    participantsOpen,
    participantsKey,
    setParticipantsOpen,
    openParticipants: () => {
      setParticipantsKey(value => value + 1);
      setParticipantsOpen(true);
    },
    historyOpen,
    setHistoryOpen,
    selectRun: (target: string) =>
      void execute(() => ({
        type: 'combat.selectRun',
        runId: target,
        at: now(),
      })),
    goToActive: () => {
      if (!activeRunId) return;
      void execute(() => ({
        type: 'combat.selectRun',
        runId: activeRunId,
        at: now(),
      }));
    },
    createRun: (label: string) => {
      // Identity allocated once, before the transaction; a retry reuses it.
      const newRunId = crypto.randomUUID();
      void execute(() => ({
        type: 'combat.createRun',
        sceneId,
        runId: newRunId,
        label,
        at: now(),
      })).then(result => {
        if (result?.status === 'committed') setNewRunOpen(false);
      });
    },
    saveParticipants: (actorIds: string[], hiddenActorIds: string[]) =>
      void withRun(target => ({
        type: 'combat.setParticipants',
        runId: target,
        actorIds,
        ...(hiddenActorIds.length > 0 ? { hiddenActorIds } : {}),
        at: now(),
      }))().then(result => {
        if (result?.status === 'committed' || result?.status === 'unchanged')
          setParticipantsOpen(false);
      }),
    setInitiative: (actorId: string, value: number | null) =>
      void withRun(target => ({
        type: 'combat.setInitiative',
        runId: target,
        actorId,
        value,
        at: now(),
      }))(),
    setHidden: (actorId: string, hidden: boolean) =>
      void withRun(target => ({
        type: 'combat.setHidden',
        runId: target,
        actorId,
        hidden,
        at: now(),
      }))(),
    start: () => void start(),
    showAndStart: () => void showAndStart(),
    end: () =>
      void withRun(target => ({
        type: 'combat.end',
        runId: target,
        at: now(),
      }))(),
    nextTurn: () =>
      void withRun(target => ({
        type: 'combat.nextTurn',
        runId: target,
        at: now(),
      }))(),
    prevTurn: () =>
      void withRun(target => ({
        type: 'combat.prevTurn',
        runId: target,
        at: now(),
      }))(),
    deleteArchive: (archiveId: string) =>
      void execute(() => ({
        type: 'combat.deleteArchive',
        archiveId,
        at: now(),
      })),
  };
}
