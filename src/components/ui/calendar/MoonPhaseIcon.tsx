'use client';

import type { MoonPhaseName } from '@/types/calendar';
import { MOON_PHASE_LABELS } from '@/types/calendar';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';

interface MoonPhaseIconProps {
  phase: MoonPhaseName;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  moonName?: string;
}

const SIZE_CLASSES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

const PHASE_PATHS: Record<MoonPhaseName, string | null> = {
  'new-moon': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  'waxing-crescent': 'M12 3a9 9 0 0 0 0 18c3.2-3.1 3.2-14.9 0-18Z',
  'first-quarter': 'M12 3a9 9 0 0 0 0 18Z',
  'waxing-gibbous': 'M12 3a9 9 0 0 0 0 18c-3.2-3.1-3.2-14.9 0-18Z',
  'full-moon': null,
  'waning-gibbous': 'M12 3a9 9 0 0 1 0 18c3.2-3.1 3.2-14.9 0-18Z',
  'last-quarter': 'M12 3a9 9 0 0 1 0 18Z',
  'waning-crescent': 'M12 3a9 9 0 0 1 0 18c-3.2-3.1-3.2-14.9 0-18Z',
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
        <svg
          role="img"
          aria-label={label ?? MOON_PHASE_LABELS[phase]}
          viewBox="0 0 24 24"
          className={`${SIZE_CLASSES[size]} cursor-default`}
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="currentColor"
            opacity={phase === 'full-moon' ? 0.25 : 0.12}
          />
          {PHASE_PATHS[phase] && (
            <path d={PHASE_PATHS[phase]!} fill="currentColor" />
          )}
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </Tooltip>
    </TooltipProvider>
  );
}
