'use client';

import type { MoonPhaseName } from '@/types/calendar';
import { MOON_PHASE_LABELS } from '@/types/calendar';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';

const MOON_PHASE_EMOJI: Record<MoonPhaseName, string> = {
  'new-moon': '🌑',
  'waxing-crescent': '🌒',
  'first-quarter': '🌓',
  'waxing-gibbous': '🌔',
  'full-moon': '🌕',
  'waning-gibbous': '🌖',
  'last-quarter': '🌗',
  'waning-crescent': '🌘',
};

interface MoonPhaseIconProps {
  phase: MoonPhaseName;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  moonName?: string;
}

const SIZE_CLASSES = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
};

export function MoonPhaseIcon({
  phase,
  size = 'md',
  label,
  moonName,
}: MoonPhaseIconProps) {
  const tooltipText = moonName
    ? `${moonName}: ${MOON_PHASE_LABELS[phase]}`
    : (label ?? MOON_PHASE_LABELS[phase]);

  return (
    <TooltipProvider>
      <Tooltip content={tooltipText} side="top" delayDuration={150}>
        <span
          role="img"
          aria-label={label ?? MOON_PHASE_LABELS[phase]}
          className={`${SIZE_CLASSES[size]} cursor-default`}
        >
          {MOON_PHASE_EMOJI[phase]}
        </span>
      </Tooltip>
    </TooltipProvider>
  );
}
