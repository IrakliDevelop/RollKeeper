'use client';

import { WEATHER_OPTIONS, type WeatherType } from '@/types/calendar';
import { AppIcon, WEATHER_ICONS, getIconName } from '@/components/ui/icons';

interface WeatherPickerProps {
  current?: WeatherType;
  onChange: (weather: WeatherType) => void;
}

export function WeatherPicker({
  current = 'clear',
  onChange,
}: WeatherPickerProps) {
  return (
    <div className="space-y-2">
      <span className="text-muted text-xs font-medium tracking-wider uppercase">
        Weather
      </span>
      <div className="flex flex-wrap gap-1.5">
        {WEATHER_OPTIONS.map(opt => (
          <button
            key={opt.type}
            onClick={() => onChange(opt.type)}
            className={`flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-sm transition-all ${
              current === opt.type
                ? 'border-accent-blue-border bg-accent-blue-bg text-accent-blue-text font-medium'
                : 'border-divider bg-surface hover:bg-surface-secondary text-body'
            }`}
            title={opt.label}
          >
            <AppIcon
              name={getIconName(WEATHER_ICONS, opt.type, 'weatherClear')}
              className="h-4 w-4"
            />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
