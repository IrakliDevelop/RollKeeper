'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

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
/** FU-5: the S1 label's compact form below `sm`. */
const WORKSPACE_LABEL_COMPACT = 'Local scene runs';
const DETAILS_STATUS_ID = 'table-header-details-status';
const DETAILS_ACTIONS_ID = 'table-header-details-actions';
/** Routine save lines; every other save message is a notice (FC-1). */
const ROUTINE_SAVE = new Set(['Local scene loading…', 'Local scene ready']);
const SAVE_FAILED = /not committed|is not ready|is unavailable/u;

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
  notices: Array<{
    id: string;
    text: string;
    tone: 'alert' | 'status';
    action?: { label: string; onClick: () => void };
  }>;
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
  // FU-5: below `sm`, secondary status lines and checkpoint actions sit
  // behind "Details"; notices, the conflict alert and primary controls never
  // collapse. Desktop layout is unchanged (`max-sm:` classes only).
  const [details, setDetails] = useState(false);
  const collapse = details ? '' : 'max-sm:hidden';
  const saveMessage = scene?.checkpoint.saveMessage ?? '';
  const routineSave = ROUTINE_SAVE.has(saveMessage);
  const attention =
    (scene?.stored?.localDraft ? 1 : 0) +
    (SAVE_FAILED.test(saveMessage) ? 1 : 0);
  return (
    <div className="border-divider bg-surface-secondary pointer-events-auto flex w-full flex-wrap items-center gap-2 p-2">
      <Link href={`/dm/campaign/${encodeURIComponent(props.campaignCode)}`}>
        <Button variant="ghost" size="sm">
          Back to campaign
        </Button>
      </Link>
      {props.leading}
      {scene && (
        <Button
          variant="ghost"
          size="sm"
          className="sm:hidden"
          aria-expanded={details}
          aria-controls={`${DETAILS_STATUS_ID} ${DETAILS_ACTIONS_ID}`}
          aria-label={
            attention > 0
              ? `Details (${attention}) — ${attention} item${attention === 1 ? ' needs' : 's need'} attention`
              : 'Details'
          }
          onClick={() => setDetails(value => !value)}
        >
          {attention > 0 ? `Details (${attention})` : 'Details'}
        </Button>
      )}
      <div className="min-w-[min(100%,16rem)] flex-1">
        <p className="text-heading truncate text-sm font-semibold">
          {scene?.name ?? 'Table'}
        </p>
        <p className="text-muted text-xs">
          <span className="sm:hidden">{WORKSPACE_LABEL_COMPACT}</span>
          <span className="max-sm:hidden">{WORKSPACE_LABEL}</span>
        </p>
        {scene && (
          <div id={DETAILS_STATUS_ID} className={collapse}>
            <p className="text-muted text-xs">
              Relay: {scene.relayStatus} · local operations:{' '}
              {scene.stored?.localDraft ? 'pending' : 'none'}
            </p>
            <p className="text-muted text-xs">
              Local draft: {scene.stored?.localDraft ? 'saved' : 'none'} ·
              authoritative checkpoint: {checkpointLine(scene.stored)}
            </p>
            {routineSave && <p className="text-muted text-xs">{saveMessage}</p>}
          </div>
        )}
        {scene && !routineSave && (
          <p className="text-muted text-xs">{saveMessage}</p>
        )}
      </div>
      <TableAuthorityStatus
        state={authority.state}
        waitSeconds={authority.waitSeconds}
        clearedNotice={props.clearedNotice}
        onAcquire={authority.acquire}
        onWorkOffline={authority.workOffline}
        collapseExplanation={!details}
      />
      {props.notices.map(notice => (
        <div
          key={notice.id}
          className="flex w-full flex-wrap items-center gap-2"
        >
          <p role={notice.tone} className="text-accent-amber-text text-xs">
            {notice.text}
          </p>
          {notice.action && (
            <Button variant="outline" size="sm" onClick={notice.action.onClick}>
              {notice.action.label}
            </Button>
          )}
        </div>
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
      {scene && (
        <div id={DETAILS_ACTIONS_ID} className={`contents ${collapse}`}>
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
      )}
    </div>
  );
}
