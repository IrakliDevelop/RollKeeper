'use client';

import { Button } from '@/components/ui/forms/button';
import type { SharedInitiativeState } from '@/types/sharedState';

import { CombatRow } from './CombatRow';

export interface CombatPanelProps {
  state: SharedInitiativeState | null;
  characterId: string;
  onEndTurn: (entityId: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
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
        className="bg-surface-raised border-divider text-heading pointer-events-auto fixed top-[78px] left-4 flex min-h-[44px] items-center gap-1.5 rounded-2xl border px-3 text-xs font-bold tracking-wider shadow-xl"
      >
        <span aria-hidden>⚔</span> INIT
      </button>
    );
  }

  return (
    <div className="bg-surface-raised border-divider pointer-events-auto fixed top-[78px] left-4 flex max-h-[calc(100vh-102px)] w-[278px] flex-col overflow-hidden rounded-2xl border shadow-xl">
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
            enemyHpMode={state.enemyHpMode}
            onEndTurn={onEndTurn}
          />
        ))}
      </ul>
    </div>
  );
}
