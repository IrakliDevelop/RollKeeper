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

import {
  checkpointNotSaved,
  restoreMessages,
  SAVE_MESSAGES,
  type RestoreKind,
  type SaveMessage,
  type SaveMessageTone,
} from './saveMessages';

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
  const [save, setSave] = useState<SaveMessage>(SAVE_MESSAGES.loading);
  /** O7-2 HN-1 / O7-3 W8R-7: the tone is fixed where the message is produced. */
  const setSaveMessage = useCallback(
    (text: string, tone: SaveMessageTone, detail?: string) =>
      setSave({ text, tone, detail }),
    []
  );
  const post = useCallback(
    (message: SaveMessage) =>
      setSaveMessage(message.text, message.tone, message.detail),
    [setSaveMessage]
  );
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    if (!adapter) return;
    post(adapter.getBattleMap() ? SAVE_MESSAGES.ready : SAVE_MESSAGES.notFound);
  }, [adapter, post]);

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
      post(SAVE_MESSAGES.notConnected);
      return;
    }
    await adapter.flush();
    const current = await repository.reload();
    if (current.status !== 'ready') {
      post(SAVE_MESSAGES.storageUnavailable);
      return;
    }
    const startGeneration = adapter.getLocalEditGeneration();
    post(SAVE_MESSAGES.saving);
    const result = await saveSceneCheckpoint({
      repository,
      connection,
      sceneId,
      expectedRevision: current.snapshot.campaign?.revision ?? 0,
      operationId: `checkpoint:${sceneId}:${crypto.randomUUID()}`,
      hasNewLocalEditsSinceBarrier: () =>
        adapter.getLocalEditGeneration() > startGeneration,
    });
    post(
      result.status === 'committed'
        ? result.pending
          ? SAVE_MESSAGES.savedWithNewerEdit
          : SAVE_MESSAGES.saved
        : result.status === 'not-saved'
          ? checkpointNotSaved('changes-kept', result.reason)
          : checkpointNotSaved('last-kept', result.status)
    );
  }

  async function restore(
    checkpoint: TableCanvasCheckpointV1 | null | undefined,
    kind: RestoreKind
  ) {
    if (!checkpoint || !sceneId) return;
    const messages = restoreMessages(kind);
    setRecoveryBusy(true);
    post(messages.busy);
    const result = await restoreAuthorityFork({
      campaignCode,
      dmId,
      sceneId,
      checkpoint,
    });
    setRecoveryBusy(false);
    post(
      result.status === 'restored'
        ? messages.restored
        : result.status === 'conflict'
          ? messages.conflict
          : messages.failed(result.reason)
    );
  }

  async function reconcilePendingEdit(action: 'refresh' | 'retry' | 'discard') {
    if (!adapter) return;
    if (action === 'discard') {
      adapter.discardPendingConflict();
      post(SAVE_MESSAGES.conflictDiscarded);
      return;
    }
    if (action === 'refresh') {
      const refreshed = await adapter.refreshPendingConflict();
      post(
        refreshed
          ? SAVE_MESSAGES.conflictRefreshed
          : SAVE_MESSAGES.conflictRefreshFailed
      );
      return;
    }
    const result = await adapter.retryPendingConflict();
    post(
      result === 'committed'
        ? SAVE_MESSAGES.conflictApplied
        : result === 'conflict'
          ? SAVE_MESSAGES.conflictChangedAgain
          : result === 'none'
            ? SAVE_MESSAGES.conflictNone
            : SAVE_MESSAGES.conflictApplyFailed
    );
  }

  return {
    saveMessage: save.text,
    saveTone: save.tone,
    saveDetail: save.detail,
    setSaveMessage,
    recoveryBusy,
    saveBusy,
    saveCheckpoint,
    restore,
    reconcilePendingEdit,
  };
}
