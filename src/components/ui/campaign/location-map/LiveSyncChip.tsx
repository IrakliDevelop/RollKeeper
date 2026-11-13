'use client';

import { Loader2 } from 'lucide-react';

import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';

/**
 * The battle map's live-sync state as a dot and a word. Shared by the setup
 * toolbar and the play-mode top bar so both read the same.
 */
export function LiveSyncChip({
  status,
}: {
  status: BattleMapConnectionStatus | 'disabled';
}) {
  if (status === 'disabled') {
    return (
      <span
        data-testid="live-sync-chip"
        className="type-small text-muted flex items-center gap-1.5"
      >
        Sync off
      </span>
    );
  }
  return (
    <span
      data-testid="live-sync-chip"
      className="type-small text-body flex items-center gap-1.5"
    >
      {status === 'connecting' ? (
        <Loader2 aria-hidden size={14} className="text-muted animate-spin" />
      ) : (
        <span
          aria-hidden
          className={`size-2 rounded-full ${
            status === 'live'
              ? 'bg-verdigris-fill'
              : status === 'denied'
                ? 'bg-blood-fill'
                : 'bg-divider-strong'
          }`}
        />
      )}
      {status === 'live'
        ? 'Live'
        : status === 'connecting'
          ? 'Connecting…'
          : status === 'offline'
            ? 'Offline'
            : status === 'unsupported'
              ? 'Sync unavailable'
              : 'Denied'}
    </span>
  );
}
