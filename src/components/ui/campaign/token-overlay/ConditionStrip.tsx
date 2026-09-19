'use client';

import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
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
    <TooltipProvider>
      <span
        className="absolute flex flex-row items-center overflow-hidden"
        style={{
          left: rect.x + inset,
          top: rect.y + inset,
          gap: 0.03 * cell,
          maxWidth: rect.w - 2 * inset,
        }}
      >
        {shown.map((c, i) => {
          const Icon = getConditionIcon(c.name, c.kind, c.icon);
          const tooltipText = c.description
            ? `${c.name}: ${c.description}`
            : c.name;
          return (
            <Tooltip
              key={`${c.name}-${i}`}
              content={tooltipText}
              side="top"
              delayDuration={150}
            >
              <span
                aria-label={tooltipText}
                tabIndex={0}
                className="bg-surface-raised/90 border-divider text-body focus-visible:ring-ring pointer-events-auto relative flex shrink-0 items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none"
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
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <span
            className="bg-surface-raised/90 border-divider text-body flex shrink-0 items-center justify-center rounded-full border font-semibold"
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
    </TooltipProvider>
  );
}
