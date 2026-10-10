'use client';

import { Button } from '@/components/ui/forms/button';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import type { TableRosterEntry } from '@/lib/table/roster';

import {
  PHYSICAL_MINI_HELP,
  PHYSICAL_PLAYER_HELP,
  REPRESENTATION_PENDING,
} from './tableRepresentation';
import type { TablePlayersSnapshot } from './useTablePlayersSnapshot';

export interface TableMemberActions {
  onGive: (legacyPlayerId: string) => void;
  onReturn: () => void;
  onRepair: () => void;
  onBind: (tokenId: string) => void;
  onUnbind: (tokenId: string) => void;
  /** PR07 M3: table-output representation (table display only). */
  onRepresentation: (representation: 'physical' | 'digital') => void;
}

/** Explicit control reassignment and token binding (never automatic). */
export function TableMemberControls({
  entry,
  players,
  ambiguousTokenIds,
  unmatchedTokenIds,
  liveIds,
  busy,
  actions,
  liveHolder = false,
}: {
  entry: TableRosterEntry;
  players: TablePlayersSnapshot;
  ambiguousTokenIds: readonly string[];
  /** Tokens with no exact identity or no DM provenance (C3): bind explicitly. */
  unmatchedTokenIds: readonly string[];
  liveIds: ReadonlySet<string>;
  busy: boolean;
  actions: TableMemberActions;
  /** P10: tokens are retagged only while this tab holds live control. */
  liveHolder?: boolean;
}) {
  const playerControlled = entry.control.kind === 'player';
  const mismatched = entry.mismatchedTokenIds.filter(id => liveIds.has(id));
  const bindable = [
    ...entry.aliasTokenIds,
    ...ambiguousTokenIds,
    ...unmatchedTokenIds,
  ].filter(id => liveIds.has(id));

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
            Only you control this one. Players can&apos;t move it.
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
            Couldn&apos;t load the player list, so you keep control for now.
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
              {`Unlink ${tokenId}`}
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
                ? 'Matches more than one member'
                : unmatchedTokenIds.includes(tokenId)
                  ? 'Not linked yet'
                  : 'Older token, not linked'}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => actions.onBind(tokenId)}
            >
              {`Link ${tokenId}`}
            </Button>
          </div>
        ))}
      </section>
      <section className="space-y-2" aria-label="On the TV">
        <h3 className="text-heading text-sm font-semibold">On the TV</h3>
        <RadioGroupField
          aria-label="On the TV"
          value={entry.representation}
          disabled={busy}
          onValueChange={value =>
            actions.onRepresentation(
              value === 'physical' ? 'physical' : 'digital'
            )
          }
        >
          <RadioGroupItem value="digital" label="Digital token" size="sm" />
          <RadioGroupItem value="physical" label="Physical mini" size="sm" />
        </RadioGroupField>
        <p className="text-muted text-xs">{PHYSICAL_MINI_HELP}</p>
        {playerControlled && (
          <p className="text-muted text-xs">{PHYSICAL_PLAYER_HELP}</p>
        )}
        {!liveHolder && (
          <p className="text-accent-amber-text text-xs">
            {REPRESENTATION_PENDING}
          </p>
        )}
      </section>
    </div>
  );
}
