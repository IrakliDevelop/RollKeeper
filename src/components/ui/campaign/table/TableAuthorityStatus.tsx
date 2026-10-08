'use client';

import { Button } from '@/components/ui/forms/button';

import type { TableAuthorityState } from './workspace/useTableWorkspaceAuthority';

function message(state: TableAuthorityState): string | null {
  switch (state.phase) {
    case 'ready':
      return 'Live control held.';
    case 'initializing':
      return 'Acquiring live control…';
    case 'offline':
      return 'Working offline · not broadcasting. Local combat and drafts stay saved on this device.';
    case 'failed':
    case 'lost':
      if (state.reason === 'live-unavailable')
        return 'Live publishing unavailable — Table live control is not enabled on this server. Scene combat stays local.';
      if (state.foreignHolder)
        return 'Another session holds live control. This page stays usable locally and broadcasts nothing.';
      return state.phase === 'lost'
        ? 'Live control lost. Local combat and drafts stay saved on this device; nothing is broadcast.'
        : `Private authority preparation failed (${state.reason}). Local combat stays usable; nothing is broadcast.`;
    default:
      return null;
  }
}

/**
 * Live-control banner for the Table page (R2-3): truthful status plus an
 * explicit, non-forcing "Acquire live control" that waits for an observed
 * foreign lease. There is no takeover control.
 */
export function TableAuthorityStatus(props: {
  state: TableAuthorityState;
  waitSeconds: number;
  clearedNotice: boolean;
  onAcquire: () => void;
  onWorkOffline: () => void;
  /** FU-5: hide the routine "held" explanation below `sm` (Details). */
  collapseExplanation?: boolean;
}) {
  const { state } = props;
  const text = message(state);
  const canAcquire =
    state.phase === 'failed' ||
    state.phase === 'lost' ||
    state.phase === 'offline';
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {text && (
        <p
          className={`min-w-0 flex-1 text-xs ${
            state.phase === 'ready' ? 'text-muted' : 'text-accent-amber-text'
          } ${
            props.collapseExplanation && state.phase === 'ready'
              ? 'max-sm:hidden'
              : ''
          }`}
          role={state.phase === 'lost' ? 'alert' : 'status'}
        >
          {text}
        </p>
      )}
      {props.clearedNotice && state.phase === 'ready' && (
        <p className="text-accent-amber-text w-full text-xs" role="status">
          Live control acquired. Public initiative cleared — Publish current
          state from the combat panel.
        </p>
      )}
      {canAcquire && (
        <Button
          variant="outline"
          size="sm"
          disabled={props.waitSeconds > 0}
          onClick={props.onAcquire}
        >
          {props.waitSeconds > 0
            ? `Acquire live control (${props.waitSeconds} s)`
            : 'Acquire live control'}
        </Button>
      )}
      {(state.phase === 'failed' || state.phase === 'lost') && (
        <Button variant="ghost" size="sm" onClick={props.onWorkOffline}>
          Work offline
        </Button>
      )}
    </div>
  );
}
