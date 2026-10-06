'use client';

import { Button } from '@/components/ui/forms/button';
import type { TableRosterEntry } from '@/lib/table/roster';

import type { TablePlayersSnapshot } from './useTablePlayersSnapshot';

export interface TableMemberActions {
  onGive: (legacyPlayerId: string) => void;
  onReturn: () => void;
  onRepair: () => void;
  onBind: (tokenId: string) => void;
  onUnbind: (tokenId: string) => void;
}

/** Explicit control reassignment and token binding (never automatic). */
export function TableMemberControls({
  entry,
  players,
  ambiguousTokenIds,
  liveIds,
  busy,
  actions,
}: {
  entry: TableRosterEntry;
  players: TablePlayersSnapshot;
  ambiguousTokenIds: readonly string[];
  liveIds: ReadonlySet<string>;
  busy: boolean;
  actions: TableMemberActions;
}) {
  const playerControlled = entry.control.kind === 'player';
  const mismatched = entry.mismatchedTokenIds.filter(id => liveIds.has(id));
  const bindable = [...entry.aliasTokenIds, ...ambiguousTokenIds].filter(id =>
    liveIds.has(id)
  );

  return (
    <div className="space-y-4">
      <section className="space-y-2" aria-label="Control">
        <h3 className="text-heading text-sm font-semibold">Control</h3>
        {playerControlled ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={actions.onReturn}
          >
            Return to DM control
          </Button>
        ) : !entry.playerIdentity ? (
          <p className="text-muted text-xs">
            DM-managed participant — players cannot control it.
          </p>
        ) : players.status === 'ready' ? (
          <div className="flex flex-wrap gap-2">
            {players.players.map(player => (
              <Button
                key={player.playerId}
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => actions.onGive(player.playerId)}
              >
                {`Give ${player.name} control`}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-muted text-xs">
            Campaign players are unavailable; control stays with the DM.
          </p>
        )}
      </section>
      <section className="space-y-2" aria-label="Tokens">
        <h3 className="text-heading text-sm font-semibold">Tokens</h3>
        {entry.boundTokenIds.length === 0 && bindable.length === 0 && (
          <p className="text-muted text-xs">No token bound yet.</p>
        )}
        {entry.boundTokenIds.map(tokenId => (
          <div key={tokenId} className="flex flex-wrap items-center gap-2">
            <span className="text-body min-w-0 flex-1 truncate text-xs">
              {tokenId}
              {liveIds.has(tokenId) ? '' : ' (not on map)'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => actions.onUnbind(tokenId)}
            >
              {`Unbind ${tokenId}`}
            </Button>
          </div>
        ))}
        {mismatched.length > 0 && (
          <div className="border-accent-amber-border bg-accent-amber-bg flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <p className="text-accent-amber-text min-w-0 flex-1 text-xs">
              The token on the map does not match this member’s control.
            </p>
            <Button
              variant="warning"
              size="sm"
              disabled={busy}
              onClick={actions.onRepair}
            >
              Repair token
            </Button>
          </div>
        )}
        {bindable.map(tokenId => (
          <div key={tokenId} className="flex flex-wrap items-center gap-2">
            <span className="text-muted min-w-0 flex-1 truncate text-xs">
              {ambiguousTokenIds.includes(tokenId)
                ? 'Ambiguous legacy token'
                : 'Unbound legacy alias'}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => actions.onBind(tokenId)}
            >
              {`Bind ${tokenId}`}
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
