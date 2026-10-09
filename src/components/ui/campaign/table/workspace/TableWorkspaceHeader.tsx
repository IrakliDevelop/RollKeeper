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
const WORKSPACE_LABEL_COMPACT = 'Local scene runs';

type Authority = ReturnType<typeof useTableWorkspaceAuthority>;
type Checkpoint = ReturnType<typeof useSceneCheckpointActions>;

/**
 * Workspace header (W2, O7-2 H1): a thin composer of one wrapping bar
 * (navigation, scene title, compact S1 label, live pill, Details), the
 * slim banner rows (authority, notices, flows, save results, conflict) and
 * the audience row. DOM order is visual order. It holds no subscription,
 * so it can sit in the canvas dock and remount freely.
 */
export function TableWorkspaceHeader(props: {
  campaignCode: string;
  leading?: ReactNode;
  authority: Authority;
  clearedNotice: boolean;
  presentationProps: TablePresentationControlsProps;
  presentation: TablePresentationPanel;
  notices: TableHeaderNotice[];
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
      data-header-banners={bannersVisible ? 'shown' : 'none'}
      className="border-divider bg-surface-secondary pointer-events-auto flex w-full flex-col p-2"
    >
      <div
        data-testid="table-header-bar"
        className="flex flex-wrap items-center gap-2"
      >
        <Link href={`/dm/campaign/${encodeURIComponent(props.campaignCode)}`}>
          <Button variant="ghost" size="sm">
            Back to campaign
          </Button>
        </Link>
        {props.leading}
        <p className="text-heading min-w-0 text-sm font-semibold break-words">
          {scene?.name ?? 'Table'}
        </p>
        <Badge variant="neutral" size="sm">
          {WORKSPACE_LABEL_COMPACT}
        </Badge>
        <TableLivePill state={authority.state} />
        {scene && (
          <TableHeaderDetails
            relayStatus={scene.relayStatus}
            stored={scene.stored}
            checkpoint={scene.checkpoint}
          />
        )}
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
        className={bannersVisible ? 'mt-2' : ''}
        notices={props.notices}
        extra={props.extra}
        save={
          scene
            ? {
                message: scene.checkpoint.saveMessage,
                tone: scene.checkpoint.saveTone,
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
      <div className="mt-2">
        <TablePresentationView
          {...props.presentationProps}
          panel={props.presentation}
        />
      </div>
    </div>
  );
}
