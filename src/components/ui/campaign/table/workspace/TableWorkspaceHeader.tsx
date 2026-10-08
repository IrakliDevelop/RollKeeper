'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/forms/button';
import type { TableSceneRecordV1 } from '@/lib/table/schema';

import {
  TablePresentationView,
  type TablePresentationPanel,
} from '../presentation';
import type { TablePresentationControlsProps } from '../presentation/TablePresentationControls.types';
import { TableAuthorityStatus } from '../TableAuthorityStatus';
import type { useSceneCheckpointActions } from './useSceneCheckpointActions';
import type { useTableWorkspaceAuthority } from './useTableWorkspaceAuthority';

export const WORKSPACE_LABEL = 'Saved on this device — scene runs are local';

type Authority = ReturnType<typeof useTableWorkspaceAuthority>;
type Checkpoint = ReturnType<typeof useSceneCheckpointActions>;

function checkpointLine(scene: TableSceneRecordV1 | undefined): string {
  if (!scene?.canvasCheckpoint) return 'none';
  return scene.canvasCheckpoint.generation.startsWith('adoption:')
    ? 'not yet committed (local adoption snapshot available)'
    : 'committed locally';
}

/**
 * Workspace header (W2): campaign back link, the S1 local-only label,
 * authority status, audience presentation (state owned by the workspace,
 * W4) and the selected scene's checkpoint/conflict actions. It holds no
 * subscription, so it can sit in the canvas dock and remount freely.
 */
export function TableWorkspaceHeader(props: {
  campaignCode: string;
  leading?: ReactNode;
  authority: Authority;
  clearedNotice: boolean;
  presentationProps: TablePresentationControlsProps;
  presentation: TablePresentationPanel;
  notices: Array<{ id: string; text: string; tone: 'alert' | 'status' }>;
  /** Workspace-level flows shown in the header (W7 prepare banner). */
  extra?: ReactNode;
  scene?: {
    name: string;
    stored: TableSceneRecordV1 | undefined;
    relayStatus: string;
    checkpoint: Checkpoint;
    pendingConflict: { fields: string[] } | null;
  };
}) {
  const { authority, scene } = props;
  return (
    <div className="border-divider bg-surface-secondary pointer-events-auto flex w-full flex-wrap items-center gap-3 p-3">
      <Link href={`/dm/campaign/${encodeURIComponent(props.campaignCode)}`}>
        <Button variant="ghost" size="sm">
          Back to campaign
        </Button>
      </Link>
      {props.leading}
      <div className="min-w-[min(100%,16rem)] flex-1">
        <p className="text-heading truncate text-sm font-semibold">
          {scene?.name ?? 'Table'}
        </p>
        <p className="text-muted text-xs">{WORKSPACE_LABEL}</p>
        {scene && (
          <>
            <p className="text-muted text-xs">
              Relay: {scene.relayStatus} · local operations:{' '}
              {scene.stored?.localDraft ? 'pending' : 'none'}
            </p>
            <p className="text-muted text-xs">
              Local draft: {scene.stored?.localDraft ? 'saved' : 'none'} ·
              authoritative checkpoint: {checkpointLine(scene.stored)}
            </p>
            <p className="text-muted text-xs">{scene.checkpoint.saveMessage}</p>
          </>
        )}
      </div>
      <TableAuthorityStatus
        state={authority.state}
        waitSeconds={authority.waitSeconds}
        clearedNotice={props.clearedNotice}
        onAcquire={authority.acquire}
        onWorkOffline={authority.workOffline}
      />
      {props.notices.map(notice => (
        <p
          key={notice.id}
          role={notice.tone}
          className="text-accent-amber-text w-full text-xs"
        >
          {notice.text}
        </p>
      ))}
      {props.extra}
      <TablePresentationView
        {...props.presentationProps}
        panel={props.presentation}
      />
      {scene?.pendingConflict && (
        <div
          className="border-accent-orange-text w-full rounded border p-2"
          role="alert"
        >
          <p className="text-accent-orange-text text-xs">
            A local edit conflicted with a newer scene and was not replayed.
            Pending fields: {scene.pendingConflict.fields.join(', ')}. Review
            the winner, then retry deliberately or discard this edit.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void scene.checkpoint.reconcilePendingEdit('refresh')
              }
            >
              Refresh winner
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void scene.checkpoint.reconcilePendingEdit('retry')
              }
            >
              Retry pending edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void scene.checkpoint.reconcilePendingEdit('discard')
              }
            >
              Discard pending edit
            </Button>
          </div>
        </div>
      )}
      {scene?.stored?.localDraft && (
        <Button
          variant="ghost"
          size="sm"
          disabled={scene.checkpoint.recoveryBusy}
          onClick={() =>
            void scene.checkpoint.restore(
              scene.stored?.localDraft,
              'Local draft'
            )
          }
        >
          Reapply local draft
        </Button>
      )}
      {scene?.stored?.canvasCheckpoint && (
        <Button
          variant="ghost"
          size="sm"
          disabled={scene.checkpoint.recoveryBusy}
          onClick={() =>
            void scene.checkpoint.restore(
              scene.stored?.canvasCheckpoint,
              'Saved checkpoint'
            )
          }
        >
          Restore saved checkpoint
        </Button>
      )}
      {scene && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => void scene.checkpoint.saveCheckpoint()}
        >
          Save checkpoint
        </Button>
      )}
    </div>
  );
}
