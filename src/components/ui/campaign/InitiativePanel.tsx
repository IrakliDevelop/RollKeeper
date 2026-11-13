'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Swords,
  User,
  Skull,
  Shield,
  CircleDot,
  Map as MapIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { useDraggableY } from '@/hooks/useDraggableY';
import { getHpBarColor, getHpTierTextColor } from '@/utils/hpColor';
import { resolveEntryHpMode } from '@/utils/hpState';
import type { SharedInitiativeState } from '@/types/sharedState';

const OPEN_KEY = 'rollkeeper-initiative-panel-open';
const POS_KEY = 'rollkeeper-initiative-panel-y';
const DEFAULT_TOP = 120;

interface InitiativePanelProps {
  state: SharedInitiativeState | null;
  characterId: string; // the open character (its playerCharacterId)
  onEndTurn: (entityId: string) => void;
  /** When a battle map is live, link to it from the panel (replaces the
   * bottom banner once the player has joined the map). */
  battleMapHref?: string;
  bottomReservedHeight?: number;
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
  battleMapHref,
  bottomReservedHeight = 0,
}: InitiativePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Optimistic end-turn: the entity whose turn we locally advanced past while
  // waiting for the DM's synced state to catch up.
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const { topPx, containerRef, startDrag } = useDraggableY(
    POS_KEY,
    bottomReservedHeight + 120
  );
  const [viewportHeight, setViewportHeight] = useState(0);
  useEffect(() => {
    const updateHeight = () => setViewportHeight(window.innerHeight);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

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

  // Auto-open the panel when combat starts so players don't miss it.
  const isActive = !!state?.isActive;
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevActiveRef.current) setIsOpen(true);
    prevActiveRef.current = isActive;
  }, [isActive]);

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

  const maxTop = viewportHeight
    ? Math.max(8, viewportHeight - bottomReservedHeight - 120)
    : DEFAULT_TOP;
  const renderedTop = Math.min(topPx ?? DEFAULT_TOP, maxTop);
  const panelMaxHeight = viewportHeight
    ? Math.max(
        0,
        Math.min(
          viewportHeight * 0.7,
          viewportHeight - bottomReservedHeight - renderedTop - 8
        )
      )
    : undefined;

  const handleLabel = isOpen ? 'Hide initiative' : 'Show initiative';

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className="fixed right-0 z-[55] flex"
        style={{ top: renderedTop }}
      >
        {/* Toggle tab — sticks out to the left of the panel */}
        <Tooltip content={handleLabel} side="left">
          <button
            type="button"
            onClick={() => setIsOpen(o => !o)}
            aria-label={handleLabel}
            aria-expanded={isOpen}
            className={`flex flex-col items-center gap-1 self-center rounded-md rounded-r-none border border-r-0 px-2.5 py-5 transition-colors pointer-coarse:min-w-11 ${
              isMyTurn
                ? 'border-brass-border bg-brass-bg text-brass-text'
                : isOpen
                  ? 'border-divider bg-surface-elevated text-heading'
                  : 'border-divider bg-surface-elevated text-muted hover:text-body'
            }`}
          >
            <Swords size={20} aria-hidden />
            {!isOpen && (
              <span className="type-small font-semibold tabular-nums">
                {state.round}
              </span>
            )}
          </button>
        </Tooltip>

        {/* Panel wrapper — collapses width when closed */}
        <div
          className={`overflow-hidden transition-[width] duration-180 ease-out ${
            isOpen ? `${OVERLAY_SURFACE} rounded-r-none border-r-0` : ''
          }`}
          style={{ width: isOpen ? '241px' : '0px' }}
        >
          <div
            className="flex w-[240px] flex-col overflow-hidden"
            style={{ maxHeight: panelMaxHeight }}
          >
            {/* Header — also the vertical drag handle */}
            <div
              onPointerDown={startDrag}
              className="border-divider flex flex-shrink-0 cursor-grab touch-none items-center gap-2 border-b px-3 py-2.5 select-none active:cursor-grabbing"
            >
              <Swords size={14} className="text-muted" aria-hidden />
              <span className="type-ui text-heading font-semibold">
                Combat · Round {state.round}
              </span>
            </div>

            {/* Battle map shortcut — the join banner hides once joined */}
            {battleMapHref && (
              <Link
                href={battleMapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="border-divider text-body hover:bg-surface-hover type-small flex min-h-9 flex-shrink-0 items-center gap-2 border-b px-3 font-medium pointer-coarse:min-h-11"
              >
                <MapIcon size={14} className="text-muted" aria-hidden />
                Open battle map
              </Link>
            )}

            {/* Turn order */}
            <ul className="flex-1 overflow-y-auto py-1">
              {state.turnOrder.map(entry => {
                const isCurrent = entry.entityId === effectiveCurrentId;
                const isYou = entry.playerCharacterId === characterId;
                const isPlayer = entry.type === 'player';
                const isDead = entry.isDead === true;
                const isCurrentAlive = isCurrent && !isDead;
                // Player-facing allegiance (disguise): icon by side.
                const disposition = entry.disposition ?? 'enemy';
                const hp = entry.currentHp;
                const maxHp = entry.maxHp;
                const hasHp = hp !== undefined && maxHp !== undefined;
                // A DM per-entity override on the entry wins over the
                // campaign-wide mode.
                const hpMode = resolveEntryHpMode(entry, state.enemyHpMode);
                // Right-aligned HP summary. Dead overrides everything.
                const hpText = isDead
                  ? isPlayer
                    ? 'Down'
                    : 'Defeated'
                  : hasHp
                    ? `${hp}/${maxHp}`
                    : entry.hpPercent !== undefined && hpMode === 'percent'
                      ? `${entry.hpPercent}%`
                      : (entry.hpState ?? null);
                // Colour: dead = blood; an exact-HP bar carries its own colour
                // (muted text), otherwise tint the text by health tier.
                const hpTextColor = isDead
                  ? 'text-blood-text font-medium'
                  : hasHp
                    ? 'text-muted'
                    : entry.hpTier
                      ? getHpTierTextColor(entry.hpTier)
                      : 'text-muted';
                // Bar for players (real HP) and enemy 'bar' mode (%). Hidden when dead.
                const barPercent = isDead
                  ? null
                  : hasHp
                    ? maxHp > 0
                      ? Math.min(100, (hp / maxHp) * 100)
                      : 0
                    : !isPlayer &&
                        hpMode === 'bar' &&
                        entry.hpPercent !== undefined
                      ? entry.hpPercent
                      : null;
                return (
                  <li
                    key={entry.entityId}
                    aria-current={isCurrentAlive ? 'true' : undefined}
                    className={`flex flex-col gap-1 border-l-2 px-3 py-1.5 ${
                      isCurrentAlive
                        ? 'bg-brass-bg border-brass-border'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isDead ? (
                        <Skull
                          size={13}
                          className="text-blood-text shrink-0"
                          aria-hidden
                        />
                      ) : isPlayer ? (
                        <User
                          size={13}
                          className="text-muted shrink-0"
                          aria-hidden
                        />
                      ) : disposition === 'ally' ? (
                        <Shield
                          size={13}
                          className="text-muted shrink-0"
                          role="img"
                          aria-label="Ally"
                        />
                      ) : disposition === 'neutral' ? (
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
                        className={`type-ui truncate ${
                          isDead
                            ? 'text-muted line-through'
                            : isCurrent
                              ? 'text-heading font-semibold'
                              : isPlayer
                                ? 'text-heading font-medium'
                                : 'text-heading'
                        }`}
                      >
                        {entry.displayName}
                        {isYou && (
                          <span className="text-muted ml-1 font-normal">
                            (you)
                          </span>
                        )}
                      </span>
                      {hpText && (
                        <span
                          className={`type-small ml-auto whitespace-nowrap ${hpTextColor}`}
                        >
                          {hpText}
                        </span>
                      )}
                    </div>
                    {isCurrentAlive && (
                      <span className="type-small text-brass-text ml-[21px]">
                        Current turn
                      </span>
                    )}
                    {barPercent !== null && (
                      <span className="bg-divider ml-[21px] block h-1">
                        <span
                          className={`block h-full transition-[width] ${getHpBarColor(barPercent, 100)}`}
                          style={{ width: `${barPercent}%` }}
                        />
                      </span>
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
    </TooltipProvider>
  );
}
