'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import type { TableSceneRecordV1 } from '@/lib/table/schema';

import {
  TablePresentationView,
  type TablePresentationPanel,
} from '../presentation';
import type { TablePresentationControlsProps } from '../presentation/TablePresentationControls.types';
import { TableAuthorityBanner, TableLivePill } from '../TableAuthorityStatus';
import {
  TableHeaderBanners,
  type TableHeaderNotice,
} from './TableHeaderBanners';
import { TableHeaderDetails } from './TableHeaderDetails';
import type { useSceneCheckpointActions } from './useSceneCheckpointActions';
import type { useTableWorkspaceAuthority } from './useTableWorkspaceAuthority';

export { WORKSPACE_LABEL } from './TableHeaderDetails';
/** S1 compact label: always visible (FC-1); the sentence is in Details. */
const WORKSPACE_LABEL_COMPACT = 'Saved on this device';

type Authority = ReturnType<typeof useTableWorkspaceAuthority>;
type Checkpoint = Pick<
  ReturnType<typeof useSceneCheckpointActions>,
  | 'saveTone'
  | 'saveMessage'
  | 'saveDetail'
  | 'recoveryBusy'
  | 'saveBusy'
  | 'live'
  | 'restore'
  | 'reapplyOfflineFork'
  | 'discardOfflineFork'
  | 'saveCheckpoint'
  | 'reconcilePendingEdit'
>;

/**
 * Scene navigation and audience controls share the dock on wide screens,
 * then stack in that order. Authority, notices and save/conflict results
 * stay visible beneath both areas. This view owns no subscription, so it
 * can sit in the canvas dock and remount freely.
 */
export function TableWorkspaceHeader(props: {
  campaignCode: string;
  leading?: ReactNode;
  authority: Pick<
    Authority,
    'state' | 'waitSeconds' | 'acquire' | 'workOffline'
  >;
  clearedNotice: boolean;
  presentationProps: TablePresentationControlsProps;
  presentation: TablePresentationPanel;
  notices: TableHeaderNotice[];
  details?: { open: boolean; onOpenChange: (open: boolean) => void };
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
  const phase = authority.state.phase;
  // The polite save region is always mounted; spacing follows content only.
  const bannersVisible =
    !['ready', 'initializing', 'idle'].includes(phase) ||
    (props.clearedNotice && phase === 'ready') ||
    props.notices.length > 0 ||
    props.extra != null ||
    (scene !== undefined && scene.checkpoint.saveTone !== 'routine') ||
    !!scene?.pendingConflict;
  return (
    <div
      data-testid="table-workspace-header"
      className="bg-surface-secondary pointer-events-auto grid w-full min-w-0 gap-x-3 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div
        data-testid="table-header-bar"
        className="flex min-w-0 flex-wrap content-start items-center gap-2"
      >
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dm/campaign/${encodeURIComponent(props.campaignCode)}`}>
            Back to campaign
          </Link>
        </Button>
        {props.leading}
        <div className="min-w-0 flex-1 basis-40">
          <p className="type-caption text-muted">DM view</p>
          <p
            className="type-subheading text-heading line-clamp-2 min-w-0 break-words"
            title={scene?.name ?? 'Table'}
          >
            {scene?.name ?? 'Table'}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:basis-full">
          <Badge variant="neutral" size="sm">
            {WORKSPACE_LABEL_COMPACT}
          </Badge>
          <TableLivePill state={authority.state} />
          {scene && (
            <TableHeaderDetails
              relayStatus={scene.relayStatus}
              stored={scene.stored}
              checkpoint={scene.checkpoint}
              open={props.details?.open}
              onOpenChange={props.details?.onOpenChange}
            />
          )}
        </div>
      </div>
      <div className="border-divider mt-3 min-w-0 border-t pt-3 xl:mt-0 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-3">
        <TablePresentationView
          {...props.presentationProps}
          panel={props.presentation}
        />
      </div>
      <TableHeaderBanners
        authority={
          <TableAuthorityBanner
            state={authority.state}
            waitSeconds={authority.waitSeconds}
            clearedNotice={props.clearedNotice}
            onAcquire={authority.acquire}
            onWorkOffline={authority.workOffline}
          />
        }
        className={bannersVisible ? 'pt-2 xl:col-span-2' : 'xl:col-span-2'}
        notices={props.notices}
        extra={props.extra}
        save={
          scene
            ? {
                message: scene.checkpoint.saveMessage,
                tone: scene.checkpoint.saveTone,
                detail: scene.checkpoint.saveDetail,
              }
            : null
        }
        conflict={
          scene?.pendingConflict
            ? {
                fields: scene.pendingConflict.fields,
                onReconcile: action =>
                  void scene.checkpoint.reconcilePendingEdit(action),
              }
            : null
        }
      />
    </div>
  );
}
