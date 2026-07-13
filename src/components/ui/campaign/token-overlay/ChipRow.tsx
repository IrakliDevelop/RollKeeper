'use client';

import { getHpTierTextColor } from '@/utils/hpColor';

import type { DecoratedTokenRect } from './TokenDecorationLayer.hooks';
import type { TokenDecoration } from './TokenDecorationLayer.types';

/**
 * One chip row centered below the token: name + exact numbers/label chip.
 * The row is sized to its content (`width: max-content`) rather than clamped
 * to the token width, so short-to-medium names render unclipped; it's capped
 * at 4 cells so it never runs away, and each chip keeps its own
 * overflow/ellipsis as a safety net for a truly huge name.
 */
export function ChipRow({
  rect,
  cell,
  deco,
  conditionNames,
}: {
  rect: DecoratedTokenRect;
  cell: number;
  deco: TokenDecoration;
  /** Compact-reveal only: joined condition names shown as one chip. */
  conditionNames?: string[];
}) {
  const showHpChip = !deco.isDead && deco.hp;
  return (
    <div
      className="absolute flex flex-row flex-wrap items-center justify-center"
      style={{
        left: rect.x + rect.w / 2,
        top: rect.y + rect.h + cell * 0.06,
        transform: 'translateX(-50%)',
        width: 'max-content',
        maxWidth: 4 * cell,
        gap: cell * 0.05,
      }}
    >
      {deco.name && (
        <span
          className="bg-surface-raised/90 border-divider text-heading overflow-hidden rounded-full border font-semibold text-ellipsis whitespace-nowrap"
          style={{
            fontSize: cell * 0.24,
            padding: `0 ${cell * 0.15}px`,
            maxWidth: 4 * cell,
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
      {conditionNames && conditionNames.length > 0 && (
        <span
          className="bg-surface-raised/90 border-divider text-body overflow-hidden rounded-full border text-ellipsis whitespace-nowrap"
          style={{
            fontSize: cell * 0.2,
            padding: `0 ${cell * 0.12}px`,
            maxWidth: 4 * cell,
          }}
        >
          {conditionNames.join(' · ')}
        </span>
      )}
    </div>
  );
}
