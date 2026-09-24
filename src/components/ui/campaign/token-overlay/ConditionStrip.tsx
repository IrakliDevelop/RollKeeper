'use client';

import type { MouseEventHandler } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { getConditionIcon } from '@/utils/conditionIcons';

import type { DecoratedTokenRect } from './TokenDecorationLayer.hooks';
import type { SharedCondition } from '@/types/sharedState';

const MAX_ICONS = 4;

interface ConditionStripProps {
  rect: DecoratedTokenRect;
  cell: number;
  conditions: SharedCondition[];
  onInspect: MouseEventHandler<HTMLButtonElement>;
}

/**
 * Row of condition icon bubbles inside the token's top edge (mirroring the
 * HP bar inside the bottom edge). Reserves room for a clickable overflow
 * count so every condition remains reachable even on a small token.
 */
export function ConditionStrip({
  rect,
  cell,
  conditions,
  onInspect,
}: ConditionStripProps) {
  const inset = Math.max(2, 0.05 * cell);
  const size = 0.26 * cell;
  const gap = 0.03 * cell;
  const available = Math.max(size, rect.w - 2 * inset);
  const slots = Math.max(1, Math.floor((available + gap) / (size + gap)));
  const limit = Math.min(MAX_ICONS, slots);
  const shownCount =
    conditions.length > limit ? Math.min(MAX_ICONS, slots - 1) : limit;
  const shown = conditions.slice(0, shownCount);
  const overflow = conditions.length - shown.length;
  return (
    <TooltipProvider>
      <span
        className="absolute flex flex-row items-center"
        style={{
          left: rect.x + inset,
          top: rect.y + inset,
          gap,
          maxWidth: available,
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
              className="max-w-xs break-words whitespace-pre-wrap"
            >
              <Button
                variant="ghost"
                aria-label={tooltipText}
                aria-haspopup="dialog"
                onPointerDown={event => event.stopPropagation()}
                onClick={onInspect}
                className="bg-surface-raised/90 border-divider text-body pointer-events-auto relative shrink-0 rounded-full border p-0"
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
              </Button>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <Button
            variant="ghost"
            aria-label={`View all ${conditions.length} conditions`}
            aria-haspopup="dialog"
            onPointerDown={event => event.stopPropagation()}
            onClick={onInspect}
            className="bg-surface-raised/90 border-divider text-body pointer-events-auto shrink-0 rounded-full border p-0 font-semibold"
            style={{
              height: size,
              width: size,
              fontSize: size * 0.55,
            }}
          >
            +{overflow}
          </Button>
        )}
      </span>
    </TooltipProvider>
  );
}
