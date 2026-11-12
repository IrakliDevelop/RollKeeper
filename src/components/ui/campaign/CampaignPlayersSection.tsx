'use client';

import { useState } from 'react';
import { MessageSquare, RefreshCw, TrendingUp } from 'lucide-react';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { CopyCodeButton } from './CopyCodeButton';
import { PlayerRosterRow, playerDisplayName } from './PlayerRosterRow';
import { cn } from '@/utils/cn';
import type { CampaignPlayerData } from '@/types/campaign';

export interface CampaignPlayersSectionProps {
  code: string;
  players: CampaignPlayerData[];
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  onRefresh: () => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customCounterLabel?: string;
  playerCounters?: Record<string, number>;
  onAdjustCounter: (playerId: string, delta: number) => void;
  onViewPlayer: (player: CampaignPlayerData) => void;
  /** Must not reject; the caller handles its own errors. */
  onRemovePlayer: (player: CampaignPlayerData) => void | Promise<void>;
  onMessageAll: () => void;
  onAwardXp: () => void;
}

function PlayersError({
  onRetry,
  refreshing,
}: {
  onRetry: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="py-12 text-center">
      <h3 className="type-subheading text-heading">
        Couldn&apos;t load the players
      </h3>
      <p className="type-body text-muted mt-2">
        Check your connection, then try again.
      </p>
      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        loading={refreshing}
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}

function PlayersInvite({ code }: { code: string }) {
  return (
    <div className="py-12 text-center">
      <h3 className="type-subheading text-heading">Invite your players</h3>
      <p className="type-body text-muted mx-auto mt-2 max-w-md">
        Give them this code. They enter it under Join campaign on their
        Characters page, and their characters appear here.
      </p>
      <div className="mt-4 flex justify-center">
        <CopyCodeButton code={code} className="type-num-lg h-auto py-2" />
      </div>
    </div>
  );
}

export function CampaignPlayersSection({
  code,
  players,
  loading,
  error,
  lastFetched,
  onRefresh,
  open,
  onOpenChange,
  customCounterLabel,
  playerCounters,
  onAdjustCounter,
  onViewPlayer,
  onRemovePlayer,
  onMessageAll,
  onAwardXp,
}: CampaignPlayersSectionProps) {
  const [refreshing, setRefreshing] = useState(false);
  // An error hides a roster left over from an earlier fetch.
  const hasPlayers = !loading && !error && players.length > 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemove = async (player: CampaignPlayerData) => {
    const ok = await confirmDialog({
      title: `Remove ${playerDisplayName(player)}?`,
      message:
        'Their synced character data is removed from this campaign. They can rejoin with the campaign code.',
      confirmLabel: 'Remove player',
      tone: 'danger',
    });
    if (ok) await onRemovePlayer(player);
  };

  const trailing = hasPlayers ? (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leftIcon={<MessageSquare size={14} aria-hidden="true" />}
        onClick={onMessageAll}
      >
        Message all
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leftIcon={<TrendingUp size={14} aria-hidden="true" />}
        onClick={onAwardXp}
      >
        Award XP
      </Button>
    </>
  ) : undefined;

  let body;
  if (loading) {
    body = <p className="text-muted py-12 text-center">Loading players…</p>;
  } else if (error) {
    body = <PlayersError onRetry={handleRefresh} refreshing={refreshing} />;
  } else if (players.length === 0) {
    body = <PlayersInvite code={code} />;
  } else {
    const checkedAt = lastFetched
      ? ` · Last checked ${lastFetched.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })}`
      : '';
    body = (
      <>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="type-small text-muted">
            {`Players update every 10 seconds${checkedAt}`}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={refreshing}
            leftIcon={
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={cn(refreshing && 'motion-safe:animate-spin')}
              />
            }
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
        <ul className="divide-divider divide-y">
          {players.map(player => (
            <PlayerRosterRow
              key={player.playerId}
              player={player}
              customCounterLabel={customCounterLabel}
              counterValue={playerCounters?.[player.playerId] ?? 0}
              onAdjustCounter={
                customCounterLabel
                  ? delta => onAdjustCounter(player.playerId, delta)
                  : undefined
              }
              onView={() => onViewPlayer(player)}
              onRemove={() => handleRemove(player)}
            />
          ))}
        </ul>
      </>
    );
  }

  return (
    <Section
      heading={hasPlayers ? `Players (${players.length})` : 'Players'}
      level={2}
      wrapHeading
      collapsed={hasPlayers ? !open : undefined}
      onCollapsedChange={
        hasPlayers ? collapsed => onOpenChange(!collapsed) : undefined
      }
      trailing={trailing}
    >
      {body}
    </Section>
  );
}
