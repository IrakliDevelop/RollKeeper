'use client';

import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import { CALENDAR_PRESETS } from '@/utils/calendarPresets';

export const PRESET_DESCRIPTIONS: Record<
  (typeof CALENDAR_PRESETS)[number]['id'],
  string
> = {
  default: '7-day weeks, 12 months of 30 days, 4 seasons, 1 moon',
  harptos: 'Faerûn calendar with 10-day tendays, 5 holidays, Selûne moon',
  greyhawk: '7-day weeks, 12 months of 28 days, 4 festivals, 2 moons',
  barovia: '7-day weeks, 12 months of 28 days, 28-day moon cycle',
};

interface CalendarPresetPickerProps {
  value: string;
  onChange: (id: string) => void;
  /** Id of the heading that names the group. */
  labelledBy?: string;
  'aria-label'?: string;
}

/** The calendar presets as one radio group, shared by DM and player setup. */
export function CalendarPresetPicker({
  value,
  onChange,
  labelledBy,
  'aria-label': ariaLabel,
}: CalendarPresetPickerProps) {
  return (
    <RadioGroupField
      value={value}
      onValueChange={onChange}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
    >
      {CALENDAR_PRESETS.map(preset => (
        <RadioGroupItem
          key={preset.id}
          value={preset.id}
          label={preset.name}
          description={PRESET_DESCRIPTIONS[preset.id]}
        />
      ))}
    </RadioGroupField>
  );
}
