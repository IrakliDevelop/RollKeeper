'use client';

import { MoonPhaseIcon } from './MoonPhaseIcon';
import type { CalendarConfig, MoonPhaseInfo } from '@/types/calendar';
import { MOON_PHASE_NAMES, MOON_PHASE_LABELS } from '@/types/calendar';

interface MoonLegendProps {
  config: CalendarConfig;
  currentMoonPhases: MoonPhaseInfo[];
}

export function MoonLegend({ config, currentMoonPhases }: MoonLegendProps) {
  if (config.moons.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Current moon phases */}
      {currentMoonPhases.length > 0 && (
        <div>
          <h4 className="text-heading mb-2 text-sm font-semibold">
            Current Phase
          </h4>
          <div className="flex flex-wrap gap-4">
            {currentMoonPhases.map(mp => (
              <div key={mp.moon.name} className="flex items-center gap-2">
                <MoonPhaseIcon phase={mp.phase} size="md" />
                <div>
                  <span className="text-heading text-sm font-medium">
                    {mp.moon.name}
                  </span>
                  <span className="text-muted text-sm">
                    {' '}
                    &mdash; {MOON_PHASE_LABELS[mp.phase]}
                  </span>
                  <span className="text-faint ml-1 text-xs">
                    ({mp.moon.period}-day cycle)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase legend */}
      <div>
        <h4 className="text-heading mb-2 text-sm font-semibold">Moon Phases</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
          {MOON_PHASE_NAMES.map(phase => (
            <div key={phase} className="flex items-center gap-1.5">
              <MoonPhaseIcon phase={phase} size="sm" />
              <span className="text-muted text-xs">
                {MOON_PHASE_LABELS[phase]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
