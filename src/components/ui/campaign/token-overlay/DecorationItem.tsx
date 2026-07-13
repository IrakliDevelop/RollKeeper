'use client';

import { getHpTierBarColor } from '@/utils/hpColor';

import { ChipRow } from './ChipRow';
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
 * a centered skull when dead, and a chip row below the token with the name
 * plus an exact-numbers or label-state chip. In full mode the chip row is
 * always shown; in compact mode it only appears when `showChipRow` is set
 * (the token is hovered or tap-revealed — see `useCompactReveal`).
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
  return (
    <div style={{ opacity: deco.isDead ? 0.75 : 1 }}>
      {deco.isDead && <DeadGlyph rect={rect} cell={cell} />}
      {showBar && (
        <InTokenBar rect={rect} cell={cell} hp={deco.hp as BarLikeHp} />
      )}
      {!deco.isDead && deco.chessPiece && (
        <PieceGlyph rect={rect} deco={deco} />
      )}
      {shouldShowChipRow && <ChipRow rect={rect} cell={cell} deco={deco} />}
    </div>
  );
}
