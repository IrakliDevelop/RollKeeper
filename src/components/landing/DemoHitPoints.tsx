'use client';

import { useHpDamageFlash } from '@/hooks/useHpDamageFlash';
import { cn } from '@/utils/cn';
import {
  getHpBarColor,
  getHpNumberColor,
  getHpTierTextColor,
} from '@/utils/hpColor';
import { HP_STATUS_LABELS, hpPercent, hpStatus, hpTier } from '@/utils/hpState';

interface DemoHitPointsProps {
  current: number;
  max: number;
  temporary: number;
}

/**
 * The sample character's hit points, drawn like the sheet's HUD tile
 * (`HudHitPoints`) but as plain text: on the landing page it opens nothing.
 */
export function DemoHitPoints({ current, max, temporary }: DemoHitPointsProps) {
  const flashCount = useHpDamageFlash({ id: 'landing-sample', current, max });
  const percent = hpPercent(current, max);
  const word = HP_STATUS_LABELS[hpStatus(current, max)];

  return (
    <div
      className="relative isolate flex flex-col gap-1"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        key={flashCount}
        data-hp-flash=""
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -inset-2 -z-10 rounded-sm',
          flashCount > 0 && 'animate-rk-hp-flash'
        )}
      />
      <p className="flex items-baseline gap-1 whitespace-nowrap">
        <span className="sr-only">Hit points </span>
        <span className={cn('type-num-xl', getHpNumberColor(current, max))}>
          {current}
        </span>
        <span className="type-body text-faint" aria-hidden="true">
          /
        </span>
        <span className="sr-only">of</span>
        <span className="type-body text-body">{max}</span>
        {temporary > 0 && (
          <span className="type-body text-frost-text ml-1">
            +{temporary} temp
          </span>
        )}
      </p>
      <span className="bg-divider block h-1 w-full" aria-hidden="true">
        <span
          className={cn(
            'block h-full transition-[width] duration-120 ease-out',
            getHpBarColor(current, max)
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
      <p className={cn('type-small', getHpTierTextColor(hpTier(percent)))}>
        {word}
      </p>
    </div>
  );
}
