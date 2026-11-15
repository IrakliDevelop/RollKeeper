'use client';

import type { DecoratedTokenRect } from './TokenDecorationLayer.hooks';

/**
 * Lapis ring around a concentrating entity's token — spatial-tactical info
 * (who to hit to break it). Static.
 */
export function ConcentrationRing({ rect }: { rect: DecoratedTokenRect }) {
  const outset = Math.max(2, rect.w * 0.04);
  return (
    <span
      data-testid="concentration-ring"
      className="border-lapis-border absolute block rounded-full border-2"
      style={{
        left: rect.x - outset,
        top: rect.y - outset,
        width: rect.w + 2 * outset,
        height: rect.h + 2 * outset,
      }}
    />
  );
}
