'use client';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { HPBar } from '@/components/shared/combat/HPBar';
import type { EnemyHpDisplay } from '@/types/encounter';
import type { SharedTurnEntry } from '@/types/sharedState';

/** Disposition-tinted avatar colours: emerald for the player's own row, blue
 * for allies/players, red for everything else (enemies, neutrals). */
function avatarColorClasses(entry: SharedTurnEntry, characterId: string) {
  if (entry.playerCharacterId === characterId) {
    return 'bg-accent-emerald-bg text-accent-emerald-text border-accent-emerald-border';
  }
  if (entry.type === 'player' || entry.disposition === 'ally') {
    return 'bg-accent-blue-bg text-accent-blue-text border-accent-blue-border';
  }
  return 'bg-accent-red-bg text-accent-red-text border-accent-red-border';
}

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
  const isMyActiveTurn = isCurrent && isYou;

  const handleEndTurnClick = () => onEndTurn(entry.entityId);

  return (
    <li
      className={`flex flex-col gap-1.5 rounded-lg px-2 py-2 ${
        isDead
          ? 'text-faint line-through opacity-50'
          : isCurrent
            ? 'bg-accent-amber-bg border-accent-amber-border animate-pulse border'
            : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${avatarColorClasses(entry, characterId)}`}
        >
          {entry.displayName.charAt(0).toUpperCase()}
        </span>
        <span className="text-body truncate text-sm font-medium">
          {entry.displayName}
        </span>
        {isYou && <Badge variant="success">YOU</Badge>}
      </div>
      <div className="pl-8">
        {isDead ? (
          <span className="text-xs">
            {entry.type === 'player' ? 'Down' : 'Defeated'}
          </span>
        ) : hasHp ? (
          <HPBar
            current={entry.currentHp as number}
            max={entry.maxHp as number}
            size="sm"
          />
        ) : entry.hpState ? (
          <span className="text-faint text-xs">{entry.hpState}</span>
        ) : entry.hpPercent !== undefined && enemyHpMode === 'percent' ? (
          <span className="text-faint text-xs">{entry.hpPercent}%</span>
        ) : entry.hpPercent !== undefined && enemyHpMode === 'bar' ? (
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
          size="lg"
          fullWidth
          onClick={handleEndTurnClick}
        >
          End my turn
        </Button>
      )}
    </li>
  );
}
