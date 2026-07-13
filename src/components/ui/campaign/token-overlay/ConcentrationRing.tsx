'use client';

import type { DecoratedTokenRect } from './TokenDecorationLayer.hooks';

/**
 * Purple ring around a concentrating entity's token — spatial-tactical info
 * (who to hit to break it). Pulses; static under prefers-reduced-motion.
 */
export function ConcentrationRing({ rect }: { rect: DecoratedTokenRect }) {
  const outset = Math.max(2, rect.w * 0.04);
  return (
    <span
      data-testid="concentration-ring"
      className="border-accent-purple-border absolute block rounded-full border-2 motion-safe:animate-pulse"
      style={{
        left: rect.x - outset,
        top: rect.y - outset,
        width: rect.w + 2 * outset,
        height: rect.h + 2 * outset,
      }}
    />
  );
}
