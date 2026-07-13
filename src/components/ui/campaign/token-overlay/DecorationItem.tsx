'use client';

import { getHpTierBarColor } from '@/utils/hpColor';

import { ChipRow } from './ChipRow';
import { ConcentrationRing } from './ConcentrationRing';
import { ConditionStrip } from './ConditionStrip';
import { DeadGlyph, PieceGlyph } from './TokenGlyphs';

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
 * row and condition strip are always shown; in compact mode they only appear
 * when `showChipRow` is set (the token is hovered or tap-revealed — see
 * `useCompactReveal`), where the chip row instead lists condition names. The
 * concentration ring shows in both full and compact modes. Dead entities keep
 * skull precedence: no strip, no ring, no piece glyph.
 */
export function DecorationItem({
  rect,
  deco,
  mode,
  cell,
  showChipRow,
}: DecorationItemProps) {
  const showBar =
    !deco.isDead &&
    deco.hp &&
    (deco.hp.kind === 'bar' || deco.hp.kind === 'exact');
  const shouldShowChipRow = mode === 'full' || showChipRow === true;
  const conditions = deco.isDead ? undefined : deco.conditions;
  const hasConditions = conditions !== undefined && conditions.length > 0;
  return (
    <div style={{ opacity: deco.isDead ? 0.75 : 1 }}>
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
      {hasConditions && shouldShowChipRow && (
        <ConditionStrip rect={rect} cell={cell} conditions={conditions} />
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
        />
      )}
    </div>
  );
}
