'use client';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { HPBar } from '@/components/shared/combat/HPBar';
import type {
  SharedInitiativeState,
  SharedTurnEntry,
} from '@/types/sharedState';

export interface CombatPanelProps {
  state: SharedInitiativeState | null;
  characterId: string;
  onEndTurn: (entityId: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

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
  onEndTurn: (entityId: string) => void;
}

function CombatRow({
  entry,
  characterId,
  isCurrent,
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
        ) : entry.hpPercent !== undefined ? (
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

/**
 * Player-facing combat panel for the VTT screen — a richer left-edge sibling
 * of `InitiativePanel`. Renders exactly what the (already-masked) shared
 * initiative state carries; never re-derives HP from raw numbers.
 */
export function CombatPanel({
  state,
  characterId,
  onEndTurn,
  collapsed,
  onToggleCollapsed,
}: CombatPanelProps) {
  if (!state || !state.isActive) return null;

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapsed}
        title="Expand combat panel"
        className="bg-surface-raised border-divider pointer-events-auto fixed top-[78px] left-4 flex min-h-[44px] w-11 items-center justify-center rounded-2xl border py-4 text-xs font-bold tracking-wider shadow-xl"
        style={{ writingMode: 'vertical-rl' }}
      >
        INITIATIVE
      </button>
    );
  }

  return (
    <div className="bg-surface-raised border-divider pointer-events-auto fixed top-[78px] bottom-6 left-4 flex w-[278px] flex-col overflow-hidden rounded-2xl border shadow-xl">
      <div className="border-divider flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-heading text-sm font-semibold">⚔ Combat</span>
          <span className="text-faint text-[11px] font-bold tracking-wider uppercase">
            ROUND {state.round} · {state.turnOrder.length} IN ORDER
          </span>
        </div>
        <Button
          variant="ghost"
          size="lg"
          onClick={onToggleCollapsed}
          aria-label="Collapse combat panel"
        >
          ▸
        </Button>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {state.turnOrder.map(entry => (
          <CombatRow
            key={entry.entityId}
            entry={entry}
            characterId={characterId}
            isCurrent={entry.entityId === state.currentEntityId}
            onEndTurn={onEndTurn}
          />
        ))}
      </ul>
    </div>
  );
}
