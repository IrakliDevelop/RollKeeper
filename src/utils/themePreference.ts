import type { Theme } from '@/types/theme';

/** Older or unrecognized character data follows the app preference. */
export function parseThemePreference(value: unknown): Theme | undefined {
  return value === 'light' ||
    value === 'dark' ||
    value === 'blue' ||
    value === 'system'
    ? value
    : undefined;
}
