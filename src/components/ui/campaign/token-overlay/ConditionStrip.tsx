'use client';

import { getConditionIcon } from '@/utils/conditionIcons';

import type { DecoratedTokenRect } from './TokenDecorationLayer.hooks';
import type { SharedCondition } from '@/types/sharedState';

const MAX_ICONS = 4;

interface ConditionStripProps {
  rect: DecoratedTokenRect;
  cell: number;
  conditions: SharedCondition[];
}

/**
 * Row of condition icon bubbles inside the token's top edge (mirroring the
 * HP bar inside the bottom edge). Caps at 4 icons + a "+N" overflow chip.
 */
export function ConditionStrip({
  rect,
  cell,
  conditions,
}: ConditionStripProps) {
  const inset = Math.max(2, 0.05 * cell);
  const size = 0.26 * cell;
  const shown = conditions.slice(0, MAX_ICONS);
  const overflow = conditions.length - shown.length;
  return (
    <span
      className="absolute flex flex-row items-center"
      style={{
        left: rect.x + inset,
        top: rect.y + inset,
        gap: 0.03 * cell,
        maxWidth: rect.w - 2 * inset,
      }}
    >
      {shown.map(c => {
        const Icon = getConditionIcon(c.name, c.kind);
        return (
          <span
            key={c.name}
            className="bg-surface-raised/90 border-divider text-body relative flex items-center justify-center rounded-full border"
            style={{ width: size, height: size }}
          >
            <Icon style={{ width: size * 0.7, height: size * 0.7 }} />
            {c.stackCount !== undefined && c.stackCount > 1 && (
              <span
                className="bg-surface-raised text-heading absolute rounded-full leading-none font-semibold"
                style={{
                  fontSize: size * 0.5,
                  right: -size * 0.2,
                  top: -size * 0.2,
                  padding: size * 0.08,
                }}
              >
                {c.stackCount}
              </span>
            )}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          className="bg-surface-raised/90 border-divider text-body flex items-center justify-center rounded-full border font-semibold"
          style={{
            height: size,
            fontSize: size * 0.55,
            padding: `0 ${size * 0.25}px`,
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
