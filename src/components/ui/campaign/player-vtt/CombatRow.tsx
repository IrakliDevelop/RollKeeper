'use client';

import { useEffect, useState } from 'react';

import { CircleDot, Shield, Skull, User } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { HPBar } from '@/components/shared/combat/HPBar';
import { cn } from '@/utils/cn';
import { getHpTierTextColor } from '@/utils/hpColor';
import { resolveEntryHpMode } from '@/utils/hpState';
import type { EnemyHpDisplay } from '@/types/encounter';
import type { SharedTurnEntry } from '@/types/sharedState';

interface CombatRowProps {
  entry: SharedTurnEntry;
  characterId: string;
  isCurrent: boolean;
  enemyHpMode: EnemyHpDisplay;
  onEndTurn: (entityId: string) => void;
}

export function CombatRow({
  entry,
  characterId,
  isCurrent,
  enemyHpMode,
  onEndTurn,
}: CombatRowProps) {
  const isYou = entry.playerCharacterId === characterId;
  const isDead = entry.isDead === true;
  const hasHp = entry.currentHp !== undefined && entry.maxHp !== undefined;
  // A DM per-entity override on the entry wins over the campaign-wide mode.
  const hpMode = resolveEntryHpMode(entry, enemyHpMode);
  const isCurrentAlive = isCurrent && !isDead;
  const isMyActiveTurn = isCurrent && isYou;

  // Optimistic end-turn: disable the button the instant it's clicked so a
  // slow poll can't let the player fire a duplicate request; cleared once
  // the synced state moves off this entity's turn (mirrors InitiativePanel's
  // pendingFrom pattern, minimal version — no next-entity highlight here).
  const [pendingEndTurn, setPendingEndTurn] = useState(false);
  useEffect(() => {
    if (pendingEndTurn && !isCurrent) setPendingEndTurn(false);
  }, [isCurrent, pendingEndTurn]);

  const handleEndTurnClick = () => {
    onEndTurn(entry.entityId);
    setPendingEndTurn(true);
  };

  return (
    <li
      aria-current={isCurrentAlive ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-1 border-l-2 px-3 py-1.5',
        isCurrentAlive
          ? 'bg-brass-bg border-brass-border'
          : 'border-transparent'
      )}
    >
      <div className="flex items-center gap-2">
        {isDead ? (
          <Skull size={13} className="text-blood-text shrink-0" aria-hidden />
        ) : entry.type === 'player' ? (
          <User size={13} className="text-muted shrink-0" aria-hidden />
        ) : entry.disposition === 'ally' ? (
          <Shield
            size={13}
            className="text-muted shrink-0"
            role="img"
            aria-label="Ally"
          />
        ) : entry.disposition === 'neutral' ? (
          <CircleDot
            size={13}
            className="text-muted shrink-0"
            role="img"
            aria-label="Neutral"
          />
        ) : (
          <Skull
            size={13}
            className="text-muted shrink-0"
            role="img"
            aria-label="Enemy"
          />
        )}
        <span
          className={cn(
            'type-ui truncate',
            isDead
              ? 'text-muted line-through'
              : isCurrent
                ? 'text-heading font-semibold'
                : 'text-heading'
          )}
        >
          {entry.displayName}
          {isYou && <span className="text-muted ml-1 font-normal">(you)</span>}
        </span>
      </div>
      <div className="ml-[21px] flex flex-col gap-1">
        {isCurrentAlive && (
          <span className="type-small text-brass-text">Current turn</span>
        )}
        {isDead ? (
          <span className="type-small text-muted">
            {entry.type === 'player' ? 'Down' : 'Defeated'}
          </span>
        ) : hasHp ? (
          <HPBar
            current={entry.currentHp as number}
            max={entry.maxHp as number}
            size="sm"
          />
        ) : entry.hpState ? (
          <span className="type-small text-muted">{entry.hpState}</span>
        ) : entry.hpPercent !== undefined && hpMode === 'percent' ? (
          <span
            className={cn(
              'type-small',
              entry.hpTier ? getHpTierTextColor(entry.hpTier) : 'text-muted'
            )}
          >
            {entry.hpPercent}%
          </span>
        ) : entry.hpPercent !== undefined && hpMode === 'bar' ? (
          <HPBar
            current={entry.hpPercent}
            max={100}
            size="sm"
            showLabel={false}
          />
        ) : null}
      </div>
      {isMyActiveTurn && (
        <Button
          variant="primary"
          size="sm"
          fullWidth
          className="mt-1"
          onClick={handleEndTurnClick}
          disabled={pendingEndTurn}
        >
          End my turn
        </Button>
      )}
    </li>
  );
}
