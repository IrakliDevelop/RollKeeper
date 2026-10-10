'use client';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

import type { TableAuthorityState } from './workspace/useTableWorkspaceAuthority';

/** Banner text for every phase that is not plain "live" (R2-3 wording). */
function bannerMessage(state: TableAuthorityState): string | null {
  switch (state.phase) {
    case 'offline':
      return "You're offline. Players and the TV won't see changes. Everything is still saved on this device.";
    case 'failed':
    case 'lost':
      if (state.reason === 'live-unavailable')
        return "Live play isn't set up on this server, so players and the TV won't see changes. Combat still works on this device.";
      if (state.foreignHolder)
        return "Another tab or device is live right now. You can keep working here, but players won't see these changes.";
      return state.phase === 'lost'
        ? "You're no longer live. Everything is still saved on this device, but players won't see new changes."
        : "Couldn't go live. You can keep working on this device; players won't see changes.";
    default:
      return null;
  }
}

/** O7-3: a raw failure reason is a tooltip only, never inline text. */
function failureReason(state: TableAuthorityState): string | undefined {
  if (state.phase !== 'failed') return undefined;
  if (state.reason === 'live-unavailable' || state.foreignHolder)
    return undefined;
  return state.reason;
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
      ? { text: "You're live", variant: 'primary' as const, live: true }
      : state.phase === 'initializing'
        ? {
            text: 'Going live…',
            variant: 'neutral' as const,
            live: true,
          }
        : state.phase === 'idle'
          ? {
              text: 'Not live yet',
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
 * actions inline — an explicit, non-forcing "Go live" that
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
          title={failureReason(state)}
        >
          {text}
        </p>
      )}
      {cleared && (
        <p className="text-accent-amber-text text-xs" role="status">
          You&apos;re live again. Players&apos; initiative list was cleared. Use
          Share with players in the combat panel to send it again.
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
            ? `Go live in ${props.waitSeconds} s`
            : 'Go live'}
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
