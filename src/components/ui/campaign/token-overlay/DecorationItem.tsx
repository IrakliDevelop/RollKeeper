'use client';

import { getHpTierBarColor, getHpTierTextColor } from '@/utils/hpColor';

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

/** Skull glyph centered inside the token rect for a dead entity. */
function DeadGlyph({ rect, cell }: { rect: DecoratedTokenRect; cell: number }) {
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

/** One chip row centered below the token: name + exact numbers/label chip. */
function ChipRow({
  rect,
  cell,
  deco,
}: {
  rect: DecoratedTokenRect;
  cell: number;
  deco: TokenDecoration;
}) {
  // Min-width clamp keeps chips legible on 1×1 tokens.
  const width = Math.max(rect.w, 0.9 * cell);
  const showHpChip = !deco.isDead && deco.hp;
  return (
    <div
      className="absolute flex flex-row flex-wrap items-center justify-center"
      style={{
        left: rect.x + rect.w / 2 - width / 2,
        top: rect.y + rect.h + cell * 0.06,
        width,
        gap: cell * 0.05,
      }}
    >
      {deco.name && (
        <span
          className="bg-surface-raised/90 border-divider text-heading overflow-hidden rounded-full border font-semibold text-ellipsis whitespace-nowrap"
          style={{
            fontSize: cell * 0.24,
            padding: `0 ${cell * 0.15}px`,
            maxWidth: 3 * cell,
          }}
        >
          {deco.name}
        </span>
      )}
      {showHpChip && deco.hp?.kind === 'exact' && (
        <span
          className="bg-surface-raised/90 text-heading rounded-full font-semibold whitespace-nowrap"
          style={{ fontSize: cell * 0.2, padding: `0 ${cell * 0.12}px` }}
        >
          {deco.hp.current}/{deco.hp.max}
        </span>
      )}
      {showHpChip && deco.hp?.kind === 'label' && (
        <span
          className={`bg-surface-raised/90 border-divider rounded-full border font-semibold whitespace-nowrap ${getHpTierTextColor(deco.hp.tier)}`}
          style={{ fontSize: cell * 0.22, padding: `0 ${cell * 0.15}px` }}
        >
          {deco.hp.text}
        </span>
      )}
    </div>
  );
}

/**
 * One token's decoration: an in-token HP bar (full/compact, bar/exact kinds),
 * a centered skull when dead, and — full mode only — a single chip row below
 * the token with the name plus an exact-numbers or label-state chip.
 */
export function DecorationItem({
  rect,
  deco,
  mode,
  cell,
}: DecorationItemProps) {
  const showBar =
    !deco.isDead &&
    deco.hp &&
    (deco.hp.kind === 'bar' || deco.hp.kind === 'exact');
  return (
    <div style={{ opacity: deco.isDead ? 0.75 : 1 }}>
      {deco.isDead && <DeadGlyph rect={rect} cell={cell} />}
      {showBar && (
        <InTokenBar rect={rect} cell={cell} hp={deco.hp as BarLikeHp} />
      )}
      {mode === 'full' && <ChipRow rect={rect} cell={cell} deco={deco} />}
    </div>
  );
}
