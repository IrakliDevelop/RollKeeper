'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/forms/button';
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
  const headingId = useId();

  return (
    <div>
      <h3 id={headingId} className="type-subheading text-heading">
        Weather
      </h3>
      <div
        role="group"
        aria-labelledby={headingId}
        className="mt-2 flex flex-wrap gap-2"
      >
        {WEATHER_OPTIONS.map(opt => (
          <Button
            key={opt.type}
            variant="outline"
            size="sm"
            selected={current === opt.type}
            aria-pressed={current === opt.type}
            leftIcon={
              <AppIcon
                name={getIconName(WEATHER_ICONS, opt.type, 'weatherClear')}
                className="size-4"
              />
            }
            onClick={() => onChange(opt.type)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
