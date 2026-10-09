'use client';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

import type { TableAuthorityState } from './workspace/useTableWorkspaceAuthority';

/** Banner text for every phase that is not plain "live" (R2-3 wording). */
function bannerMessage(state: TableAuthorityState): string | null {
  switch (state.phase) {
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
 * O7-2 H2: the compact live-control pill. Ready and initializing are the
 * pill's own polite status; for phases a banner explains (offline, lost,
 * failed) the pill is plain text so each state is announced once; idle is
 * a neutral, silent "not started" (HR-8).
 */
export function TableLivePill({ state }: { state: TableAuthorityState }) {
  const { text, variant, live } =
    state.phase === 'ready'
      ? { text: 'Live control held.', variant: 'primary' as const, live: true }
      : state.phase === 'initializing'
        ? {
            text: 'Acquiring live control…',
            variant: 'neutral' as const,
            live: true,
          }
        : state.phase === 'idle'
          ? {
              text: 'Live control: not started',
              variant: 'neutral' as const,
              live: false,
            }
          : state.phase === 'offline'
            ? { text: 'Offline', variant: 'neutral' as const, live: false }
            : { text: 'Not live', variant: 'warning' as const, live: false };
  return (
    <Badge
      data-testid="table-live-pill"
      variant={variant}
      size="sm"
      role={live ? 'status' : undefined}
    >
      {text}
    </Badge>
  );
}

/**
 * O7-2 H2: the live-control banner (R2-3): truthful status text with its
 * actions inline — an explicit, non-forcing "Acquire live control" that
 * waits for an observed foreign lease (countdown in the label) and "Work
 * offline". There is no takeover control. Lost is an alert; offline and
 * failed are polite status.
 */
export function TableAuthorityBanner(props: {
  state: TableAuthorityState;
  waitSeconds: number;
  clearedNotice: boolean;
  onAcquire: () => void;
  onWorkOffline: () => void;
}) {
  const { state } = props;
  const text = bannerMessage(state);
  const cleared = props.clearedNotice && state.phase === 'ready';
  if (!text && !cleared) return null;
  const canAcquire =
    state.phase === 'failed' ||
    state.phase === 'lost' ||
    state.phase === 'offline';
  return (
    <div
      data-testid="table-authority-banner"
      className="flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      {text && (
        <p
          className={`text-xs ${state.phase === 'offline' ? 'text-muted' : 'text-accent-amber-text'}`}
          role={state.phase === 'lost' ? 'alert' : 'status'}
        >
          {text}
        </p>
      )}
      {cleared && (
        <p className="text-accent-amber-text text-xs" role="status">
          Live control acquired. Public initiative cleared — Publish current
          state from the combat panel.
        </p>
      )}
      {canAcquire && (
        <Button
          variant="outline"
          size="xs"
          disabled={props.waitSeconds > 0}
          onClick={props.onAcquire}
        >
          {props.waitSeconds > 0
            ? `Acquire live control (${props.waitSeconds} s)`
            : 'Acquire live control'}
        </Button>
      )}
      {(state.phase === 'failed' || state.phase === 'lost') && (
        <Button variant="ghost" size="xs" onClick={props.onWorkOffline}>
          Work offline
        </Button>
      )}
    </div>
  );
}
