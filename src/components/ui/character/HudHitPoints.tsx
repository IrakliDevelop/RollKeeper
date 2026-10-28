'use client';

import { useId } from 'react';
import {
  getHpBarColor,
  getHpNumberColor,
  getHpTierTextColor,
} from '@/utils/hpColor';
import { HP_STATUS_LABELS, hpPercent, hpStatus, hpTier } from '@/utils/hpState';
import { cn } from '@/utils/cn';
import { useHpDamageFlash } from '@/hooks/useHpDamageFlash';

export interface HudHitPointsProps {
  /** The character's id: switching character never flashes. */
  characterId: string;
  current: number;
  max: number;
  temporary: number;
  onClick?: () => void;
}

/**
 * The HUD's hit points: the current value coloured by tier over "/ max",
 * temporary HP as "+5 temp", a 4px tier bar and the tier word. The whole
 * block is the button that opens the Combat tab. With no max HP set there
 * is no tier, so it shows the number plainly over an empty track. Each
 * hit flashes the tile blood for 180ms (`useHpDamageFlash`); the flash is
 * a re-keyed layer inside the button, so a focused button keeps focus.
 */
export function HudHitPoints({
  characterId,
  current,
  max,
  temporary,
  onClick,
}: HudHitPointsProps) {
  const tempId = useId();
  const flashCount = useHpDamageFlash({ id: characterId, current, max });
  const hasMax = max > 0;
  const percent = hpPercent(current, max);
  const status = hasMax ? hpStatus(current, max) : undefined;
  const word = status && HP_STATUS_LABELS[status];
  const label = word
    ? `Hit points ${current} of ${max}, ${word}. Open the Combat tab`
    : `Hit points ${current} of ${max}. Open the Combat tab`;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Go to Combat tab"
      aria-label={label}
      aria-describedby={temporary > 0 ? tempId : undefined}
      data-hp-status={status}
      className="border-divider hover:bg-surface-hover focus-visible:outline-ring relative isolate flex cursor-pointer flex-col justify-center gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span
        key={flashCount}
        data-hp-flash=""
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 -z-10 rounded-lg',
          flashCount > 0 && 'animate-rk-hp-flash'
        )}
      />
      <span className="flex items-baseline gap-1 whitespace-nowrap">
        <span
          className={cn(
            'type-num-xl',
            hasMax ? getHpNumberColor(current, max) : 'text-heading'
          )}
        >
          {current}
        </span>
        <span className="type-body text-faint">/</span>
        <span className="type-body text-body">{max}</span>
        {temporary > 0 && (
          <span id={tempId} className="type-body text-frost-text ml-1">
            +{temporary} temp
          </span>
        )}
      </span>
      <span className="bg-divider block h-1 w-full">
        <span
          data-part="bar"
          className={cn(
            'block h-full transition-[width] duration-120 ease-out',
            getHpBarColor(current, max)
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
      {word && (
        <span
          className={cn(
            'type-caption whitespace-nowrap',
            getHpTierTextColor(hpTier(percent))
          )}
        >
          {word}
        </span>
      )}
    </button>
  );
}
