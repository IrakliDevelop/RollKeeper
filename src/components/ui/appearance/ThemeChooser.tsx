'use client';

import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import { parseThemePreference } from '@/utils/themePreference';
import type { Theme } from '@/types/theme';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'blue', label: 'Blue dark' },
  { value: 'system', label: 'Use system theme' },
] as const;

export function ThemeChooser({
  value,
  onChange,
  character = false,
}: {
  value: Theme | undefined;
  onChange: (theme: Theme | undefined) => void;
  character?: boolean;
}) {
  return (
    <RadioGroupField
      label={character ? 'Character theme' : 'App theme'}
      helperText={
        character
          ? 'Saved with this character. Applies while its sheet and settings are open.'
          : 'Used throughout RollKeeper unless a character has its own theme.'
      }
      value={value ?? 'app'}
      onValueChange={next => onChange(parseThemePreference(next))}
      className="gap-3"
    >
      {character && <RadioGroupItem value="app" label="Use app theme" />}
      {THEMES.map(theme => (
        <RadioGroupItem
          key={theme.value}
          value={theme.value}
          label={theme.label}
        />
      ))}
    </RadioGroupField>
  );
}
