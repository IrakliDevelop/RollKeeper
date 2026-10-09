'use client';

import { useCallback, useEffect, useState } from 'react';

import type { BattleMapConnection } from '@/lib/battlemapSync';
import {
  restoreAuthorityFork,
  saveSceneCheckpoint,
} from '@/lib/table/checkpoint';
import type { TableRepository } from '@/lib/table/repository';
import type { TableSceneAdapter } from '@/lib/table/sceneAdapter';
import type { TableCanvasCheckpointV1 } from '@/lib/table/schema';

import { saveMessageTone, type SaveMessageTone } from './saveMessageTone';

/**
 * Checkpoint, restore and pending-conflict actions of the selected scene
 * (moved unchanged from the PR01–PR05 Table page; per scene, so the status
 * line resets when another scene is mounted).
 */
export function useSceneCheckpointActions(options: {
  repository: TableRepository | null;
  adapter: TableSceneAdapter | null;
  connection: BattleMapConnection | null;
  campaignCode: string;
  dmId: string;
  sceneId: string | null;
}) {
  const { repository, adapter, connection, campaignCode, dmId, sceneId } =
    options;
  const [save, setSave] = useState<{
    message: string;
    tone: SaveMessageTone;
  }>({ message: 'Local scene loading…', tone: 'routine' });
  /** O7-2 HN-1: the tone is fixed where the message is produced. */
  const setSaveMessage = useCallback(
    (message: string, tone?: SaveMessageTone) =>
      setSave({ message, tone: saveMessageTone(message, tone) }),
    []
  );
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    if (!adapter) return;
    setSaveMessage(
      adapter.getBattleMap()
        ? 'Local scene ready'
        : 'Scene not found in this local workspace'
    );
  }, [adapter, setSaveMessage]);

  async function saveCheckpoint() {
    setSaveBusy(true);
    try {
      await runSaveCheckpoint();
    } finally {
      setSaveBusy(false);
    }
  }

  async function runSaveCheckpoint() {
    if (!repository || !adapter || !connection || !sceneId) {
      setSaveMessage(
        'Relay is not ready. The local draft remains saved on this device.'
      );
      return;
    }
    await adapter.flush();
    const current = await repository.reload();
    if (current.status !== 'ready') {
      setSaveMessage('Table storage is unavailable; checkpoint not committed.');
      return;
    }
    const startGeneration = adapter.getLocalEditGeneration();
    setSaveMessage('Waiting for explicit relay receipts…');
    const result = await saveSceneCheckpoint({
      repository,
      connection,
      sceneId,
      expectedRevision: current.snapshot.campaign?.revision ?? 0,
      operationId: `checkpoint:${sceneId}:${crypto.randomUUID()}`,
      hasNewLocalEditsSinceBarrier: () =>
        adapter.getLocalEditGeneration() > startGeneration,
    });
    setSaveMessage(
      result.status === 'committed'
        ? result.pending
          ? 'Authoritative checkpoint committed; a newer local edit is still pending.'
          : 'Authoritative checkpoint committed locally.'
        : result.status === 'not-saved'
          ? `Checkpoint not committed (${result.reason}); the local draft remains pending.`
          : `Checkpoint not committed (${result.status}); the previous checkpoint is unchanged.`
    );
  }

  async function restore(
    checkpoint: TableCanvasCheckpointV1 | null | undefined,
    label: string
  ) {
    if (!checkpoint || !sceneId) return;
    setRecoveryBusy(true);
    setSaveMessage(`${label} is being guarded by the current generation…`);
    const result = await restoreAuthorityFork({
      campaignCode,
      dmId,
      sceneId,
      checkpoint,
    });
    setRecoveryBusy(false);
    setSaveMessage(
      result.status === 'restored'
        ? `${label} restored to live authority.`
        : result.status === 'conflict'
          ? `${label} was not restored because live authority changed. Review the current scene and retry deliberately.`
          : `${label} failed (${result.reason}); live authority and local data are unchanged.`
    );
  }

  async function reconcilePendingEdit(action: 'refresh' | 'retry' | 'discard') {
    if (!adapter) return;
    if (action === 'discard') {
      adapter.discardPendingConflict();
      setSaveMessage(
        'Pending conflicted edit discarded. The winning scene remains unchanged.'
      );
      return;
    }
    if (action === 'refresh') {
      const refreshed = await adapter.refreshPendingConflict();
      setSaveMessage(
        refreshed
          ? 'Winning scene refreshed. The conflicted edit is still pending for deliberate retry or discard.'
          : 'The winning scene could not be refreshed; the conflicted edit remains pending.'
      );
      return;
    }
    const result = await adapter.retryPendingConflict();
    setSaveMessage(
      result === 'committed'
        ? 'Pending edit deliberately reapplied to the latest scene without replacing unrelated winner fields.'
        : result === 'conflict'
          ? 'The scene changed again. The edit remains pending and was not replayed.'
          : result === 'none'
            ? 'There is no pending conflicted edit.'
            : 'The pending edit could not be applied and remains available.'
    );
  }

  return {
    saveMessage: save.message,
    saveTone: save.tone,
    setSaveMessage,
    recoveryBusy,
    saveBusy,
    saveCheckpoint,
    restore,
    reconcilePendingEdit,
  };
}
