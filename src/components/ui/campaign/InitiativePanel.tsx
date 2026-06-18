'use client';

import { useState, useEffect } from 'react';
import { Swords, User, Skull } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { useDraggableY } from '@/hooks/useDraggableY';
import { getHpBarColor } from '@/utils/hpColor';
import type { SharedInitiativeState } from '@/types/sharedState';

const OPEN_KEY = 'rollkeeper-initiative-panel-open';
const POS_KEY = 'rollkeeper-initiative-panel-y';
const DEFAULT_TOP = 120;

interface InitiativePanelProps {
  state: SharedInitiativeState | null;
  characterId: string; // the open character (its playerCharacterId)
  onEndTurn: (entityId: string) => void;
}

/** The entity whose turn comes after `fromId` in the turn order (wraps). */
function nextEntityId(
  turnOrder: SharedInitiativeState['turnOrder'],
  fromId: string
): string {
  if (turnOrder.length === 0) return fromId;
  const idx = turnOrder.findIndex(t => t.entityId === fromId);
  if (idx === -1) return fromId;
  return turnOrder[(idx + 1) % turnOrder.length].entityId;
}

/**
 * Player-facing combat panel. Renders only while combat is active, as a thin,
 * collapsible sidebar pinned to the right edge (mirrors PartyHPSidebar). The
 * header doubles as a vertical drag handle so it can be moved up/down out of the
 * way; open state and vertical position persist to localStorage.
 */
export function InitiativePanel({
  state,
  characterId,
  onEndTurn,
}: InitiativePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Optimistic end-turn: the entity whose turn we locally advanced past while
  // waiting for the DM's synced state to catch up.
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const { topPx, containerRef, startDrag } = useDraggableY(POS_KEY);

  // Load persisted open state (default open).
  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) !== 'false') setIsOpen(true);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, String(isOpen));
    } catch {
      // Ignore localStorage errors
    }
  }, [isOpen]);

  // Reconcile: once the synced state moves off the turn we ended (or combat
  // ends), drop the optimistic override and follow the source of truth.
  const syncedCurrentId = state?.currentEntityId ?? null;
  useEffect(() => {
    if (pendingFrom !== null && syncedCurrentId !== pendingFrom) {
      setPendingFrom(null);
    }
  }, [syncedCurrentId, pendingFrom]);

  if (!state || !state.isActive) return null;

  // While an end-turn is in flight, highlight the next combatant locally so the
  // player gets instant feedback instead of waiting for the next poll.
  const isOptimistic =
    pendingFrom !== null && state.currentEntityId === pendingFrom;
  const effectiveCurrentId = isOptimistic
    ? nextEntityId(state.turnOrder, pendingFrom)
    : state.currentEntityId;

  const activeEntry = state.turnOrder.find(
    t => t.entityId === effectiveCurrentId
  );
  const isMyTurn =
    !!activeEntry && activeEntry.playerCharacterId === characterId;

  const handleEndTurnClick = () => {
    if (!activeEntry) return;
    onEndTurn(activeEntry.entityId);
    setPendingFrom(state.currentEntityId);
  };

  return (
    <div
      ref={containerRef}
      className="fixed right-0 z-[55] flex"
      style={{ top: topPx ?? DEFAULT_TOP }}
    >
      {/* Toggle tab — sticks out to the left of the panel */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Hide initiative' : 'Show initiative'}
        title={isOpen ? 'Hide initiative' : 'Show initiative'}
        className={`relative self-center rounded-l-lg border-y-2 border-l-2 px-2.5 py-5 shadow-md transition-colors ${
          isMyTurn
            ? 'border-accent-amber-border bg-accent-amber-bg text-accent-amber-text animate-pulse'
            : isOpen
              ? 'border-accent-red-border bg-accent-red-bg text-accent-red-text'
              : 'border-divider bg-surface-raised text-muted hover:text-body hover:bg-surface-secondary'
        }`}
      >
        <Swords size={20} />
        {!isOpen && (
          <span className="bg-accent-red-bg text-accent-red-text border-accent-red-border absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[10px] font-bold">
            {state.round}
          </span>
        )}
      </button>

      {/* Panel wrapper — collapses width when closed */}
      <div
        className="overflow-hidden transition-[width] duration-300 ease-in-out"
        style={{ width: isOpen ? '240px' : '0px' }}
      >
        <div className="border-divider bg-surface-raised flex max-h-[70vh] w-[240px] flex-col overflow-hidden rounded-l-xl border-y-2 border-l-2 shadow-lg">
          {/* Header — also the vertical drag handle */}
          <div
            onPointerDown={startDrag}
            className="border-divider flex flex-shrink-0 cursor-grab touch-none items-center gap-2 border-b px-3 py-2.5 select-none active:cursor-grabbing"
          >
            <Swords size={14} className="text-accent-red-text" />
            <span className="text-heading text-sm font-semibold">
              Combat · Round {state.round}
            </span>
          </div>

          {/* Turn order */}
          <ul className="flex-1 overflow-y-auto py-1">
            {state.turnOrder.map(entry => {
              const isCurrent = entry.entityId === effectiveCurrentId;
              const isYou = entry.playerCharacterId === characterId;
              const isPlayer = entry.type === 'player';
              const hp = entry.currentHp;
              const maxHp = entry.maxHp;
              const hasHp = hp !== undefined && maxHp !== undefined;
              return (
                <li
                  key={entry.entityId}
                  className={`flex flex-col gap-1 px-3 py-1.5 ${
                    isCurrent
                      ? 'bg-accent-amber-bg border-accent-amber-border border-l-2'
                      : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isPlayer ? (
                      <User
                        size={13}
                        className="text-accent-blue-text shrink-0"
                      />
                    ) : (
                      <Skull size={13} className="text-faint shrink-0" />
                    )}
                    {isCurrent && (
                      <span aria-hidden className="text-accent-amber-text">
                        ▶
                      </span>
                    )}
                    <span
                      className={`truncate text-sm ${
                        isCurrent
                          ? 'text-accent-amber-text font-semibold'
                          : isPlayer
                            ? 'text-heading font-medium'
                            : 'text-muted'
                      }`}
                    >
                      {entry.displayName}
                      {isYou && (
                        <span className="text-muted ml-1 font-normal">
                          (you)
                        </span>
                      )}
                    </span>
                    {hasHp && (
                      <span className="text-faint ml-auto text-xs whitespace-nowrap">
                        {hp}/{maxHp}
                      </span>
                    )}
                  </div>
                  {isPlayer && hasHp && (
                    <div className="bg-surface-secondary ml-[21px] h-1.5 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full transition-all ${getHpBarColor(hp, maxHp)}`}
                        style={{
                          width: `${maxHp > 0 ? Math.min(100, (hp / maxHp) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* End my turn — only on the open character's turn */}
          {isMyTurn && (
            <div className="border-divider flex-shrink-0 border-t p-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={handleEndTurnClick}
              >
                End my turn
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
