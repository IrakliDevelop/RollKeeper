'use client';

import { useMemo, useState } from 'react';

import { combatArchiveId, type TableCombatCommandV1 } from '@/lib/table/combat';
import { deriveSceneRoster } from '@/lib/table/roster';

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
  const activeRun = combat.runs.find(run => run.runId === activeRunId);
  const activeElsewhere =
    activeRun && activeRun.runId !== runId
      ? { runId: activeRun.runId, label: activeRun.label ?? 'Imported run' }
      : null;
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
