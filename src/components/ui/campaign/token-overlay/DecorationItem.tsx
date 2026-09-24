'use client';

import { memo, useEffect, useRef, useState, type MouseEvent } from 'react';

import { getHpTierBarColor } from '@/utils/hpColor';

import { ChipRow } from './ChipRow';
import { ConcentrationRing } from './ConcentrationRing';
import { ConditionStrip } from './ConditionStrip';
import { TokenConditionsDialog } from './TokenConditionsDialog';
import { DeadGlyph, PieceGlyph, ReactionUsedGlyph } from './TokenGlyphs';

import type { DecoratedTokenRect } from './TokenDecorationLayer.hooks';
import type {
  TokenDecoration,
  TokenHpView,
  TokenInfoMode,
} from './TokenDecorationLayer.types';

interface DecorationItemProps {
  rect: DecoratedTokenRect;
  deco: TokenDecoration;
  mode: TokenInfoMode;
  cell: number;
  /** Compact mode only: render the chip row for this rect (hovered/revealed). */
  showChipRow?: boolean;
  zoom?: number;
}

type BarLikeHp = Extract<TokenHpView, { kind: 'bar' | 'exact' }>;

/** HP bar rendered INSIDE the token, flush to its bottom edge. */
function InTokenBar({
  rect,
  cell,
  hp,
}: {
  rect: DecoratedTokenRect;
  cell: number;
  hp: BarLikeHp;
}) {
  const inset = Math.max(2, 0.05 * cell);
  const barHeight = 0.12 * cell;
  return (
    <span
      role="progressbar"
      aria-valuenow={Math.round(hp.percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-surface-secondary/90 border-divider absolute block overflow-hidden rounded-full border"
      style={{
        left: rect.x + inset,
        top: rect.y + rect.h - barHeight - inset,
        width: rect.w - 2 * inset,
        height: barHeight,
      }}
    >
      <span
        className={`block h-full ${getHpTierBarColor(hp.tier)}`}
        style={{ width: `${hp.percent}%` }}
      />
    </span>
  );
}

/**
 * One token's decoration: an in-token HP bar (full/compact, bar/exact kinds),
 * a centered skull when dead, a condition icon strip inside the top edge, a
 * concentration ring around the token, and a chip row below the token with
 * the name plus an exact-numbers or label-state chip. In full mode the chip
 * row is always shown; in compact mode it appears when `showChipRow` is set
 * (the token is hovered or tap-revealed — see `useCompactReveal`). Condition
 * icons remain visible in both modes; the revealed row offers a larger
 * touch target to inspect all conditions. The
 * concentration ring and the reaction-used corner badge show in both full and
 * compact modes. Dead entities keep skull precedence: no strip, no ring, no
 * piece glyph, no reaction badge.
 */
export const DecorationItem = memo(function DecorationItem({
  rect,
  deco,
  mode,
  cell,
  showChipRow,
  zoom = 1,
}: DecorationItemProps) {
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const conditionTrigger = useRef<HTMLButtonElement | null>(null);
  const handleInspectConditions = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    conditionTrigger.current = event.currentTarget;
    setConditionsOpen(true);
  };
  const showBar =
    !deco.isDead &&
    deco.hp &&
    (deco.hp.kind === 'bar' || deco.hp.kind === 'exact');
  const shouldShowChipRow = mode === 'full' || showChipRow === true;
  const conditions = deco.isDead ? undefined : deco.conditions;
  const hasConditions = conditions !== undefined && conditions.length > 0;
  useEffect(() => {
    if (!hasConditions) setConditionsOpen(false);
  }, [hasConditions]);
  return (
    <div
      data-testid={`token-decoration-${rect.key}`}
      style={{ opacity: deco.isDead ? 0.75 : 1 }}
    >
      {!deco.isDead && deco.isConcentrating && (
        <ConcentrationRing rect={rect} />
      )}
      {deco.isDead && <DeadGlyph rect={rect} cell={cell} />}
      {showBar && (
        <InTokenBar rect={rect} cell={cell} hp={deco.hp as BarLikeHp} />
      )}
      {!deco.isDead && deco.chessPiece && (
        <PieceGlyph rect={rect} deco={deco} />
      )}
      {hasConditions && (
        <ConditionStrip
          rect={rect}
          cell={cell}
          conditions={conditions}
          onInspect={handleInspectConditions}
        />
      )}
      {/* After ConditionStrip: this layer stacks by DOM order (no z-index),
          and a full-width strip would otherwise paint over the corner badge. */}
      {!deco.isDead && deco.hasUsedReaction && (
        <ReactionUsedGlyph rect={rect} cell={cell} />
      )}
      {shouldShowChipRow && (
        <ChipRow
          rect={rect}
          cell={cell}
          deco={deco}
          conditionNames={
            mode === 'compact' && hasConditions
              ? conditions.map(c => c.name)
              : undefined
          }
          onInspectConditions={
            hasConditions ? handleInspectConditions : undefined
          }
          zoom={zoom}
        />
      )}
      {hasConditions && (
        <TokenConditionsDialog
          open={conditionsOpen}
          onOpenChange={setConditionsOpen}
          name={deco.name}
          conditions={conditions}
          onCloseAutoFocus={event => {
            event.preventDefault();
            conditionTrigger.current?.focus();
          }}
        />
      )}
    </div>
  );
});
