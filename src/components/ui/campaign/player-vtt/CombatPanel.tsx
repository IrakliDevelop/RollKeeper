'use client';

import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { cn } from '@/utils/cn';
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
 * Below `md` the status tray shares the strip under the tool island, so the
 * panel and its pill sit beneath it (`--player-vtt-tray-height`); from `md` the
 * tray never reaches the panel column. Both variables fall back to today's
 * position, so nothing moves before the map mounts.
 */
const PANEL_TOP =
  'top-[calc(var(--player-vtt-panel-top,78px)+var(--player-vtt-tray-height,0px))] md:top-[var(--player-vtt-panel-top,78px)]';
const PANEL_MAX_HEIGHT =
  'max-h-[calc(100vh-var(--player-vtt-panel-top,78px)-var(--player-vtt-tray-height,0px)-1.5rem)] md:max-h-[calc(100vh-var(--player-vtt-panel-top,78px)-1.5rem)]';

/**
 * Player-facing combat panel for the VTT screen — a richer left-edge sibling
 * of `InitiativePanel`. Renders exactly what the (already-masked) shared
 * initiative state carries; never re-derives HP from raw numbers. An overlay
 * surface; its Tooltip needs the `TooltipProvider` that `PlayerVttScreen`
 * wraps around the floating panels.
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
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={false}
        onClick={onToggleCollapsed}
        className={cn(
          'bg-surface-elevated pointer-events-auto fixed left-4',
          PANEL_TOP
        )}
      >
        Combat
      </Button>
    );
  }

  return (
    <div
      className={cn(
        OVERLAY_SURFACE,
        'pointer-events-auto fixed left-4 flex w-[278px] flex-col overflow-hidden',
        PANEL_TOP,
        PANEL_MAX_HEIGHT
      )}
    >
      <div className="border-divider flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h2 className="type-ui text-heading">Combat</h2>
          <p className="type-small text-muted">
            Round {state.round} · {state.turnOrder.length} in order
          </p>
        </div>
        <Tooltip content="Collapse combat panel">
          <Button
            variant="ghost"
            size="sm"
            className="w-9 shrink-0 px-0"
            aria-label="Collapse combat panel"
            aria-expanded={true}
            onClick={onToggleCollapsed}
          >
            <ChevronLeft size={16} aria-hidden />
          </Button>
        </Tooltip>
      </div>
      <ul className="divide-divider flex-1 divide-y overflow-y-auto">
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
