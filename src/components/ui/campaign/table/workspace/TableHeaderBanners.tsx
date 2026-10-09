'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/forms/button';

import type { SaveMessageTone } from './saveMessageTone';

export interface TableHeaderNotice {
  id: string;
  text: string;
  tone: 'alert' | 'status';
  action?: { label: string; onClick: () => void };
}

const SAVE_TONE: Record<Exclude<SaveMessageTone, 'routine'>, string> = {
  progress: 'text-muted',
  success: 'text-accent-emerald-text',
  failure: 'text-accent-red-text',
};

/**
 * O7-2 H1/H4/HR-1: the slim banner rows of the Table header — authority,
 * workspace notices, workspace flows (`extra`), the save/scene message and
 * the pending-conflict alert. Text first, its actions inline, wrapping on
 * narrow screens. FC-1: none of these ever collapses or moves into Details.
 */
export function TableHeaderBanners(props: {
  authority: ReactNode;
  notices: TableHeaderNotice[];
  extra?: ReactNode;
  save: { message: string; tone: SaveMessageTone } | null;
  conflict: {
    fields: string[];
    onReconcile: (action: 'refresh' | 'retry' | 'discard') => void;
  } | null;
  /** Spacing above the zone, applied only when a banner is visible. */
  className?: string;
}) {
  const { save, conflict } = props;
  return (
    <div
      data-testid="table-header-banners"
      className={`flex flex-col gap-1 ${props.className ?? ''}`}
    >
      {props.authority}
      {props.notices.map(notice => (
        <div
          key={notice.id}
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
        >
          <p role={notice.tone} className="text-accent-amber-text text-xs">
            {notice.text}
          </p>
          {notice.action && (
            <Button variant="outline" size="xs" onClick={notice.action.onClick}>
              {notice.action.label}
            </Button>
          )}
        </div>
      ))}
      {props.extra}
      {/* HR-1: one polite region for every non-routine save/scene message. */}
      <div role="status" aria-live="polite" className="empty:hidden">
        {save && save.tone !== 'routine' && (
          <p className={`text-xs ${SAVE_TONE[save.tone]}`}>{save.message}</p>
        )}
      </div>
      {conflict && (
        <div
          className="border-accent-orange-text flex flex-wrap items-center gap-x-2 gap-y-1 rounded border px-2 py-1"
          role="alert"
        >
          <p className="text-accent-orange-text text-xs">
            A local edit conflicted with a newer scene and was not replayed.
            Pending fields: {conflict.fields.join(', ')}. Review the winner,
            then retry deliberately or discard this edit.
          </p>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => conflict.onReconcile('refresh')}
          >
            Refresh winner
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => conflict.onReconcile('retry')}
          >
            Retry pending edit
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => conflict.onReconcile('discard')}
          >
            Discard pending edit
          </Button>
        </div>
      )}
    </div>
  );
}
