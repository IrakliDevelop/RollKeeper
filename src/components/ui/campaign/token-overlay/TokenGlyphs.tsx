'use client';

import { CHESS_PIECES } from '@/components/ui/encounter/combat-screen/TokenChip';

import type { DecoratedTokenRect } from './TokenDecorationLayer.hooks';
import type { TokenDecoration } from './TokenDecorationLayer.types';

/** Skull glyph centered inside the token rect for a dead entity. */
export function DeadGlyph({
  rect,
  cell,
}: {
  rect: DecoratedTokenRect;
  cell: number;
}) {
  return (
    <span
      className="absolute flex items-center justify-center"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        fontSize: cell * 0.3,
        lineHeight: 1,
      }}
    >
      ☠️
    </span>
  );
}

/** Amber ⚡ badge in the token's top-right corner — reaction spent this round. */
export function ReactionUsedGlyph({
  rect,
  cell,
}: {
  rect: DecoratedTokenRect;
  cell: number;
}) {
  const size = Math.max(14, 0.28 * cell);
  const inset = Math.max(2, 0.04 * cell);
  return (
    <span
      data-testid="reaction-used-glyph"
      title="Reaction used"
      className="bg-surface-secondary/90 border-accent-amber-border text-accent-amber-text absolute flex items-center justify-center rounded-full border"
      style={{
        left: rect.x + rect.w - size - inset,
        top: rect.y + inset,
        width: size,
        height: size,
        fontSize: size * 0.6,
        lineHeight: 1,
      }}
    >
      ⚡
    </span>
  );
}

/** Chess piece icon centered inside the token rect — identity, not status. */
export function PieceGlyph({
  rect,
  deco,
}: {
  rect: DecoratedTokenRect;
  deco: TokenDecoration;
}) {
  const Icon = CHESS_PIECES.find(p => p.piece === deco.chessPiece)?.Icon;
  if (!Icon) return null;
  const size = 0.55 * Math.min(rect.w, rect.h);
  return (
    <span
      className="absolute flex items-center justify-center"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <Icon
        size={size}
        style={{
          color: deco.pieceColor ?? '#e2e8f0',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
        }}
      />
    </span>
  );
}
